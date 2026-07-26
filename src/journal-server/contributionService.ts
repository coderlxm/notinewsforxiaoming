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
import type { JournalStorage } from './storage.js';

const processContribution = pLimit(1);

export interface SubmitJournalContributionInput {
  link: JournalContributionLinkRecord;
  senderName: string;
  contentText: string;
  files: ContributionUploadSource[];
}

export class JournalContributionService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly media: JournalContributionMediaService,
  ) {}

  async submit(input: SubmitJournalContributionInput): Promise<JournalContributionDetail> {
    return processContribution(async () => {
      const publicId = randomUUID();
      const submittedAt = new Date().toISOString();
      if (input.files.length === 0) {
        return this.repository.createContribution({
          publicId,
          linkId: input.link.id,
          senderName: input.senderName,
          contentText: input.contentText,
          submittedAt,
          assets: [],
        });
      }

      const session = await this.storage.begin(publicId, submittedAt);
      let finalized = false;
      try {
        const assets: JournalContributionAssetInput[] = [];
        let videoCount = 0;
        for (const [sortOrder, file] of input.files.entries()) {
          const asset = await this.media.process(file, session, sortOrder);
          if (asset.kind === 'video') {
            videoCount += 1;
            if (videoCount > 2) {
              throw new JournalContributionError(
                'TOO_MANY_VIDEOS',
                '一份投稿最多包含 2 段视频。',
                400,
                file.sourceName,
              );
            }
          }
          assets.push(asset);
        }
        await this.storage.finalize(session);
        finalized = true;
        try {
          return this.repository.createContribution({
            publicId,
            linkId: input.link.id,
            senderName: input.senderName,
            contentText: input.contentText,
            submittedAt,
            assets,
          });
        } catch (error) {
          await this.storage.discardFinal(session);
          throw error;
        }
      } catch (error) {
        if (!finalized) await this.storage.discardTemporary(session);
        throw error;
      }
    });
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
