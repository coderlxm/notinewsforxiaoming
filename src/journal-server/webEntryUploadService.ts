import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { FileStore } from '@tus/file-store';
import { Server as TusServer, type Upload } from '@tus/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JournalRepository, WebEntryAssetInput } from './repository.js';
import type { EntryStorageSession, JournalStorage } from './storage.js';
import type { JournalImagePreviewService } from './imagePreview.js';
import { assertWebImageUpload, webImageKind } from './webImage.js';
import type { JournalVideoNormalizationService } from './videoNormalization.js';

const uploadPath = '/api/me/entry-file-uploads';
const maxAssets = 10;
const maxVideos = 5;
const maxTotalBytes = 500 * 1024 * 1024;
const maxVideoBytes = 500 * 1024 * 1024;

interface PendingUpload {
  entryUploadId: string;
  sourceName: string;
  mimeType: string;
  byteSize: number;
  complete: boolean;
}

export interface PreparedWebEntryUpload {
  id: string;
  token: string;
  publicId: string;
  createdAt: string;
  storageSession: EntryStorageSession;
  assets: WebEntryAssetInput[];
  sourceBytes: number;
  videoCount: number;
}

interface TusRequest {
  method: string;
  headers: Headers;
}

interface TusError {
  status_code: number;
  body: string;
}

function invalidUpload(message: string): Error {
  return new Error(message);
}

function asTusError(error: unknown): TusError {
  if (error instanceof Error) {
    return { status_code: 400, body: JSON.stringify({ error: error.message }) };
  }
  throw error;
}

export class JournalWebEntryUploadService {
  private readonly files: FileStore;
  private readonly server: TusServer;
  private readonly uploads = new Map<string, PreparedWebEntryUpload>();
  private readonly pending = new Map<string, PendingUpload>();

  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly previews: JournalImagePreviewService,
    private readonly videos: JournalVideoNormalizationService,
  ) {
    this.files = new FileStore({ directory: storage.contributionUploadDirectory() });
    this.server = new TusServer({
      path: uploadPath,
      datastore: this.files,
      maxSize: maxVideoBytes,
      relativeLocation: true,
      onIncomingRequest: async (request, assetUploadId) => {
        try {
          if (request.method !== 'POST' && assetUploadId) {
            const pending = this.pending.get(assetUploadId);
            if (!pending) throw invalidUpload('普通内容媒体上传会话无效。');
            this.requireUpload(pending.entryUploadId, request);
          }
        } catch (error) {
          throw asTusError(error);
        }
      },
      onUploadCreate: async (request, upload: Upload) => {
        try {
          const entryUploadId = upload.metadata?.entryUploadId;
          const sourceName = upload.metadata?.filename;
          const mimeType = upload.metadata?.filetype;
          if (!entryUploadId || !sourceName || !mimeType || upload.size === undefined) {
            throw invalidUpload('普通内容素材缺少上传信息。');
          }
          const session = this.requireUpload(entryUploadId, request);
          const pendingCount = [...this.pending.values()]
            .filter((item) => item.entryUploadId === entryUploadId)
            .length;
          if (session.assets.length + pendingCount >= maxAssets) {
            throw invalidUpload('每条内容最多选择 10 项媒体。');
          }
          this.pending.set(upload.id, {
            entryUploadId,
            sourceName,
            mimeType,
            byteSize: upload.size,
            complete: false,
          });
          return { metadata: upload.metadata };
        } catch (error) {
          throw asTusError(error);
        }
      },
      onUploadFinish: async (_request, upload) => {
        const pending = this.pending.get(upload.id);
        if (!pending) throw asTusError(invalidUpload('普通内容媒体上传会话无效。'));
        pending.complete = true;
        return {};
      },
    });
  }

  async create(input: { entryId?: number } = {}): Promise<{ uploadId: string; token: string }> {
    const id = randomUUID();
    let publicId: string;
    let createdAt: string;
    if (input.entryId !== undefined) {
      const entry = this.repository.getByIdOrNull(input.entryId);
      if (
        !entry
        || entry.sourceKind !== 'web'
        || entry.bodyFormat !== 'plain'
        || entry.publicationStatus !== 'draft'
      ) {
        throw new Error(`Web entry draft ${input.entryId} was not found.`);
      }
      publicId = entry.publicId;
      createdAt = entry.sourceCreatedAt;
    } else {
      publicId = randomUUID();
      createdAt = new Date().toISOString();
    }
    this.uploads.set(id, {
      id,
      token: randomUUID(),
      publicId,
      createdAt,
      storageSession: await this.storage.begin(publicId, createdAt),
      assets: [],
      sourceBytes: 0,
      videoCount: 0,
    });
    const upload = this.uploads.get(id) as PreparedWebEntryUpload;
    return { uploadId: id, token: upload.token };
  }

  registerRoutes(server: FastifyInstance): void {
    if (!server.hasContentTypeParser('application/offset+octet-stream')) {
      server.addContentTypeParser(
        'application/offset+octet-stream',
        (_request, _payload, done) => done(null),
      );
    }
    const handleTus = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      reply.hijack();
      await this.server.handle(request.raw, reply.raw);
    };
    server.all(uploadPath, handleTus);
    server.all(`${uploadPath}/*`, handleTus);
  }

  async process(uploadId: string, assetUploadId: string): Promise<WebEntryAssetInput> {
    const pending = this.pending.get(assetUploadId);
    const upload = this.uploads.get(uploadId);
    if (!pending || !pending.complete || !upload || pending.entryUploadId !== uploadId) {
      throw invalidUpload('普通内容媒体上传会话无效。');
    }
    if (upload.sourceBytes + pending.byteSize > maxTotalBytes) {
      throw invalidUpload('全部媒体不能超过 500 MiB。');
    }
    const sourcePath = path.join(this.storage.contributionUploadDirectory(), assetUploadId);
    try {
      const asset = pending.mimeType.startsWith('video/')
        ? await this.processVideo(sourcePath, pending, upload)
        : await this.processImage(sourcePath, pending, upload);
      upload.assets.push({ ...asset, duration: asset.duration ?? null });
      upload.sourceBytes += pending.byteSize;
      if (asset.kind === 'video') upload.videoCount += 1;
      return asset;
    } finally {
      this.pending.delete(assetUploadId);
      await this.files.remove(assetUploadId);
    }
  }

  take(uploadId: string): PreparedWebEntryUpload {
    const upload = this.uploads.get(uploadId);
    if (!upload || this.pendingFor(uploadId).length > 0) {
      throw invalidUpload('普通内容媒体上传会话尚未完成。');
    }
    this.uploads.delete(uploadId);
    return upload;
  }

  async discard(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    this.uploads.delete(uploadId);
    for (const [assetUploadId, pending] of this.pending) {
      if (pending.entryUploadId !== uploadId) continue;
      this.pending.delete(assetUploadId);
      await this.files.remove(assetUploadId);
    }
    await this.storage.discardTemporary(upload.storageSession);
  }

  private requireUpload(uploadId: string, request: TusRequest): PreparedWebEntryUpload {
    const upload = this.uploads.get(uploadId);
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!upload || token !== upload.token) throw invalidUpload('普通内容媒体上传会话无效。');
    return upload;
  }

  private async processImage(
    sourcePath: string,
    pending: PendingUpload,
    upload: PreparedWebEntryUpload,
  ): Promise<WebEntryAssetInput> {
    const buffer = await fs.promises.readFile(sourcePath);
    assertWebImageUpload({ buffer, mimeType: pending.mimeType, originalName: pending.sourceName });
    const target = this.storage.assetTarget(upload.storageSession);
    await fs.promises.writeFile(target.absolutePath, buffer, { flag: 'wx' });
    try {
      const dimensions = await this.previews.generate(target.absolutePath, target.previewAbsolutePath);
      return {
        relativePath: target.relativePath,
        previewRelativePath: target.previewRelativePath,
        kind: webImageKind(pending.mimeType),
        mimeType: pending.mimeType,
        originalName: pending.sourceName,
        byteSize: pending.byteSize,
        width: dimensions.width,
        height: dimensions.height,
        duration: null,
      };
    } catch (error) {
      await this.storage.deleteAsset(target.relativePath);
      throw error;
    }
  }

  private async processVideo(
    sourcePath: string,
    pending: PendingUpload,
    upload: PreparedWebEntryUpload,
  ): Promise<WebEntryAssetInput> {
    if (upload.videoCount >= maxVideos) throw invalidUpload('每条内容最多选择 5 段视频。');
    return this.videos.normalize({
      absolutePath: sourcePath,
      sourceName: pending.sourceName,
      byteSize: pending.byteSize,
    }, upload.storageSession);
  }

  private pendingFor(uploadId: string): PendingUpload[] {
    return [...this.pending.values()].filter((pending) => pending.entryUploadId === uploadId);
  }
}
