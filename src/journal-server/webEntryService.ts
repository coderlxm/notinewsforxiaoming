import { randomUUID } from 'node:crypto';
import type {
  JournalEntry,
  JournalVisibility,
} from '../shared/journalProtocol.js';
import { JournalImagePreviewService } from './imagePreview.js';
import {
  extractJournalTags,
  JournalRepository,
  type WebEntryAssetInput,
} from './repository.js';
import { JournalStorage } from './storage.js';
import {
  assertWebImageUpload,
  maxWebImageCount,
  type WebImageUpload,
  webImageKind,
} from './webImage.js';

export interface CreateWebEntryServiceInput {
  contentText: string;
  images: WebImageUpload[];
  action: 'draft' | 'publish';
  visibility?: JournalVisibility;
}

export interface UpdateWebDraftServiceInput {
  contentText: string;
  newImages: WebImageUpload[];
  removedAssetIds: number[];
}

export interface PublishWebDraftServiceInput extends UpdateWebDraftServiceInput {
  visibility: JournalVisibility;
}

export class JournalWebEntryService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly previews: JournalImagePreviewService,
  ) {}

  async create(input: CreateWebEntryServiceInput): Promise<JournalEntry> {
    this.assertActionVisibility(input.action, input.visibility);
    this.assertContent(input.contentText, input.images.length);
    this.assertImageCount(input.images.length);
    input.images.forEach(assertWebImageUpload);

    const publicId = randomUUID();
    const now = new Date().toISOString();
    const assets = await this.prepareAssets(publicId, now, input.images);

    try {
      return this.repository.createWebEntry({
        publicId,
        contentText: input.contentText,
        tags: extractJournalTags(input.contentText),
        publicationStatus: input.action === 'draft' ? 'draft' : 'published',
        visibility: input.action === 'draft' ? 'private' : input.visibility as JournalVisibility,
        sourceCreatedAt: now,
        assets,
      });
    } catch (error) {
      await this.deletePreparedAssets(assets);
      throw error;
    }
  }

  async updateDraft(id: number, input: UpdateWebDraftServiceInput): Promise<JournalEntry> {
    return this.writeDraft(id, input, null);
  }

  async publishDraft(id: number, input: PublishWebDraftServiceInput): Promise<JournalEntry> {
    return this.writeDraft(id, input, input.visibility);
  }

  private async writeDraft(
    id: number,
    input: UpdateWebDraftServiceInput,
    publishVisibility: JournalVisibility | null,
  ): Promise<JournalEntry> {
    const draft = this.getDraft(id);
    const storedAssets = this.repository.listWebDraftAssets(id);
    this.assertRemovedAssetIds(draft, storedAssets, input.removedAssetIds);

    const removedIds = new Set(input.removedAssetIds);
    const retainedAssets = draft.assets.filter((asset) => !removedIds.has(asset.id));
    this.assertContent(input.contentText, retainedAssets.length + input.newImages.length);
    this.assertImageCount(retainedAssets.length + input.newImages.length);
    input.newImages.forEach(assertWebImageUpload);

    const newAssets = await this.prepareAssets(
      draft.publicId,
      draft.sourceCreatedAt,
      input.newImages,
    );
    const updatedAt = new Date().toISOString();

    let updated: JournalEntry;
    try {
      updated = publishVisibility === null
        ? this.repository.updateWebDraft(id, {
            contentText: input.contentText,
            tags: extractJournalTags(input.contentText),
            updatedAt,
            removedAssetIds: input.removedAssetIds,
            newAssets,
          })
        : this.repository.publishWebDraft(id, {
            contentText: input.contentText,
            tags: extractJournalTags(input.contentText),
            updatedAt,
            removedAssetIds: input.removedAssetIds,
            newAssets,
            visibility: publishVisibility,
            sourceCreatedAt: updatedAt,
          });
    } catch (error) {
      await this.deletePreparedAssets(newAssets);
      throw error;
    }

    for (const asset of storedAssets) {
      if (!removedIds.has(asset.id)) continue;
      await this.storage.deleteAssetPair(
        asset.relativePath,
        asset.previewRelativePath,
      );
    }
    return updated;
  }

  private getDraft(id: number): JournalEntry {
    const entry = this.repository.getByIdOrNull(id);
    if (
      !entry
      || entry.sourceKind !== 'web'
      || entry.bodyFormat !== 'plain'
      || entry.publicationStatus !== 'draft'
    ) {
      throw new Error(`Web entry draft ${id} was not found.`);
    }
    return entry;
  }

  private assertActionVisibility(
    action: 'draft' | 'publish',
    visibility: JournalVisibility | undefined,
  ): void {
    if (action === 'publish' && visibility === undefined) {
      throw new Error('Published Web content requires visibility.');
    }
    if (action === 'draft' && visibility !== undefined) {
      throw new Error('Web content drafts must not specify visibility.');
    }
  }

  private assertContent(contentText: string, imageCount: number): void {
    if (contentText.trim() === '' && imageCount === 0) {
      throw new Error('Web content must include text or at least one image.');
    }
  }

  private assertImageCount(imageCount: number): void {
    if (imageCount > maxWebImageCount) {
      throw new Error(`Web content supports at most ${maxWebImageCount} images.`);
    }
  }

  private assertRemovedAssetIds(
    entry: JournalEntry,
    storedAssets: Array<{ id: number }>,
    removedAssetIds: number[],
  ): void {
    if (new Set(removedAssetIds).size !== removedAssetIds.length) {
      throw new Error('Removed Web entry asset IDs must be unique.');
    }
    const assetIds = new Set(storedAssets.map((asset) => asset.id));
    for (const assetId of removedAssetIds) {
      if (!assetIds.has(assetId)) {
        throw new Error(`Web entry asset ${assetId} does not belong to draft ${entry.id}.`);
      }
    }
  }

  private async prepareAssets(
    publicId: string,
    sourceCreatedAt: string,
    images: WebImageUpload[],
  ): Promise<WebEntryAssetInput[]> {
    const assets: WebEntryAssetInput[] = [];
    try {
      for (const image of images) {
        const relativePath = await this.storage.writeWebAsset(
          publicId,
          sourceCreatedAt,
          image.buffer,
        );
        const previewRelativePath = this.storage.previewRelativePath(relativePath);
        let dimensions;
        try {
          dimensions = await this.previews.generate(
            this.storage.absoluteAssetPath(relativePath),
            this.storage.absoluteAssetPath(previewRelativePath),
          );
        } catch (error) {
          await this.storage.deleteAsset(relativePath);
          throw error;
        }
        assets.push({
          relativePath,
          previewRelativePath,
          kind: webImageKind(image.mimeType),
          mimeType: image.mimeType,
          originalName: image.originalName,
          byteSize: image.buffer.byteLength,
          width: dimensions.width,
          height: dimensions.height,
          duration: null,
        });
      }
      return assets;
    } catch (error) {
      await this.deletePreparedAssets(assets);
      throw error;
    }
  }

  private async deletePreparedAssets(assets: WebEntryAssetInput[]): Promise<void> {
    for (const asset of assets) {
      await this.storage.deleteAssetPair(asset.relativePath, asset.previewRelativePath);
    }
  }
}
