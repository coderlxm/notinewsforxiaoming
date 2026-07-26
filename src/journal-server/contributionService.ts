import { randomUUID } from 'node:crypto';
import pLimit from 'p-limit';
import type {
  JournalContributionDetail,
  JournalContributionPublishRequest,
  JournalEntry,
} from '../shared/journalProtocol.js';
import { JournalContributionError } from './contributionError.js';
import {
  JournalContributionMediaService,
  type ContributionUploadSource,
} from './contributionMedia.js';
import type {
  JournalContributionAssetInput,
  JournalContributionLinkRecord,
  JournalRepository,
} from './repository.js';
import type { EntryStorageSession, JournalStorage } from './storage.js';

const processContribution = pLimit(1);
const maxAssets = 30;
const maxVideos = 5;
const maxTotalBytes = 500 * 1024 * 1024;

interface ContributionUploadSession {
  link: JournalContributionLinkRecord;
  publicId: string;
  createdAt: string;
  storageSession: EntryStorageSession | null;
  assets: JournalContributionAssetInput[];
  sourceBytes: number;
  videoCount: number;
}

export interface SubmitJournalContributionInput {
  uploadId: string;
  link: JournalContributionLinkRecord;
  senderName: string;
  contentText: string;
}

export class JournalContributionService {
  private readonly uploads = new Map<string, ContributionUploadSession>();

  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly media: JournalContributionMediaService,
  ) {}

  createUpload(link: JournalContributionLinkRecord): string {
    const id = randomUUID();
    this.uploads.set(id, {
      link,
      publicId: randomUUID(),
      createdAt: new Date().toISOString(),
      storageSession: null,
      assets: [],
      sourceBytes: 0,
      videoCount: 0,
    });
    return id;
  }

  requireUpload(link: JournalContributionLinkRecord, uploadId: string): void {
    this.upload(link, uploadId);
  }

  async addUploadAsset(
    link: JournalContributionLinkRecord,
    uploadId: string,
    source: ContributionUploadSource,
  ): Promise<JournalContributionAssetInput> {
    return processContribution(async () => {
      const upload = this.upload(link, uploadId);
      if (upload.assets.length >= maxAssets) {
        throw new JournalContributionError(
          'TOO_MANY_ASSETS',
          '一份投稿最多包含 30 项素材。',
          400,
        );
      }
      if (upload.sourceBytes + source.byteSize > maxTotalBytes) {
        throw new JournalContributionError(
          'CONTRIBUTION_TOO_LARGE',
          '一份投稿的全部文件不能超过 500 MiB。',
          400,
          source.sourceName,
        );
      }
      upload.storageSession ??= await this.storage.begin(upload.publicId, upload.createdAt);
      const asset = await this.media.process(
        source,
        upload.storageSession,
        upload.assets.length,
      );
      if (asset.kind === 'video' && upload.videoCount >= maxVideos) {
        throw new JournalContributionError(
          'TOO_MANY_VIDEOS',
          '一份投稿最多包含 5 段视频。',
          400,
          source.sourceName,
        );
      }
      upload.assets.push(asset);
      upload.sourceBytes += source.byteSize;
      if (asset.kind === 'video') upload.videoCount += 1;
      return asset;
    });
  }

  async discardUpload(
    link: JournalContributionLinkRecord,
    uploadId: string,
  ): Promise<void> {
    const upload = this.upload(link, uploadId);
    this.uploads.delete(uploadId);
    if (upload.storageSession) {
      await this.storage.discardTemporary(upload.storageSession);
    }
  }

  async submit(input: SubmitJournalContributionInput): Promise<JournalContributionDetail> {
    return processContribution(async () => {
      const upload = this.upload(input.link, input.uploadId);
      if (input.contentText.trim() === '' && upload.assets.length === 0) {
        throw new JournalContributionError(
          'INVALID_FORM',
          '正文和素材至少填写一项。',
          400,
        );
      }
      this.uploads.delete(input.uploadId);
      const submittedAt = new Date().toISOString();
      if (upload.assets.length === 0) {
        return this.repository.createContribution({
          publicId: upload.publicId,
          linkId: input.link.id,
          senderName: input.senderName,
          contentText: input.contentText,
          submittedAt,
          assets: [],
        });
      }

      let finalized = false;
      const storageSession = upload.storageSession as EntryStorageSession;
      try {
        await this.storage.finalize(storageSession);
        finalized = true;
        try {
          return this.repository.createContribution({
            publicId: upload.publicId,
            linkId: input.link.id,
            senderName: input.senderName,
            contentText: input.contentText,
            submittedAt,
            assets: upload.assets,
          });
        } catch (error) {
          await this.storage.discardFinal(storageSession);
          throw error;
        }
      } catch (error) {
        if (!finalized) {
          await this.storage.discardTemporary(storageSession);
        }
        throw error;
      }
    });
  }

  private upload(
    link: JournalContributionLinkRecord,
    uploadId: string,
  ): ContributionUploadSession {
    const upload = this.uploads.get(uploadId);
    if (!upload || upload.link.id !== link.id) {
      throw new JournalContributionError(
        'INVALID_FORM',
        '投稿上传会话无效。',
        400,
      );
    }
    return upload;
  }

  async deleteAsset(
    publicId: string,
    assetId: number,
  ): Promise<JournalContributionDetail | null> {
    const asset = this.repository.findContributionStoredAsset(publicId, assetId);
    if (!asset) return null;
    await this.storage.deleteAssetPair(asset.relativePath, asset.previewRelativePath);
    const contribution = this.repository.deleteContributionAsset(publicId, assetId);
    if (contribution?.assets.length === 0) {
      await this.storage.deleteContributionDirectory(publicId, contribution.submittedAt);
    }
    return contribution;
  }

  async delete(publicId: string): Promise<boolean> {
    const contribution = this.repository.getContribution(publicId);
    if (!contribution) return false;
    if (contribution.assets.length > 0) {
      await this.storage.deleteContributionDirectory(publicId, contribution.submittedAt);
    }
    return this.repository.deleteContribution(publicId);
  }

  async publish(
    publicId: string,
    input: JournalContributionPublishRequest,
  ): Promise<JournalEntry | null> {
    const contribution = this.repository.getContribution(publicId);
    if (!contribution) return null;
    const retainedIds = new Set(input.assetIds);
    for (const asset of contribution.assets) {
      if (retainedIds.has(asset.id)) continue;
      const remaining = await this.deleteAsset(publicId, asset.id);
      if (!remaining) {
        throw new Error(`Contribution asset ${asset.id} disappeared before publishing.`);
      }
    }
    return this.repository.publishContribution(publicId, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
  }
}
