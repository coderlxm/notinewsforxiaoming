import {
  journalArticleAssetResponseSchema,
  journalArticleCreateRequestSchema,
  journalArticleUpdateRequestSchema,
  type JournalArticleAssetResponse,
  type JournalArticleCreateRequest,
  type JournalArticleUpdateRequest,
  type JournalEntry,
  type JournalRichDocument,
} from '../shared/journalProtocol.js';
import {
  type CoverAssetRecord,
  JournalRepository,
} from './repository.js';
import {
  type JournalImageDimensions,
  JournalImagePreviewService,
} from './imagePreview.js';
import {
  assertRichDocument,
  collectInlineAssetIds,
  extractContentText,
} from './richText.js';
import { JournalStorage } from './storage.js';

const maxRichBodyBytes = 512 * 1024;
const allowedUploadMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxUploadBytes = 20 * 1024 * 1024;

export interface ArticleUploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string | null;
}

export class JournalArticleService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly previews: JournalImagePreviewService,
  ) {}

  createArticle(rawInput: unknown): JournalEntry {
    const input = journalArticleCreateRequestSchema.parse(rawInput) as JournalArticleCreateRequest;
    const richBodyJson = this.serializeRichBody(input.richBody, { allowImages: false });
    const contentText = extractContentText(input.richBody);
    this.assertBodyIsNotEmpty(contentText, []);
    return this.repository.createArticle({
      title: input.title,
      richBodyJson,
      tags: input.tags,
      contentText,
    });
  }

  async updateArticle(id: number, rawInput: unknown): Promise<JournalEntry> {
    const input = journalArticleUpdateRequestSchema.parse(rawInput) as JournalArticleUpdateRequest;
    const existing = this.repository.getArticleForEditing(id);
    if (!existing) {
      throw new Error(`Article ${id} was not found.`);
    }
    const richBodyJson = this.serializeRichBody(input.richBody, { allowImages: true });

    const referencedIds = collectInlineAssetIds(input.richBody);
    const contentText = extractContentText(input.richBody);
    this.assertBodyIsNotEmpty(contentText, referencedIds);
    const existingInline = this.repository.listInlineAssets(id);
    const existingInlineIds = new Set(existingInline.map((asset) => asset.id));
    for (const referenced of referencedIds) {
      if (!existingInlineIds.has(referenced)) {
        throw new Error(`Inline image ${referenced} does not belong to article ${id}.`);
      }
    }
    const unreferenced = existingInline.filter((asset) => !referencedIds.includes(asset.id));

    const updated = this.repository.updateArticle(id, {
      title: input.title,
      richBodyJson,
      tags: input.tags,
      contentText,
    }, unreferenced.map((asset) => asset.id));

    for (const asset of unreferenced) {
      await this.storage.deleteAssetPair(asset.relativePath, asset.previewRelativePath);
    }

    return updated;
  }

  getArticleForEditing(id: number): JournalEntry | null {
    return this.repository.getArticleForEditing(id);
  }

  async uploadAsset(
    id: number,
    role: 'cover' | 'inline',
    input: ArticleUploadInput,
  ): Promise<JournalArticleAssetResponse> {
    if (!allowedUploadMimeTypes.has(input.mimeType)) {
      throw new Error(`Unsupported article asset MIME type ${input.mimeType}.`);
    }
    if (input.buffer.byteLength > maxUploadBytes) {
      throw new Error('Article asset exceeds the 20 MB upload limit.');
    }
    const article = this.repository.getArticleForEditing(id);
    if (!article) {
      throw new Error(`Article ${id} was not found.`);
    }

    const relativePath = await this.storage.writeArticleAsset(
      article.publicId,
      article.sourceCreatedAt,
      input.buffer,
    );
    const previewRelativePath = this.storage.previewRelativePath(relativePath);
    let dimensions: JournalImageDimensions;
    try {
      dimensions = await this.previews.generate(
        this.storage.absoluteAssetPath(relativePath),
        this.storage.absoluteAssetPath(previewRelativePath),
      );
    } catch (error) {
      await this.storage.deleteAsset(relativePath);
      throw error;
    }

    let previousCover: CoverAssetRecord | null = null;
    if (role === 'cover') {
      previousCover = this.repository.findCover(id);
    }
    const kind = this.kindFromMime(input.mimeType);
    let newAssetId: number;
    try {
      const sortOrder = role === 'cover' ? 0 : this.repository.listInlineAssets(id).length;
      newAssetId = this.repository.insertWebAsset({
        entryId: id,
        role,
        relativePath,
        previewRelativePath,
        kind,
        mimeType: input.mimeType,
        originalName: input.originalName,
        byteSize: input.buffer.byteLength,
        width: dimensions.width,
        height: dimensions.height,
        sortOrder,
      });
    } catch (error) {
      await this.storage.deleteAssetPair(relativePath, previewRelativePath);
      throw error;
    }

    if (previousCover) {
      await this.storage.deleteAssetPair(
        previousCover.relativePath,
        previousCover.previewRelativePath,
      );
    }
    return journalArticleAssetResponseSchema.parse({
      id: newAssetId,
      role,
      kind,
      url: `/media/${newAssetId}`,
      originalName: input.originalName,
      mimeType: input.mimeType,
      byteSize: input.buffer.byteLength,
    });
  }

  async deleteAsset(id: number, assetId: number): Promise<void> {
    const asset = this.repository.findWebAsset(id, assetId);
    if (!asset) {
      throw new Error(`Article asset ${assetId} does not belong to article ${id}.`);
    }
    if (asset.role === 'inline') {
      const article = this.repository.getArticleForEditing(id);
      if (article?.richBody) {
        const referenced = new Set(collectInlineAssetIds(article.richBody));
        if (referenced.has(assetId)) {
          throw new Error('Inline image is still referenced in the article body.');
        }
      }
    }
    if (asset.preview_relative_path === null) {
      throw new Error(`Article asset ${assetId} does not have an image preview.`);
    }
    await this.storage.deleteAssetPair(asset.relative_path, asset.preview_relative_path);
    this.repository.deleteAssets([assetId]);
  }

  private serializeRichBody(document: JournalRichDocument, options: { allowImages: boolean }): string {
    const json = JSON.stringify(document);
    if (Buffer.byteLength(json, 'utf8') > maxRichBodyBytes) {
      throw new Error('Article rich body exceeds the 512 KB limit.');
    }
    assertRichDocument(document, options);
    return json;
  }

  private kindFromMime(mimeType: string): string {
    if (mimeType === 'image/gif') return 'animation';
    return 'photo';
  }

  private assertBodyIsNotEmpty(contentText: string, inlineAssetIds: number[]): void {
    if (contentText.trim() === '' && inlineAssetIds.length === 0) {
      throw new Error('Article body must not be empty.');
    }
  }
}
