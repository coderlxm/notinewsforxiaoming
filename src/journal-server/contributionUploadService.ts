import path from 'node:path';
import { FileStore } from '@tus/file-store';
import { Server as TusServer, type Upload } from '@tus/server';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { JournalContributionError } from './contributionError.js';
import type { JournalContributionLinkService } from './contributionLinkService.js';
import type { ContributionUploadSource } from './contributionMedia.js';
import type { JournalContributionService } from './contributionService.js';
import type {
  JournalContributionAssetInput,
  JournalContributionLinkRecord,
} from './repository.js';

const uploadPath = '/api/contribution-file-uploads';
const maxVideoBytes = 500 * 1024 * 1024;

interface PendingContributionUpload {
  contributionUploadId: string;
  sourceName: string;
  byteSize: number;
  complete: boolean;
}

interface TusRequest {
  method: string;
  headers: Headers;
}

interface TusError {
  status_code: number;
  body: string;
}

function invalidUpload(message: string): JournalContributionError {
  return new JournalContributionError('INVALID_FORM', message, 400);
}

function asTusError(error: unknown): TusError {
  if (error instanceof JournalContributionError) {
    return {
      status_code: error.statusCode,
      body: JSON.stringify(error.response()),
    };
  }
  throw error;
}

export class JournalContributionUploadService {
  private readonly files: FileStore;
  private readonly server: TusServer;
  private readonly pending = new Map<string, PendingContributionUpload>();

  constructor(
    private readonly directory: string,
    private readonly links: JournalContributionLinkService,
    private readonly contributions: JournalContributionService,
  ) {
    this.files = new FileStore({ directory });
    this.server = new TusServer({
      path: uploadPath,
      datastore: this.files,
      maxSize: maxVideoBytes,
      relativeLocation: true,
      onIncomingRequest: async (request, assetUploadId) => {
        try {
          const link = this.requireLink(request);
          if (request.method !== 'POST' && assetUploadId) {
            const pending = this.pending.get(assetUploadId);
            if (!pending) throw invalidUpload('投稿素材上传会话无效。');
            this.contributions.requireUpload(link, pending.contributionUploadId);
          }
        } catch (error) {
          throw asTusError(error);
        }
      },
      onUploadCreate: async (request, upload) => {
        try {
          const link = this.requireLink(request);
          const contributionUploadId = upload.metadata?.contributionUploadId;
          const sourceName = upload.metadata?.filename;
          if (!contributionUploadId || !sourceName || upload.size === undefined) {
            throw invalidUpload('投稿素材缺少上传信息。');
          }
          this.contributions.requireUpload(link, contributionUploadId);
          this.pending.set(upload.id, {
            contributionUploadId,
            sourceName,
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
        if (!pending) throw asTusError(invalidUpload('投稿素材上传会话无效。'));
        pending.complete = true;
        return {};
      },
    });
  }

  registerRoutes(server: FastifyInstance): void {
    server.addContentTypeParser(
      'application/offset+octet-stream',
      (_request, _payload, done) => done(null),
    );
    const handleTus = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      reply.hijack();
      await this.server.handle(request.raw, reply.raw);
    };
    server.all(uploadPath, handleTus);
    server.all(`${uploadPath}/*`, handleTus);
  }

  async process(
    link: JournalContributionLinkRecord,
    contributionUploadId: string,
    assetUploadId: string,
  ): Promise<JournalContributionAssetInput> {
    const pending = this.pending.get(assetUploadId);
    if (
      !pending
      || !pending.complete
      || pending.contributionUploadId !== contributionUploadId
    ) {
      throw invalidUpload('投稿素材上传会话无效。');
    }
    this.contributions.requireUpload(link, contributionUploadId);
    const source: ContributionUploadSource = {
      absolutePath: path.join(this.directory, assetUploadId),
      sourceName: pending.sourceName,
      byteSize: pending.byteSize,
    };
    try {
      return await this.contributions.addUploadAsset(
        link,
        contributionUploadId,
        source,
      );
    } finally {
      this.pending.delete(assetUploadId);
      await this.files.remove(assetUploadId);
    }
  }

  async discard(contributionUploadId: string): Promise<void> {
    const assetUploadIds = [...this.pending]
      .filter(([, pending]) => pending.contributionUploadId === contributionUploadId)
      .map(([assetUploadId]) => assetUploadId);
    for (const assetUploadId of assetUploadIds) {
      this.pending.delete(assetUploadId);
      await this.files.remove(assetUploadId);
    }
  }

  private requireLink(request: TusRequest): JournalContributionLinkRecord {
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    return this.links.requireValid(token);
  }
}
