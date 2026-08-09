import type {
  JournalEntry,
  JournalPlainChannel,
  JournalVisibility,
} from '../shared/journalProtocol.js';
import {
  extractJournalTags,
  type JournalRepository,
} from './repository.js';
import { hashAccessPassword } from './auth.js';
import type { JournalStorage } from './storage.js';
import type { PreparedWebEntryUpload } from './webEntryUploadService.js';

const maxWebEntryMediaCount = 10;
const maxWebEntryVideoCount = 5;

export interface CreateWebEntryServiceInput {
  title: string | null;
  contentText: string;
  action: 'draft' | 'publish';
  channel: JournalPlainChannel;
  visibility?: JournalVisibility;
  accessPassword?: string;
  uploadId: string;
  sourceCreatedAt?: string;
}

export interface UpdateWebDraftServiceInput {
  title: string | null;
  contentText: string;
  channel: JournalPlainChannel;
  uploadId: string;
  removedAssetIds: number[];
}

export interface PublishWebDraftServiceInput extends UpdateWebDraftServiceInput {
  visibility: JournalVisibility;
  accessPassword?: string;
}

export interface UpdatePublishedWebEntryServiceInput extends UpdateWebDraftServiceInput {
  visibility: JournalVisibility;
  accessPassword?: string;
  sourceCreatedAt: string;
}

export class JournalWebEntryService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
  ) {}

  async createPrepared(
    input: Omit<CreateWebEntryServiceInput, 'uploadId'>,
    upload: PreparedWebEntryUpload,
  ): Promise<JournalEntry> {
    this.assertActionVisibility(input.action, input.visibility);
    this.assertContent(input.contentText, upload.assets.length);
    this.assertMediaCount(
      upload.assets.length,
      upload.assets.filter((asset) => asset.kind === 'video').length,
    );

    if (upload.assets.length > 0) {
      await this.storage.finalize(upload.storageSession);
    } else {
      await this.storage.discardTemporary(upload.storageSession);
    }
    try {
      return this.repository.createWebEntry({
        publicId: upload.publicId,
        title: this.normalizeTitle(input.title),
        contentText: input.contentText,
        tags: extractJournalTags(input.contentText),
        publicationStatus: input.action === 'draft' ? 'draft' : 'published',
        channel: input.channel,
        visibility: input.action === 'draft' ? 'private' : input.visibility as JournalVisibility,
        accessPasswordHash: input.action === 'draft'
          ? null
          : this.hashForNewAccess(input.visibility as JournalVisibility, input.accessPassword),
        sourceCreatedAt: input.sourceCreatedAt ?? upload.createdAt,
        assets: upload.assets,
      });
    } catch (error) {
      if (upload.assets.length > 0) {
        await this.storage.discardFinal(upload.storageSession);
      }
      throw error;
    }
  }

  async updatePreparedDraft(
    id: number,
    input: Omit<UpdateWebDraftServiceInput, 'uploadId'>,
    upload: PreparedWebEntryUpload,
    publishVisibility: JournalVisibility | null,
    accessPassword?: string,
    sourceCreatedAt?: string,
  ): Promise<JournalEntry> {
    const draft = this.getDraft(id);
    const storedAssets = this.repository.listWebDraftAssets(id);
    this.assertRemovedAssetIds(draft, storedAssets, input.removedAssetIds);
    const removedIds = new Set(input.removedAssetIds);
    const retainedAssets = draft.assets.filter((asset) => !removedIds.has(asset.id));
    const newAssets = upload.assets;
    this.assertContent(input.contentText, retainedAssets.length + newAssets.length);
    this.assertMediaCount(
      retainedAssets.length + newAssets.length,
      retainedAssets.filter((asset) => asset.kind === 'video').length
        + newAssets.filter((asset) => asset.kind === 'video').length,
    );

    if (newAssets.length > 0) {
      await this.storage.appendToFinal(upload.storageSession);
    } else {
      await this.storage.discardTemporary(upload.storageSession);
    }
    const updatedAt = new Date().toISOString();
    let updated: JournalEntry;
    try {
      updated = publishVisibility === null
        ? this.repository.updateWebDraft(id, {
            title: this.normalizeTitle(input.title),
            contentText: input.contentText,
            tags: extractJournalTags(input.contentText),
            channel: input.channel,
            updatedAt,
            removedAssetIds: input.removedAssetIds,
            newAssets,
          })
        : this.repository.publishWebDraft(id, {
            title: this.normalizeTitle(input.title),
            contentText: input.contentText,
            tags: extractJournalTags(input.contentText),
            channel: input.channel,
            updatedAt,
            removedAssetIds: input.removedAssetIds,
            newAssets,
            visibility: publishVisibility,
            accessPasswordHash: this.hashForNewAccess(publishVisibility, accessPassword),
            sourceCreatedAt: sourceCreatedAt ?? updatedAt,
          });
    } catch (error) {
      for (const asset of newAssets) {
        await this.storage.deleteAssetPair(asset.relativePath, asset.previewRelativePath);
      }
      throw error;
    }
    for (const asset of storedAssets) {
      if (removedIds.has(asset.id)) {
        await this.storage.deleteAssetPair(asset.relativePath, asset.previewRelativePath);
      }
    }
    return updated;
  }

  async updatePreparedPublished(
    id: number,
    input: Omit<UpdatePublishedWebEntryServiceInput, 'uploadId'>,
    upload: PreparedWebEntryUpload,
  ): Promise<JournalEntry> {
    const entry = this.getPublishedWebEntry(id);
    const storedAssets = this.repository.listPublishedWebEntryAssets(id);
    this.assertRemovedAssetIds(entry, storedAssets, input.removedAssetIds);
    const removedIds = new Set(input.removedAssetIds);
    const retainedAssets = entry.assets.filter(asset => !removedIds.has(asset.id));
    const newAssets = upload.assets;
    this.assertContent(input.contentText, retainedAssets.length + newAssets.length);
    this.assertMediaCount(
      retainedAssets.length + newAssets.length,
      retainedAssets.filter(asset => asset.kind === 'video').length
        + newAssets.filter(asset => asset.kind === 'video').length,
    );

    if (newAssets.length > 0) {
      await this.storage.appendToFinal(upload.storageSession);
    } else {
      await this.storage.discardTemporary(upload.storageSession);
    }
    let updated: JournalEntry;
    try {
      updated = this.repository.updatePublishedWebEntry(id, {
        title: this.normalizeTitle(input.title),
        contentText: input.contentText,
        tags: extractJournalTags(input.contentText),
        channel: input.channel,
        visibility: input.visibility,
        accessPasswordHash: this.hashForAccessUpdate(
          entry.visibility,
          input.visibility,
          input.accessPassword,
        ),
        sourceCreatedAt: input.sourceCreatedAt,
        updatedAt: new Date().toISOString(),
        removedAssetIds: input.removedAssetIds,
        newAssets,
      });
    } catch (error) {
      for (const asset of newAssets) {
        await this.storage.deleteAssetPair(asset.relativePath, asset.previewRelativePath);
      }
      throw error;
    }
    for (const asset of storedAssets) {
      if (removedIds.has(asset.id)) {
        await this.storage.deleteAssetPair(asset.relativePath, asset.previewRelativePath);
      }
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

  private getPublishedWebEntry(id: number): JournalEntry {
    const entry = this.repository.getByIdOrNull(id);
    if (
      !entry
      || entry.sourceKind !== 'web'
      || entry.bodyFormat !== 'plain'
      || entry.publicationStatus !== 'published'
    ) {
      throw new Error(`Published web entry ${id} was not found.`);
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

  private normalizeTitle(title: string | null): string | null {
    const normalized = title?.trim() ?? '';
    return normalized === '' ? null : normalized;
  }

  private hashForNewAccess(
    visibility: JournalVisibility,
    accessPassword: string | undefined,
  ): string | null {
    if (visibility !== 'protected') {
      if (accessPassword !== undefined) {
        throw new Error('Only protected Journal entries accept an access password.');
      }
      return null;
    }
    if (accessPassword === undefined) {
      throw new Error('Protected Journal entries require a 6-digit access password.');
    }
    return hashAccessPassword(accessPassword);
  }

  private hashForAccessUpdate(
    currentVisibility: JournalVisibility,
    visibility: JournalVisibility,
    accessPassword: string | undefined,
  ): string | undefined {
    if (visibility !== 'protected') {
      if (accessPassword !== undefined) {
        throw new Error('Only protected Journal entries accept an access password.');
      }
      return undefined;
    }
    if (accessPassword !== undefined) return hashAccessPassword(accessPassword);
    if (currentVisibility !== 'protected') {
      throw new Error('Protected Journal entries require a 6-digit access password.');
    }
    return undefined;
  }

  private assertContent(contentText: string, mediaCount: number): void {
    if (contentText.trim() === '' && mediaCount === 0) {
      throw new Error('Web content must include text or at least one media item.');
    }
  }

  private assertMediaCount(mediaCount: number, videoCount: number): void {
    if (mediaCount > maxWebEntryMediaCount) {
      throw new Error(`Web content supports at most ${maxWebEntryMediaCount} media items.`);
    }
    if (videoCount > maxWebEntryVideoCount) {
      throw new Error(`Web content supports at most ${maxWebEntryVideoCount} videos.`);
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
        throw new Error(`Web entry asset ${assetId} does not belong to entry ${entry.id}.`);
      }
    }
  }
}
