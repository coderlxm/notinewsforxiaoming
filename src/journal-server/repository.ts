import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import type {
  JournalAssetRole,
  JournalAssetSourceKind,
  JournalBodyFormat,
  JournalChannel,
  JournalChannelTags,
  JournalContributionAsset,
  JournalContributionAssetKind,
  JournalContributionDetail,
  JournalContributionSummary,
  JournalDeletionResult,
  JournalDiscoveryArchiveMonthResponse,
  JournalDiscoveryArchiveOverview,
  JournalDiscoveryEntrySummary,
  JournalDiscoverySearchResponse,
  JournalEntry,
  JournalFeed,
  JournalPage,
  JournalPublicationStatus,
  JournalPlainChannel,
  JournalProtectedEntryPreview,
  JournalResumeAccessMode,
  JournalResumeFormat,
  JournalRichDocument,
  JournalSiteContactItem,
  JournalSourceKind,
  JournalVisibility,
} from '../shared/journalProtocol.js';
import {
  journalChannelTagsSchema,
  journalRichDocumentSchema,
  journalSiteContactItemsSchema,
} from '../shared/journalProtocol.js';
import type {
  CreateJournalEntryInput,
  JournalAssetAccess,
  JournalDeletionTarget,
  JournalImagePreviewBackfillAsset,
  JournalListFilters,
  JournalPageFilters,
  JournalPosterBackfillAsset,
  JournalVideoPreviewBackfillAsset,
} from './types.js';

interface EntryRow {
  id: number;
  public_id: string;
  source_kind: JournalSourceKind;
  chat_id: string | null;
  source_message_id: number | null;
  media_group_id: string | null;
  content_type: string;
  title: string | null;
  body_format: JournalBodyFormat;
  content_text: string;
  rich_body_json: string | null;
  publication_status: JournalPublicationStatus;
  channel: JournalChannel;
  visibility: JournalVisibility;
  access_password_hash: string | null;
  access_revision: number;
  tags_json: string;
  structured_content_json: string | null;
  telegram_message_json: string | null;
  pinned: 0 | 1;
  ai_generated: 0 | 1;
  source_created_at: string;
  captured_at: string;
  updated_at: string;
}

type DiscoveryEntryRow = EntryRow & { visibility: 'public' | 'protected' };

interface AssetRow {
  id: number;
  source_kind: JournalAssetSourceKind;
  role: JournalAssetRole;
  kind: string;
  original_name: string | null;
  mime_type: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  relative_path: string;
  preview_relative_path: string | null;
  poster_relative_path: string | null;
}

export interface CreateArticleInput {
  title: string;
  richBodyJson: string;
  tags: string[];
  contentText: string;
  aiGenerated: boolean;
}

export interface UpdateArticleInput {
  title: string;
  richBodyJson: string;
  tags: string[];
  contentText: string;
  aiGenerated: boolean;
}

export interface WebEntryAssetInput {
  relativePath: string;
  previewRelativePath: string;
  posterRelativePath: string | null;
  kind: string;
  mimeType: string;
  originalName: string | null;
  byteSize: number;
  width: number;
  height: number;
  duration?: number | null;
  sortOrder?: number;
}

export interface CreateWebEntryInput {
  publicId: string;
  title: string | null;
  contentText: string;
  tags: string[];
  publicationStatus: JournalPublicationStatus;
  channel: JournalPlainChannel;
  visibility: JournalVisibility;
  accessPasswordHash: string | null;
  sourceCreatedAt: string;
  assets: WebEntryAssetInput[];
}

export interface UpdateWebDraftInput {
  title: string | null;
  contentText: string;
  tags: string[];
  channel: JournalPlainChannel;
  updatedAt: string;
  removedAssetIds: number[];
  newAssets: WebEntryAssetInput[];
}

export interface PublishWebDraftInput extends UpdateWebDraftInput {
  visibility: JournalVisibility;
  accessPasswordHash: string | null;
  sourceCreatedAt: string;
}

export interface UpdatePublishedWebEntryInput extends UpdateWebDraftInput {
  visibility: JournalVisibility;
  accessPasswordHash: string | undefined;
  sourceCreatedAt: string;
}

export interface WebDraftAssetRecord {
  id: number;
  relativePath: string;
  previewRelativePath: string;
  posterRelativePath: string | null;
}

export interface InlineAssetRecord {
  id: number;
  relativePath: string;
  previewRelativePath: string;
  posterRelativePath: string | null;
}

export interface CoverAssetRecord {
  id: number;
  relativePath: string;
  previewRelativePath: string;
  posterRelativePath: string | null;
}

export interface JournalSiteProfileRecord {
  bio: string;
  avatarWebp: Buffer;
  avatarRevision: number;
  weatherEnabled: boolean;
  channelTags: JournalChannelTags;
  aboutIntro: string;
  contactItems: JournalSiteContactItem[];
  updatedAt: string;
}

export interface JournalResumeRecord {
  format: JournalResumeFormat;
  originalName: string;
  content: Buffer;
  renderedHtml: string | null;
  accessMode: JournalResumeAccessMode;
  accessPasswordHash: string | null;
  accessGrantId: string;
  accessRevision: number;
  revision: number;
  updatedAt: string;
}

export interface JournalResumeShareLinkRecord {
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface JournalResumePreviewPageRecord {
  pageNumber: number;
  contentLightWebp: Buffer;
  contentDarkWebp: Buffer;
  width: number;
  height: number;
}

export type JournalResumePreviewPageMetadata = Pick<
  JournalResumePreviewPageRecord,
  'pageNumber' | 'width' | 'height'
>;

export interface UpdateResumeAccessInput {
  accessMode: JournalResumeAccessMode;
  accessPasswordHash: string | null;
  accessGrantId: string;
  tokenHash: string | null;
  shareExpiresAt: string | null;
  updatedAt: string;
}

interface SiteProfileRow {
  bio: string;
  avatar_webp: Buffer;
  avatar_revision: number;
  weather_enabled: 0 | 1;
  channel_tags_json: string;
  about_intro: string;
  contact_items_json: string;
  updated_at: string;
}

interface ContributionLinkRow {
  id: number;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface ContributionRow {
  id: number;
  public_id: string;
  link_id: number;
  sender_name: string;
  content_text: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

interface ContributionAssetRow {
  id: number;
  contribution_id: number;
  kind: JournalContributionAssetKind;
  source_name: string;
  mime_type: string;
  byte_size: number;
  relative_path: string;
  preview_relative_path: string;
  width: number;
  height: number;
  duration: number | null;
  sort_order: number;
  created_at: string;
}

export interface JournalContributionLinkRecord {
  id: number;
  tokenHash: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface JournalContributionAssetInput {
  kind: JournalContributionAssetKind;
  sourceName: string;
  mimeType: string;
  byteSize: number;
  relativePath: string;
  previewRelativePath: string;
  width: number;
  height: number;
  duration: number | null;
  sortOrder: number;
}

export interface CreateJournalContributionInput {
  publicId: string;
  linkId: number;
  senderName: string;
  contentText: string;
  submittedAt: string;
  assets: JournalContributionAssetInput[];
}

export interface JournalContributionStoredAsset {
  id: number;
  relativePath: string;
  previewRelativePath: string;
}

export interface JournalPublishedAccess {
  publicId: string;
  visibility: JournalVisibility;
  accessPasswordHash: string | null;
  accessRevision: number;
  entry: JournalEntry;
}

export interface JournalEntryFeed {
  entries: JournalEntry[];
  nextCursor: string | null;
}

const cursorSchema = z.object({
  pinned: z.union([z.literal(0), z.literal(1)]),
  sourceCreatedAt: z.string().datetime(),
  id: z.number().int().positive(),
});

type Cursor = z.infer<typeof cursorSchema>;

const discoverySearchCursorSchema = z.object({
  kind: z.literal('discovery-search'),
  query: z.string(),
  rank: z.number().int().min(0).max(3),
  sourceCreatedAt: z.string().datetime(),
  id: z.number().int().positive(),
});

type DiscoverySearchCursor = z.infer<typeof discoverySearchCursorSchema>;

const discoveryArchiveCursorSchema = z.object({
  kind: z.literal('discovery-archive'),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  sourceCreatedAt: z.string().datetime(),
  id: z.number().int().positive(),
});

type DiscoveryArchiveCursor = z.infer<typeof discoveryArchiveCursorSchema>;

function encodeCursor(row: EntryRow): string {
  return Buffer.from(JSON.stringify({
    pinned: row.pinned,
    sourceCreatedAt: row.source_created_at,
    id: row.id,
  } satisfies Cursor)).toString('base64url');
}

function decodeCursor(value: string): Cursor {
  return cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
}

function encodeDiscoveryCursor(cursor: DiscoverySearchCursor | DiscoveryArchiveCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeDiscoverySearchCursor(value: string): DiscoverySearchCursor {
  return discoverySearchCursorSchema.parse(
    JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
  );
}

function decodeDiscoveryArchiveCursor(value: string): DiscoveryArchiveCursor {
  return discoveryArchiveCursorSchema.parse(
    JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
  );
}

function parseStructuredContent(value: string | null): Record<string, unknown> | null {
  if (value === null) return null;
  const content = z.record(z.string(), z.unknown()).parse(JSON.parse(value));
  delete content.entities;
  delete content.caption_entities;
  return Object.keys(content).length === 0 ? null : content;
}

export function extractJournalTags(contentText: string): string[] {
  return [...new Set(
    [...contentText.matchAll(/#([\p{L}\p{N}_]+)/gu)]
      .map((match) => match[1])
      .filter((tag): tag is string => Boolean(tag)),
  )];
}

export function contentTypeOf(assets: Array<{ kind: string }>): 'video' | 'photo' | 'text' {
  return assets.some((asset) => asset.kind === 'video')
    ? 'video'
    : assets.length > 0
      ? 'photo'
      : 'text';
}

function normalizeDiscoveryText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function foldAsciiCharacter(character: string): string {
  return character >= 'A' && character <= 'Z'
    ? character.toLowerCase()
    : character;
}

function asciiInsensitiveIndexOf(value: string, query: string): number {
  const valueCharacters = [...value].map(foldAsciiCharacter);
  const queryCharacters = [...query].map(foldAsciiCharacter);
  const lastStart = valueCharacters.length - queryCharacters.length;
  for (let start = 0; start <= lastStart; start += 1) {
    if (queryCharacters.every((character, index) => (
      valueCharacters[start + index] === character
    ))) return start;
  }
  return -1;
}

function discoveryTags(row: EntryRow): string[] {
  return z.array(z.string()).parse(JSON.parse(row.tags_json));
}

function discoverySearchRank(row: DiscoveryEntryRow, query: string): number | null {
  const title = normalizeDiscoveryText(row.title ?? '');
  const content = normalizeDiscoveryText(row.content_text);
  const tags = discoveryTags(row).map(normalizeDiscoveryText);
  const terms = query.split(' ');
  const matchesEveryTerm = terms.every((term) => (
    asciiInsensitiveIndexOf(title, term) >= 0
    || asciiInsensitiveIndexOf(content, term) >= 0
    || tags.some(tag => asciiInsensitiveIndexOf(tag, term) >= 0)
  ));
  if (!matchesEveryTerm) return null;
  if (asciiInsensitiveIndexOf(title, query) >= 0) return 0;
  if (tags.some(tag => asciiInsensitiveIndexOf(tag, query) === 0
    && [...tag].length === [...query].length)) return 1;
  if (asciiInsensitiveIndexOf(content, query) >= 0) return 2;
  return 3;
}

function discoveryExcerpt(contentText: string, query: string | null): string {
  const content = normalizeDiscoveryText(contentText);
  const characters = [...content];
  const excerptLength = 120;
  if (characters.length <= excerptLength) return content;

  const bodyMatches = query === null
    ? []
    : [query, ...query.split(' ')]
        .map(term => asciiInsensitiveIndexOf(content, term))
        .filter(index => index >= 0);
  const matchIndex = bodyMatches.length === 0 ? 0 : Math.min(...bodyMatches);
  const start = Math.max(0, Math.min(matchIndex - 36, characters.length - 119));
  const hasPrefix = start > 0;
  const available = excerptLength - (hasPrefix ? 1 : 0);
  let end = Math.min(characters.length, start + available);
  if (end < characters.length) end -= 1;
  const hasSuffix = end < characters.length;
  return `${hasPrefix ? '…' : ''}${characters.slice(start, end).join('')}${hasSuffix ? '…' : ''}`;
}

function toDiscoveryEntrySummary(
  row: DiscoveryEntryRow,
  query: string | null,
): JournalDiscoveryEntrySummary {
  return {
    kind: 'entry',
    publicId: row.public_id,
    title: row.title,
    excerpt: discoveryExcerpt(row.content_text, query),
    channel: row.channel,
    entryType: row.body_format === 'rich' ? 'article' : 'record',
    contentType: row.content_type,
    tags: discoveryTags(row),
    visibility: row.visibility,
    sourceCreatedAt: row.source_created_at,
  };
}

export class JournalRepository {
  constructor(private readonly database: Database.Database) {}

  findBySource(chatId: string, sourceMessageId: number): JournalEntry | null {
    const row = this.database.prepare(`
      SELECT * FROM journal_entries
      WHERE chat_id = ? AND source_message_id = ?
    `).get(chatId, sourceMessageId) as EntryRow | undefined;
    return row ? this.toEntry(row) : null;
  }

  create(input: CreateJournalEntryInput): JournalEntry {
    const insert = this.database.transaction((entry: CreateJournalEntryInput) => {
      const result = this.database.prepare(`
        INSERT INTO journal_entries (
          public_id, source_kind, chat_id, source_message_id, media_group_id, content_type,
          title, body_format, rich_body_json, content_text,
          channel, visibility, tags_json, structured_content_json,
          telegram_message_json, source_created_at, captured_at, updated_at
        ) VALUES (?, 'telegram', ?, ?, ?, ?, NULL, 'plain', NULL, ?, 'life', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.publicId,
        entry.chatId,
        entry.parsed.sourceMessageId,
        entry.parsed.mediaGroupId,
        entry.parsed.contentType,
        entry.parsed.contentText,
        entry.visibility,
        JSON.stringify(entry.parsed.tags),
        entry.parsed.structuredContent === null
          ? null
          : JSON.stringify(entry.parsed.structuredContent),
        JSON.stringify(entry.message),
        entry.parsed.sourceCreatedAt,
        entry.capturedAt,
        entry.capturedAt,
      );
      const entryId = Number(result.lastInsertRowid);
      const insertAsset = this.database.prepare(`
        INSERT INTO journal_assets (
          entry_id, source_kind, role, kind, telegram_file_id, telegram_file_unique_id, original_name,
          mime_type, byte_size, relative_path, preview_relative_path, poster_relative_path,
          width, height, duration, sort_order
        ) VALUES (?, 'telegram', 'attachment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const asset of entry.assets) {
        insertAsset.run(
          entryId,
          asset.kind,
          asset.fileId,
          asset.fileUniqueId,
          asset.originalName,
          asset.mimeType,
          asset.byteSize,
          asset.relativePath,
          asset.previewRelativePath,
          asset.posterRelativePath,
          asset.width,
          asset.height,
          asset.duration,
          asset.sortOrder,
        );
      }
      return entryId;
    });

    const entryId = insert(input);
    return this.getById(entryId);
  }

  createArticle(input: CreateArticleInput): JournalEntry {
    const publicId = randomUUID();
    const now = new Date().toISOString();
    const insert = this.database.transaction(() => {
      const result = this.database.prepare(`
        INSERT INTO journal_entries (
          public_id, source_kind, chat_id, source_message_id, media_group_id, content_type,
          title, body_format, rich_body_json, content_text,
          channel, visibility, tags_json, structured_content_json, telegram_message_json,
          ai_generated, source_created_at, captured_at, updated_at
        ) VALUES (?, 'web', NULL, NULL, NULL, 'article', ?, 'rich', ?, ?, 'article', 'private', ?, NULL, NULL, ?, ?, ?, ?)
      `).run(
        publicId,
        input.title,
        input.richBodyJson,
        input.contentText,
        JSON.stringify(input.tags),
        input.aiGenerated ? 1 : 0,
        now,
        now,
        now,
      );
      return Number(result.lastInsertRowid);
    });
    const entryId = insert();
    return this.getById(entryId);
  }

  createWebEntry(input: CreateWebEntryInput): JournalEntry {
    const now = new Date().toISOString();
    const insert = this.database.transaction(() => {
      const result = this.database.prepare(`
        INSERT INTO journal_entries (
          public_id, source_kind, chat_id, source_message_id, media_group_id, content_type,
          title, body_format, rich_body_json, content_text, publication_status,
          channel, visibility, access_password_hash, access_revision,
          tags_json, structured_content_json, telegram_message_json,
          source_created_at, captured_at, updated_at
        ) VALUES (?, 'web', NULL, NULL, NULL, ?, ?, 'plain', NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
      `).run(
        input.publicId,
        contentTypeOf(input.assets),
        input.title,
        input.contentText,
        input.publicationStatus,
        input.channel,
        input.visibility,
        input.accessPasswordHash,
        input.visibility === 'protected' ? 1 : 0,
        JSON.stringify(input.tags),
        input.sourceCreatedAt,
        now,
        now,
      );
      const entryId = Number(result.lastInsertRowid);
      this.insertWebAttachments(entryId, input.assets, 0);
      return entryId;
    });
    return this.getById(insert());
  }

  updateWebDraft(id: number, input: UpdateWebDraftInput): JournalEntry {
    const update = this.database.transaction(() => {
      const assets = this.replaceWebEntryAssets(id, 'draft', input.removedAssetIds, input.newAssets);
      const result = this.database.prepare(`
        UPDATE journal_entries
        SET content_type = ?, title = ?, content_text = ?, tags_json = ?,
            channel = ?, updated_at = ?
        WHERE id = ?
          AND source_kind = 'web'
          AND body_format = 'plain'
          AND publication_status = 'draft'
      `).run(
        contentTypeOf(assets),
        input.title,
        input.contentText,
        JSON.stringify(input.tags),
        input.channel,
        input.updatedAt,
        id,
      );
      if (result.changes === 0) {
        throw new Error(`Journal entry ${id} was not found or is not a web draft.`);
      }
    });
    update();
    return this.getById(id);
  }

  publishWebDraft(id: number, input: PublishWebDraftInput): JournalEntry {
    const publish = this.database.transaction(() => {
      const assets = this.replaceWebEntryAssets(id, 'draft', input.removedAssetIds, input.newAssets);
      const result = this.database.prepare(`
        UPDATE journal_entries
        SET content_type = ?, title = ?, content_text = ?, tags_json = ?,
            channel = ?, publication_status = 'published', visibility = ?,
            access_password_hash = ?, access_revision = ?,
            source_created_at = ?, updated_at = ?
        WHERE id = ?
          AND source_kind = 'web'
          AND body_format = 'plain'
          AND publication_status = 'draft'
      `).run(
        contentTypeOf(assets),
        input.title,
        input.contentText,
        JSON.stringify(input.tags),
        input.channel,
        input.visibility,
        input.accessPasswordHash,
        input.visibility === 'protected' ? 1 : 0,
        input.sourceCreatedAt,
        input.updatedAt,
        id,
      );
      if (result.changes === 0) {
        throw new Error(`Journal entry ${id} was not found or is not a web draft.`);
      }
    });
    publish();
    return this.getById(id);
  }

  updatePublishedWebEntry(id: number, input: UpdatePublishedWebEntryInput): JournalEntry {
    const update = this.database.transaction(() => {
      const row = this.findRowById(id);
      if (
        !row
        || row.source_kind !== 'web'
        || row.body_format !== 'plain'
        || row.publication_status !== 'published'
      ) {
        throw new Error(`Published web entry ${id} was not found.`);
      }
      const assets = this.replaceWebEntryAssets(id, 'published', input.removedAssetIds, input.newAssets);
      const result = this.database.prepare(`
        UPDATE journal_entries
        SET content_type = ?, title = ?, content_text = ?, tags_json = ?, channel = ?,
            source_created_at = ?, updated_at = ?
        WHERE id = ? AND source_kind = 'web' AND body_format = 'plain'
          AND publication_status = 'published'
      `).run(
        contentTypeOf(assets),
        input.title,
        input.contentText,
        JSON.stringify(input.tags),
        input.channel,
        input.sourceCreatedAt,
        input.updatedAt,
        id,
      );
      if (result.changes === 0) throw new Error(`Published web entry ${id} was not found.`);
      this.updateAccess(row, input.visibility, input.accessPasswordHash);
    });
    update();
    return this.getById(id);
  }

  listWebDraftAssets(id: number): WebDraftAssetRecord[] {
    const rows = this.database.prepare(`
      SELECT a.id, a.relative_path, a.preview_relative_path, a.poster_relative_path
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE e.id = ?
        AND e.source_kind = 'web'
        AND e.body_format = 'plain'
        AND e.publication_status = 'draft'
        AND a.source_kind = 'web'
        AND a.role = 'attachment'
      ORDER BY a.sort_order, a.id
    `).all(id) as Array<{
      id: number;
      relative_path: string;
      preview_relative_path: string;
      poster_relative_path: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
      posterRelativePath: row.poster_relative_path,
    }));
  }

  listPublishedWebEntryAssets(id: number): WebDraftAssetRecord[] {
    const rows = this.database.prepare(`
      SELECT a.id, a.relative_path, a.preview_relative_path, a.poster_relative_path
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE e.id = ? AND e.source_kind = 'web' AND e.body_format = 'plain'
        AND e.publication_status = 'published'
        AND a.source_kind = 'web' AND a.role = 'attachment'
      ORDER BY a.sort_order, a.id
    `).all(id) as Array<{
      id: number;
      relative_path: string;
      preview_relative_path: string;
      poster_relative_path: string | null;
    }>;
    return rows.map(row => ({
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
      posterRelativePath: row.poster_relative_path,
    }));
  }

  updateArticle(id: number, input: UpdateArticleInput, removedAssetIds: number[]): JournalEntry {
    const update = this.database.transaction(() => {
      const result = this.database.prepare(`
        UPDATE journal_entries
        SET title = ?, rich_body_json = ?, content_text = ?, tags_json = ?,
            ai_generated = ?, updated_at = ?
        WHERE id = ? AND source_kind = 'web' AND body_format = 'rich'
          AND publication_status = 'published'
      `).run(
        input.title,
        input.richBodyJson,
        input.contentText,
        JSON.stringify(input.tags),
        input.aiGenerated ? 1 : 0,
        new Date().toISOString(),
        id,
      );
      if (result.changes === 0) {
        throw new Error(`Article ${id} was not found or is not a rich web entry.`);
      }
      this.deleteAssets(removedAssetIds);
    });
    update();
    return this.getById(id);
  }

  getArticleForEditing(id: number): JournalEntry | null {
    const row = this.database.prepare(`
      SELECT * FROM journal_entries
      WHERE id = ? AND source_kind = 'web' AND body_format = 'rich'
        AND publication_status = 'published'
    `).get(id) as EntryRow | undefined;
    return row ? this.toEntry(row) : null;
  }

  listInlineAssets(id: number): InlineAssetRecord[] {
    const rows = this.database.prepare(`
      SELECT id, relative_path, preview_relative_path, poster_relative_path
      FROM journal_assets
      WHERE entry_id = ? AND source_kind = 'web' AND role = 'inline'
      ORDER BY sort_order, id
    `).all(id) as Array<{
      id: number;
      relative_path: string;
      preview_relative_path: string;
      poster_relative_path: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
      posterRelativePath: row.poster_relative_path,
    }));
  }

  findCover(id: number): CoverAssetRecord | null {
    const row = this.database.prepare(`
      SELECT id, relative_path, preview_relative_path, poster_relative_path
      FROM journal_assets
      WHERE entry_id = ? AND source_kind = 'web' AND role = 'cover'
    `).get(id) as {
      id: number;
      relative_path: string;
      preview_relative_path: string;
      poster_relative_path: string | null;
    } | undefined;
    return row ? {
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
      posterRelativePath: row.poster_relative_path,
    } : null;
  }

  insertWebAsset(
    input: {
      entryId: number;
      role: JournalAssetRole;
      relativePath: string;
      previewRelativePath: string;
      posterRelativePath: string | null;
      kind: string;
      mimeType: string | null;
      originalName: string | null;
      byteSize: number;
      width?: number | null;
      height?: number | null;
      duration?: number | null;
      sortOrder: number;
    },
  ): number {
    const insert = this.database.transaction(() => {
      if (input.role === 'cover') {
        this.database.prepare(`
          DELETE FROM journal_assets
          WHERE entry_id = ? AND role = 'cover'
        `).run(input.entryId);
      }
      const result = this.database.prepare(`
        INSERT INTO journal_assets (
          entry_id, source_kind, role, kind, telegram_file_id, telegram_file_unique_id,
          original_name, mime_type, byte_size, relative_path, preview_relative_path,
          poster_relative_path, width, height, duration, sort_order
        ) VALUES (?, 'web', ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.entryId,
        input.role,
        input.kind,
        input.originalName,
        input.mimeType,
        input.byteSize,
        input.relativePath,
        input.previewRelativePath,
        input.posterRelativePath,
        input.width ?? null,
        input.height ?? null,
        input.duration ?? null,
        input.sortOrder,
      );
      return Number(result.lastInsertRowid);
    });
    return insert();
  }

  findWebAsset(id: number, assetId: number): AssetRow | null {
    const row = this.database.prepare(`
      SELECT a.*
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE a.id = ?
        AND a.entry_id = ?
        AND a.source_kind = 'web'
        AND e.source_kind = 'web'
        AND e.body_format = 'rich'
        AND e.publication_status = 'published'
    `).get(assetId, id) as AssetRow | undefined;
    return row ?? null;
  }

  deleteAssets(assetIds: number[]): void {
    if (assetIds.length === 0) return;
    const placeholders = assetIds.map(() => '?').join(', ');
    this.database.prepare(`DELETE FROM journal_assets WHERE id IN (${placeholders})`)
      .run(...assetIds);
  }

  updateVisibilityByPublicId(
    publicId: string,
    visibility: JournalVisibility,
    accessPasswordHash?: string,
  ): JournalEntry | null {
    const row = this.findRowByPublicId(publicId);
    if (!row || row.publication_status !== 'published') return null;
    this.updateAccess(row, visibility, accessPasswordHash);
    return this.getById(row.id);
  }

  updateVisibilityById(
    id: number,
    visibility: JournalVisibility,
    accessPasswordHash?: string,
  ): JournalEntry | null {
    const row = this.findRowById(id);
    if (!row || row.publication_status !== 'published') return null;
    this.updateAccess(row, visibility, accessPasswordHash);
    return this.getById(row.id);
  }

  updatePlainChannel(id: number, channel: JournalPlainChannel): JournalEntry | null {
    const row = this.findRowById(id);
    if (!row) return null;
    if (row.body_format !== 'plain') {
      throw new Error('Article entries cannot change channels.');
    }
    if (row.publication_status === 'draft') {
      this.database.prepare(`
        UPDATE journal_entries
        SET channel = ?, updated_at = ?
        WHERE id = ? AND publication_status = 'draft'
      `).run(channel, new Date().toISOString(), id);
    } else {
      this.updateGroup(row, 'channel = ?, updated_at = ?', [channel, new Date().toISOString()]);
    }
    return this.getById(row.id);
  }

  updateContent(id: number, contentText: string): JournalEntry | null {
    const tags = extractJournalTags(contentText);
    const result = this.database.prepare(`
      UPDATE journal_entries
      SET content_text = ?, tags_json = ?, updated_at = ?
      WHERE id = ? AND body_format = 'plain'
        AND publication_status = 'published'
    `).run(contentText, JSON.stringify(tags), new Date().toISOString(), id);
    return result.changes === 0 ? null : this.getById(id);
  }

  updatePinned(id: number, pinned: boolean): JournalEntry | null {
    const row = this.findRowById(id);
    if (!row || row.publication_status !== 'published') return null;
    this.updateGroup(row, 'pinned = ?, updated_at = ?', [pinned ? 1 : 0, new Date().toISOString()]);
    return this.getById(row.id);
  }

  updatePublishedTime(id: number, sourceCreatedAt: string): JournalEntry | null {
    const row = this.findRowById(id);
    if (!row || row.publication_status !== 'published') return null;
    this.updateGroup(
      row,
      'source_created_at = ?, updated_at = ?',
      [sourceCreatedAt, new Date().toISOString()],
    );
    return this.getById(row.id);
  }

  getPublicByPublicId(publicId: string): JournalEntry | null {
    const access = this.getPublishedAccessByPublicId(publicId);
    return access?.visibility === 'public' ? access.entry : null;
  }

  getPublishedAccessByPublicId(publicId: string): JournalPublishedAccess | null {
    const requested = this.findRowByPublicId(publicId);
    if (!requested) return null;
    const row = this.representativeRow(requested);
    if (row.publication_status !== 'published') return null;
    return {
      publicId: row.public_id,
      visibility: row.visibility,
      accessPasswordHash: row.access_password_hash,
      accessRevision: row.access_revision,
      entry: this.toEntry(row),
    };
  }

  getByIdOrNull(id: number): JournalEntry | null {
    const row = this.findRowById(id);
    return row ? this.toEntry(row) : null;
  }

  findDeletionTargetById(id: number): JournalDeletionTarget | null {
    const row = this.findRowById(id);
    return row ? this.deletionTarget(row) : null;
  }

  findDeletionTargetByPublicId(publicId: string): JournalDeletionTarget | null {
    const row = this.findRowByPublicId(publicId);
    return row ? this.deletionTarget(row) : null;
  }

  deleteTarget(target: JournalDeletionTarget): JournalDeletionResult {
    const entryIds = target.entries.map((entry) => entry.id);
    const placeholders = entryIds.map(() => '?').join(', ');
    const remove = this.database.transaction(() => {
      const assets = this.database.prepare(`
        DELETE FROM journal_assets WHERE entry_id IN (${placeholders})
      `).run(...entryIds);
      if (assets.changes !== target.assetCount) {
        throw new Error('Journal asset rows changed before deletion completed.');
      }

      const entries = this.database.prepare(`
        DELETE FROM journal_entries WHERE id IN (${placeholders})
      `).run(...entryIds);
      if (entries.changes !== entryIds.length) {
        throw new Error('Journal entry rows changed before deletion completed.');
      }

      return {
        deletedEntryCount: entries.changes,
        deletedAssetCount: assets.changes,
      };
    });
    return remove();
  }

  listPublicFeed(filters: {
    cursor?: string;
    channel: JournalChannel;
    tag?: string;
    limit: number;
    canReadProtectedContent: (publicId: string, accessRevision: number) => boolean;
  }): JournalFeed {
    const conditions = [
      this.groupRepresentativeCondition('e'),
      "e.publication_status = 'published'",
      "e.visibility IN ('public', 'protected')",
      'e.channel = ?',
    ];
    const parameters: unknown[] = [filters.channel];
    if (filters.tag) {
      conditions.push("e.visibility = 'public'");
      conditions.push('EXISTS (SELECT 1 FROM json_each(e.tags_json) WHERE value = ?)');
      parameters.push(filters.tag);
    }
    if (filters.cursor) {
      const cursor = decodeCursor(filters.cursor);
      conditions.push(`(
        e.pinned < ? OR
        (e.pinned = ? AND e.source_created_at < ?) OR
        (e.pinned = ? AND e.source_created_at = ? AND e.id < ?)
      )`);
      parameters.push(
        cursor.pinned,
        cursor.pinned,
        cursor.sourceCreatedAt,
        cursor.pinned,
        cursor.sourceCreatedAt,
        cursor.id,
      );
    }

    const rows = this.database.prepare(`
      SELECT e.* FROM journal_entries e
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.pinned DESC, e.source_created_at DESC, e.id DESC
      LIMIT ?
    `).all(...parameters, filters.limit + 1) as EntryRow[];
    const hasNext = rows.length > filters.limit;
    const pageRows = rows.slice(0, filters.limit);
    return {
      entries: pageRows.map((row) => row.visibility === 'protected'
        && !filters.canReadProtectedContent(row.public_id, row.access_revision)
        ? this.toProtectedPreview(row)
        : this.toEntry(row)),
      nextCursor: hasNext && pageRows.length > 0
        ? encodeCursor(pageRows[pageRows.length - 1] as EntryRow)
        : null,
    };
  }

  searchDiscovery(filters: {
    query: string;
    cursor?: string;
    limit: number;
    canReadProtectedContent: (publicId: string, accessRevision: number) => boolean;
  }): JournalDiscoverySearchResponse {
    const rows = this.database.prepare(`
      SELECT e.* FROM journal_entries e
      WHERE ${this.groupRepresentativeCondition('e')}
        AND e.publication_status = 'published'
        AND e.visibility IN ('public', 'protected')
    `).all() as DiscoveryEntryRow[];

    const matches: Array<{ row: DiscoveryEntryRow; rank: number }> = [];
    for (const row of rows) {
      const readable = row.visibility === 'public'
        || filters.canReadProtectedContent(row.public_id, row.access_revision);
      if (!readable) continue;
      const rank = discoverySearchRank(row, filters.query);
      if (rank !== null) matches.push({ row, rank });
    }
    matches.sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      if (left.row.source_created_at !== right.row.source_created_at) {
        return left.row.source_created_at < right.row.source_created_at ? 1 : -1;
      }
      return right.row.id - left.row.id;
    });

    const cursor = filters.cursor
      ? decodeDiscoverySearchCursor(filters.cursor)
      : null;
    if (cursor) z.literal(filters.query).parse(cursor.query);
    const remaining = cursor === null
      ? matches
      : matches.filter(({ row, rank }) => (
          rank > cursor.rank
          || (rank === cursor.rank && row.source_created_at < cursor.sourceCreatedAt)
          || (
            rank === cursor.rank
            && row.source_created_at === cursor.sourceCreatedAt
            && row.id < cursor.id
          )
        ));
    const hasNext = remaining.length > filters.limit;
    const pageRows = remaining.slice(0, filters.limit);
    const last = pageRows[pageRows.length - 1];
    return {
      entries: pageRows.map(({ row }) => toDiscoveryEntrySummary(row, filters.query)),
      nextCursor: hasNext && last
        ? encodeDiscoveryCursor({
            kind: 'discovery-search',
            query: filters.query,
            rank: last.rank,
            sourceCreatedAt: last.row.source_created_at,
            id: last.row.id,
          })
        : null,
    };
  }

  getDiscoveryArchiveOverview(): JournalDiscoveryArchiveOverview {
    const rows = this.database.prepare(`
      SELECT
        strftime('%Y', e.source_created_at, '+8 hours') AS year,
        strftime('%m', e.source_created_at, '+8 hours') AS month,
        COUNT(*) AS count
      FROM journal_entries e
      WHERE ${this.groupRepresentativeCondition('e')}
        AND e.publication_status = 'published'
        AND e.visibility IN ('public', 'protected')
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `).all() as Array<{ year: string; month: string; count: number }>;

    const years = new Map<number, JournalDiscoveryArchiveOverview['years'][number]>();
    for (const row of rows) {
      const year = Number(row.year);
      const month = Number(row.month);
      const existing = years.get(year);
      if (existing) {
        existing.months.push({ month, count: row.count });
      } else {
        years.set(year, { year, months: [{ month, count: row.count }] });
      }
    }
    return { years: [...years.values()] };
  }

  listDiscoveryArchiveMonth(filters: {
    year: number;
    month: number;
    cursor?: string;
    limit: number;
    canReadProtectedContent: (publicId: string, accessRevision: number) => boolean;
  }): JournalDiscoveryArchiveMonthResponse {
    const conditions = [
      this.groupRepresentativeCondition('e'),
      "e.publication_status = 'published'",
      "e.visibility IN ('public', 'protected')",
      "strftime('%Y', e.source_created_at, '+8 hours') = ?",
      "strftime('%m', e.source_created_at, '+8 hours') = ?",
    ];
    const parameters: unknown[] = [
      String(filters.year).padStart(4, '0'),
      String(filters.month).padStart(2, '0'),
    ];
    if (filters.cursor) {
      const cursor = decodeDiscoveryArchiveCursor(filters.cursor);
      z.literal(filters.year).parse(cursor.year);
      z.literal(filters.month).parse(cursor.month);
      conditions.push(`(
        e.source_created_at < ? OR
        (e.source_created_at = ? AND e.id < ?)
      )`);
      parameters.push(cursor.sourceCreatedAt, cursor.sourceCreatedAt, cursor.id);
    }

    const rows = this.database.prepare(`
      SELECT e.* FROM journal_entries e
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.source_created_at DESC, e.id DESC
      LIMIT ?
    `).all(...parameters, filters.limit + 1) as DiscoveryEntryRow[];
    const hasNext = rows.length > filters.limit;
    const pageRows = rows.slice(0, filters.limit);
    const last = pageRows[pageRows.length - 1];
    return {
      entries: pageRows.map((row) => row.visibility === 'protected'
        && !filters.canReadProtectedContent(row.public_id, row.access_revision)
        ? this.toProtectedPreview(row)
        : toDiscoveryEntrySummary(row, null)),
      nextCursor: hasNext && last
        ? encodeDiscoveryCursor({
            kind: 'discovery-archive',
            year: filters.year,
            month: filters.month,
            sourceCreatedAt: last.source_created_at,
            id: last.id,
          })
        : null,
    };
  }

  list(filters: JournalListFilters): JournalEntryFeed {
    const { conditions, parameters } = this.listFilterConditions(filters);
    if (filters.cursor) {
      const cursor = decodeCursor(filters.cursor);
      conditions.push(`(
        e.pinned < ? OR
        (e.pinned = ? AND e.source_created_at < ?) OR
        (e.pinned = ? AND e.source_created_at = ? AND e.id < ?)
      )`);
      parameters.push(
        cursor.pinned,
        cursor.pinned,
        cursor.sourceCreatedAt,
        cursor.pinned,
        cursor.sourceCreatedAt,
        cursor.id,
      );
    }

    const rows = this.database.prepare(`
      SELECT e.* FROM journal_entries e
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.pinned DESC, e.source_created_at DESC, e.id DESC
      LIMIT ?
    `).all(...parameters, filters.limit + 1) as EntryRow[];
    const hasNext = rows.length > filters.limit;
    const pageRows = rows.slice(0, filters.limit);

    return {
      entries: pageRows.map((row) => this.toEntry(row)),
      nextCursor: hasNext && pageRows.length > 0
        ? encodeCursor(pageRows[pageRows.length - 1] as EntryRow)
        : null,
    };
  }

  listPage(filters: JournalPageFilters): JournalPage {
    const { conditions, parameters } = this.listFilterConditions(filters);
    const offset = (filters.page - 1) * filters.pageSize;

    const totalRow = this.database.prepare(`
      SELECT COUNT(*) AS count
      FROM journal_entries e
      WHERE ${conditions.join(' AND ')}
    `).get(...parameters) as { count: number };

    const rows = this.database.prepare(`
      SELECT e.* FROM journal_entries e
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.pinned DESC, e.source_created_at DESC, e.id DESC
      LIMIT ? OFFSET ?
    `).all(...parameters, filters.pageSize, offset) as EntryRow[];

    return {
      entries: rows.map((row) => this.toEntry(row)),
      page: filters.page,
      pageSize: filters.pageSize,
      total: totalRow.count,
    };
  }

  private listFilterConditions(filters: {
    visibility?: JournalVisibility;
    channel?: JournalChannel;
    tag?: string;
    query?: string;
    contentType?: string;
    from?: string;
    to?: string;
  }): { conditions: string[]; parameters: unknown[] } {
    const conditions = [this.groupRepresentativeCondition('e')];
    const parameters: unknown[] = [];

    if (filters.visibility) {
      conditions.push('e.visibility = ?');
      parameters.push(filters.visibility);
    }
    if (filters.visibility === 'public') {
      conditions.push("e.publication_status = 'published'");
    }
    if (filters.channel) {
      conditions.push('e.channel = ?');
      parameters.push(filters.channel);
    }
    if (filters.tag) {
      conditions.push('EXISTS (SELECT 1 FROM json_each(e.tags_json) WHERE value = ?)');
      parameters.push(filters.tag);
    }
    if (filters.query) {
      conditions.push('(e.title LIKE ? OR e.content_text LIKE ?)');
      const like = `%${filters.query}%`;
      parameters.push(like, like);
    }
    if (filters.contentType) {
      conditions.push('e.content_type = ?');
      parameters.push(filters.contentType);
    }
    if (filters.from) {
      conditions.push('e.source_created_at >= ?');
      parameters.push(filters.from);
    }
    if (filters.to) {
      conditions.push('e.source_created_at <= ?');
      parameters.push(filters.to);
    }

    return { conditions, parameters };
  }

  listOnThisDay(monthDay: string, currentYear: string): JournalEntry[] {
    const rows = this.database.prepare(`
      SELECT e.* FROM journal_entries e
      WHERE strftime('%m-%d', e.source_created_at, '+8 hours') = ?
        AND strftime('%Y', e.source_created_at, '+8 hours') < ?
        AND e.publication_status = 'published'
        AND ${this.groupRepresentativeCondition('e')}
      ORDER BY e.source_created_at DESC, e.id DESC
    `).all(monthDay, currentYear) as EntryRow[];
    return rows.map((row) => this.toEntry(row));
  }

  getAssetAccess(assetId: number): JournalAssetAccess | null {
    const row = this.database.prepare(`
      SELECT
        a.id, a.kind, a.relative_path, a.preview_relative_path, a.poster_relative_path,
        a.original_name, a.mime_type, a.byte_size,
        representative.visibility,
        representative.public_id,
        representative.access_revision
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      JOIN journal_entries representative ON representative.id = CASE
        WHEN e.media_group_id IS NULL THEN e.id
        ELSE (
          SELECT grouped.id
          FROM journal_entries grouped
          WHERE grouped.chat_id = e.chat_id
            AND grouped.media_group_id = e.media_group_id
          ORDER BY grouped.source_message_id, grouped.id
          LIMIT 1
        )
      END
      WHERE a.id = ?
    `).get(assetId) as {
      id: number;
      kind: string;
      relative_path: string;
      preview_relative_path: string | null;
      poster_relative_path: string | null;
      original_name: string | null;
      mime_type: string | null;
      byte_size: number | null;
      visibility: JournalVisibility;
      public_id: string;
      access_revision: number;
    } | undefined;
    return row ? {
      id: row.id,
      kind: row.kind,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
      posterRelativePath: row.poster_relative_path,
      originalName: row.original_name,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      visibility: row.visibility,
      publicId: row.public_id,
      accessRevision: row.access_revision,
    } : null;
  }

  listImageAssetsMissingPreview(): JournalImagePreviewBackfillAsset[] {
    const rows = this.database.prepare(`
      SELECT id, relative_path
      FROM journal_assets
      WHERE preview_relative_path IS NULL
        AND (
          kind = 'photo'
          OR (kind IN ('sticker', 'animation') AND mime_type LIKE 'image/%')
        )
      ORDER BY id
    `).all() as Array<{ id: number; relative_path: string }>;
    return rows.map((row) => ({ id: row.id, relativePath: row.relative_path }));
  }

  completeImagePreviewBackfill(
    assetId: number,
    previewRelativePath: string,
    width: number,
    height: number,
  ): void {
    const result = this.database.prepare(`
      UPDATE journal_assets
      SET preview_relative_path = ?,
          width = COALESCE(width, ?),
          height = COALESCE(height, ?)
      WHERE id = ? AND preview_relative_path IS NULL
    `).run(previewRelativePath, width, height, assetId);
    if (result.changes !== 1) {
      throw new Error(`Journal asset ${assetId} preview state changed before backfill completed.`);
    }
  }

  listAnimatedAssetsMissingPoster(): JournalPosterBackfillAsset[] {
    const rows = this.database.prepare(`
      SELECT id, relative_path
      FROM journal_assets
      WHERE poster_relative_path IS NULL
        AND kind = 'animation'
        AND mime_type LIKE 'image/%'
      ORDER BY id
    `).all() as Array<{ id: number; relative_path: string }>;
    return rows.map((row) => ({ id: row.id, relativePath: row.relative_path }));
  }

  completePosterBackfill(assetId: number, posterRelativePath: string): void {
    const result = this.database.prepare(`
      UPDATE journal_assets
      SET poster_relative_path = ?
      WHERE id = ? AND poster_relative_path IS NULL
    `).run(posterRelativePath, assetId);
    if (result.changes !== 1) {
      throw new Error(`Journal asset ${assetId} poster state changed before backfill completed.`);
    }
  }

  listVideoAssetsMissingPreview(): JournalVideoPreviewBackfillAsset[] {
    const rows = this.database.prepare(`
      SELECT id, relative_path
      FROM journal_assets
      WHERE preview_relative_path IS NULL
        AND (
          kind IN ('video', 'video_note')
          OR (
            kind = 'animation'
            AND (mime_type IS NULL OR mime_type NOT LIKE 'image/%')
          )
          OR (kind = 'sticker' AND mime_type LIKE 'video/%')
        )
      ORDER BY id
    `).all() as Array<{ id: number; relative_path: string }>;
    return rows.map((row) => ({ id: row.id, relativePath: row.relative_path }));
  }

  completeVideoPreviewBackfill(assetId: number, previewRelativePath: string): void {
    const result = this.database.prepare(`
      UPDATE journal_assets
      SET preview_relative_path = ?
      WHERE id = ? AND preview_relative_path IS NULL
    `).run(previewRelativePath, assetId);
    if (result.changes !== 1) {
      throw new Error(
        `Journal video asset ${assetId} preview state changed before backfill completed.`,
      );
    }
  }

  findContributionLinkByTokenHash(tokenHash: string): JournalContributionLinkRecord | null {
    const row = this.database.prepare(`
      SELECT id, token_hash, expires_at, revoked_at, created_at
      FROM journal_contribution_links
      WHERE token_hash = ?
    `).get(tokenHash) as ContributionLinkRow | undefined;
    return row ? this.toContributionLink(row) : null;
  }

  getActiveContributionLink(now: string): JournalContributionLinkRecord | null {
    const row = this.database.prepare(`
      SELECT id, token_hash, expires_at, revoked_at, created_at
      FROM journal_contribution_links
      WHERE revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(now) as ContributionLinkRow | undefined;
    return row ? this.toContributionLink(row) : null;
  }

  createContributionLink(
    tokenHash: string,
    expiresAt: string | null,
    createdAt: string,
  ): JournalContributionLinkRecord {
    const insert = this.database.transaction(() => {
      this.database.prepare(`
        UPDATE journal_contribution_links
        SET revoked_at = ?
        WHERE revoked_at IS NULL
      `).run(createdAt);
      const result = this.database.prepare(`
        INSERT INTO journal_contribution_links (
          token_hash, expires_at, revoked_at, created_at
        ) VALUES (?, ?, NULL, ?)
      `).run(tokenHash, expiresAt, createdAt);
      return Number(result.lastInsertRowid);
    });
    const id = insert();
    const row = this.database.prepare(`
      SELECT id, token_hash, expires_at, revoked_at, created_at
      FROM journal_contribution_links
      WHERE id = ?
    `).get(id) as ContributionLinkRow;
    return this.toContributionLink(row);
  }

  revokeActiveContributionLink(revokedAt: string): boolean {
    const result = this.database.prepare(`
      UPDATE journal_contribution_links
      SET revoked_at = ?
      WHERE revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
    `).run(revokedAt, revokedAt);
    return result.changes > 0;
  }

  createContribution(input: CreateJournalContributionInput): JournalContributionDetail {
    const insert = this.database.transaction(() => {
      const result = this.database.prepare(`
        INSERT INTO journal_contributions (
          public_id, link_id, sender_name, content_text,
          submitted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.publicId,
        input.linkId,
        input.senderName,
        input.contentText,
        input.submittedAt,
        input.submittedAt,
        input.submittedAt,
      );
      const contributionId = Number(result.lastInsertRowid);
      const insertAsset = this.database.prepare(`
        INSERT INTO journal_contribution_assets (
          contribution_id, kind, source_name, mime_type, byte_size,
          relative_path, preview_relative_path, width, height,
          duration, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const asset of input.assets) {
        insertAsset.run(
          contributionId,
          asset.kind,
          asset.sourceName,
          asset.mimeType,
          asset.byteSize,
          asset.relativePath,
          asset.previewRelativePath,
          asset.width,
          asset.height,
          asset.duration,
          asset.sortOrder,
          input.submittedAt,
        );
      }
      return contributionId;
    });
    const contributionId = insert();
    return this.getContributionDetailById(contributionId);
  }

  listContributions(): {
    contributions: JournalContributionSummary[];
    pendingCount: number;
  } {
    const rows = this.database.prepare(`
      SELECT *
      FROM journal_contributions
      ORDER BY submitted_at DESC, id DESC
    `).all() as ContributionRow[];
    return {
      contributions: rows.map((row) => {
        const assets = this.contributionAssetsFor(row.id);
        return {
          publicId: row.public_id,
          senderName: row.sender_name,
          contentText: row.content_text,
          submittedAt: row.submitted_at,
          photoCount: assets.filter((asset) => asset.kind === 'photo').length,
          videoCount: assets.filter((asset) => asset.kind === 'video').length,
          assets: assets.slice(0, 4).map((asset) => this.toContributionAsset(row, asset)),
        };
      }),
      pendingCount: rows.length,
    };
  }

  getContribution(publicId: string): JournalContributionDetail | null {
    const row = this.findContributionRow(publicId);
    return row ? this.toContributionDetail(row) : null;
  }

  findContributionStoredAsset(
    publicId: string,
    assetId: number,
  ): JournalContributionStoredAsset | null {
    const row = this.database.prepare(`
      SELECT a.*
      FROM journal_contribution_assets a
      JOIN journal_contributions c ON c.id = a.contribution_id
      WHERE c.public_id = ? AND a.id = ?
    `).get(publicId, assetId) as ContributionAssetRow | undefined;
    return row ? {
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
    } : null;
  }

  deleteContributionAsset(publicId: string, assetId: number): JournalContributionDetail | null {
    const result = this.database.prepare(`
      DELETE FROM journal_contribution_assets
      WHERE id = ?
        AND contribution_id = (
          SELECT id FROM journal_contributions WHERE public_id = ?
        )
    `).run(assetId, publicId);
    if (result.changes === 0) return null;
    const contribution = this.getContribution(publicId);
    if (!contribution) {
      throw new Error(`Contribution ${publicId} disappeared while deleting an asset.`);
    }
    return contribution;
  }

  deleteContribution(publicId: string): boolean {
    const remove = this.database.transaction(() => {
      const row = this.findContributionRow(publicId);
      if (!row) return false;
      this.database.prepare(`
        DELETE FROM journal_contribution_assets
        WHERE contribution_id = ?
      `).run(row.id);
      const result = this.database.prepare(`
        DELETE FROM journal_contributions
        WHERE id = ?
      `).run(row.id);
      return result.changes === 1;
    });
    return remove();
  }

  publishContribution(
    publicId: string,
    input: {
      contentText: string;
      assetIds: number[];
      sourceCreatedAt: string;
      visibility: JournalVisibility;
      updatedAt: string;
    },
  ): JournalEntry | null {
    const publish = this.database.transaction(() => {
      const contribution = this.findContributionRow(publicId);
      if (!contribution) return null;
      const assets = this.contributionAssetsFor(contribution.id);
      const byId = new Map(assets.map((asset) => [asset.id, asset]));
      const selectedAssets = input.assetIds.map((assetId) => {
        const asset = byId.get(assetId);
        if (!asset) {
          throw new Error(`Contribution asset ${assetId} does not belong to ${publicId}.`);
        }
        return asset;
      });
      if (selectedAssets.length !== assets.length) {
        throw new Error('Contribution assets must be deleted before publishing.');
      }

      const contentType = contentTypeOf(selectedAssets);
      const entryResult = this.database.prepare(`
        INSERT INTO journal_entries (
          public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          publication_status, channel, visibility, tags_json, structured_content_json,
          telegram_message_json, pinned, source_created_at, captured_at, updated_at
        ) VALUES (
          ?, 'web', NULL, NULL, NULL,
          ?, NULL, 'plain', ?, NULL,
          'published', 'life', ?, ?, NULL,
          NULL, 0, ?, ?, ?
        )
      `).run(
        contribution.public_id,
        contentType,
        input.contentText,
        input.visibility,
        JSON.stringify(extractJournalTags(input.contentText)),
        input.sourceCreatedAt,
        contribution.submitted_at,
        input.updatedAt,
      );
      const entryId = Number(entryResult.lastInsertRowid);
      const insertAsset = this.database.prepare(`
        INSERT INTO journal_assets (
          entry_id, source_kind, role, kind,
          telegram_file_id, telegram_file_unique_id,
          original_name, mime_type, byte_size,
          relative_path, preview_relative_path,
          width, height, duration, sort_order
        ) VALUES (
          ?, 'web', 'attachment', ?,
          NULL, NULL,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?
        )
      `);
      selectedAssets.forEach((asset, sortOrder) => {
        insertAsset.run(
          entryId,
          asset.kind,
          asset.source_name,
          asset.mime_type,
          asset.byte_size,
          asset.relative_path,
          asset.preview_relative_path,
          asset.width,
          asset.height,
          asset.duration,
          sortOrder,
        );
      });
      this.database.prepare(`
        DELETE FROM journal_contribution_assets
        WHERE contribution_id = ?
      `).run(contribution.id);
      this.database.prepare(`
        DELETE FROM journal_contributions
        WHERE id = ?
      `).run(contribution.id);
      return entryId;
    });
    const entryId = publish();
    return entryId === null ? null : this.getById(entryId);
  }

  getSiteProfileOrNull(): JournalSiteProfileRecord | null {
    const row = this.database.prepare(`
      SELECT bio, avatar_webp, avatar_revision, weather_enabled, channel_tags_json,
             about_intro, contact_items_json, updated_at
      FROM journal_site_profile
      WHERE id = 1
    `).get() as SiteProfileRow | undefined;
    return row ? this.toSiteProfile(row) : null;
  }

  initializeSiteProfile(bio: string, avatarWebp: Buffer, updatedAt: string): void {
    this.database.prepare(`
      INSERT INTO journal_site_profile (
        id, bio, avatar_webp, avatar_revision, updated_at
      ) VALUES (1, ?, ?, 1, ?)
    `).run(bio, avatarWebp, updatedAt);
  }

  updateSiteProfile(input: {
    bio: string;
    avatarWebp: Buffer | null;
    weatherEnabled: boolean;
    channelTags: JournalChannelTags;
    aboutIntro: string;
    contactItems: JournalSiteContactItem[];
    updatedAt: string;
  }): JournalSiteProfileRecord {
    const update = this.database.transaction(() => {
      const result = input.avatarWebp === null
        ? this.database.prepare(`
            UPDATE journal_site_profile
            SET bio = ?, weather_enabled = ?, channel_tags_json = ?,
                about_intro = ?, contact_items_json = ?, updated_at = ?
            WHERE id = 1
          `).run(
            input.bio,
            Number(input.weatherEnabled),
            JSON.stringify(input.channelTags),
            input.aboutIntro,
            JSON.stringify(input.contactItems),
            input.updatedAt,
          )
        : this.database.prepare(`
            UPDATE journal_site_profile
            SET bio = ?,
                avatar_webp = ?,
                avatar_revision = avatar_revision + 1,
                weather_enabled = ?,
                channel_tags_json = ?,
                about_intro = ?,
                contact_items_json = ?,
                updated_at = ?
            WHERE id = 1
          `).run(
            input.bio,
            input.avatarWebp,
            Number(input.weatherEnabled),
            JSON.stringify(input.channelTags),
            input.aboutIntro,
            JSON.stringify(input.contactItems),
            input.updatedAt,
          );
      if (result.changes !== 1) {
        throw new Error('Journal site profile was not initialized.');
      }
    });
    update();
    return this.getRequiredSiteProfile();
  }

  getResumeOrNull(): JournalResumeRecord | null {
    const row = this.database.prepare(`
      SELECT format, original_name, content, rendered_html, access_mode,
             access_password_hash, access_grant_id, access_revision, revision, updated_at
      FROM journal_site_resume
      WHERE id = 1
    `).get() as {
      format: JournalResumeFormat;
      original_name: string;
      content: Buffer;
      rendered_html: string | null;
      access_mode: JournalResumeAccessMode;
      access_password_hash: string | null;
      access_grant_id: string;
      access_revision: number;
      revision: number;
      updated_at: string;
    } | undefined;
    return row ? {
      format: row.format,
      originalName: row.original_name,
      content: row.content,
      renderedHtml: row.rendered_html,
      accessMode: row.access_mode,
      accessPasswordHash: row.access_password_hash,
      accessGrantId: row.access_grant_id,
      accessRevision: row.access_revision,
      revision: row.revision,
      updatedAt: row.updated_at,
    } : null;
  }

  getResumeShareLinkOrNull(): JournalResumeShareLinkRecord | null {
    const row = this.database.prepare(`
      SELECT token_hash, expires_at, created_at
      FROM journal_resume_share_link
      WHERE id = 1
    `).get() as {
      token_hash: string;
      expires_at: string;
      created_at: string;
    } | undefined;
    return row ? {
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    } : null;
  }

  saveResume(input: {
    format: JournalResumeFormat;
    originalName: string;
    content: Buffer;
    renderedHtml: string | null;
    previewPages: JournalResumePreviewPageRecord[];
    accessGrantId: string;
    updatedAt: string;
  }): JournalResumeRecord {
    const save = this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO journal_site_resume (
          id, format, original_name, content, rendered_html,
          access_mode, access_password_hash, access_grant_id,
          access_revision, revision, updated_at
        ) VALUES (1, ?, ?, ?, ?, 'private', NULL, ?, 1, 1, ?)
        ON CONFLICT(id) DO UPDATE SET
          format = excluded.format,
          original_name = excluded.original_name,
          content = excluded.content,
          rendered_html = excluded.rendered_html,
          revision = journal_site_resume.revision + 1,
          updated_at = excluded.updated_at
      `).run(
        input.format,
        input.originalName,
        input.content,
        input.renderedHtml,
        input.accessGrantId,
        input.updatedAt,
      );
      this.replaceResumePreviewPagesInTransaction(input.previewPages);
    });
    save();
    const record = this.getResumeOrNull();
    if (!record) throw new Error('Journal resume was not stored.');
    return record;
  }

  listResumePreviewPageMetadata(): JournalResumePreviewPageMetadata[] {
    const rows = this.database.prepare(`
      SELECT page_number, width, height
      FROM journal_resume_preview_pages
      ORDER BY page_number ASC
    `).all() as Array<{
      page_number: number;
      width: number;
      height: number;
    }>;
    return rows.map(row => ({
      pageNumber: row.page_number,
      width: row.width,
      height: row.height,
    }));
  }

  hasCompleteResumePreviewPages(): boolean {
    const row = this.database.prepare(`
      SELECT
        COUNT(*) AS page_count,
        COUNT(content_dark_webp) AS dark_page_count
      FROM journal_resume_preview_pages
    `).get() as {
      page_count: number;
      dark_page_count: number;
    };
    return row.page_count > 0 && row.page_count === row.dark_page_count;
  }

  getResumePreviewPageOrNull(pageNumber: number): JournalResumePreviewPageRecord | null {
    const row = this.database.prepare(`
      SELECT page_number, content_webp, content_dark_webp, width, height
      FROM journal_resume_preview_pages
      WHERE page_number = ?
    `).get(pageNumber) as {
      page_number: number;
      content_webp: Buffer;
      content_dark_webp: Buffer | null;
      width: number;
      height: number;
    } | undefined;
    if (!row) return null;
    if (!row.content_dark_webp) {
      throw new Error(`Dark resume preview page ${pageNumber} is missing.`);
    }
    return {
      pageNumber: row.page_number,
      contentLightWebp: row.content_webp,
      contentDarkWebp: row.content_dark_webp,
      width: row.width,
      height: row.height,
    };
  }

  replaceResumePreviewPages(pages: JournalResumePreviewPageRecord[]): void {
    this.database.transaction(() => {
      this.replaceResumePreviewPagesInTransaction(pages);
    })();
  }

  updateResumeAccess(input: UpdateResumeAccessInput): JournalResumeRecord {
    const update = this.database.transaction(() => {
      this.database.prepare(`
        UPDATE journal_site_resume
        SET access_mode = ?, access_password_hash = ?, access_grant_id = ?,
            access_revision = access_revision + 1, updated_at = ?
        WHERE id = 1
      `).run(
        input.accessMode,
        input.accessPasswordHash,
        input.accessGrantId,
        input.updatedAt,
      );
      if (
        input.accessMode === 'temporary'
        && input.tokenHash !== null
        && input.shareExpiresAt !== null
      ) {
        this.database.prepare(`
          INSERT INTO journal_resume_share_link (id, token_hash, expires_at, created_at)
          VALUES (1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            token_hash = excluded.token_hash,
            expires_at = excluded.expires_at,
            created_at = excluded.created_at
        `).run(input.tokenHash, input.shareExpiresAt, input.updatedAt);
      } else {
        this.database.prepare('DELETE FROM journal_resume_share_link WHERE id = 1').run();
      }
    });
    update();
    const record = this.getResumeOrNull();
    if (!record) throw new Error('Journal resume was not found.');
    return record;
  }

  deleteResume(): void {
    const remove = this.database.transaction(() => {
      this.database.prepare('DELETE FROM journal_resume_share_link WHERE id = 1').run();
      this.database.prepare('DELETE FROM journal_resume_preview_pages').run();
      this.database.prepare('DELETE FROM journal_site_resume WHERE id = 1').run();
    });
    remove();
  }

  private replaceResumePreviewPagesInTransaction(
    pages: JournalResumePreviewPageRecord[],
  ): void {
    this.database.prepare('DELETE FROM journal_resume_preview_pages').run();
    const insert = this.database.prepare(`
      INSERT INTO journal_resume_preview_pages (
        page_number, content_webp, content_dark_webp, width, height
      ) VALUES (?, ?, ?, ?, ?)
    `);
    for (const page of pages) {
      insert.run(
        page.pageNumber,
        page.contentLightWebp,
        page.contentDarkWebp,
        page.width,
        page.height,
      );
    }
  }

  private getById(id: number): JournalEntry {
    const row = this.findRowById(id);
    if (!row) throw new Error(`Journal entry ${id} does not exist.`);
    return this.toEntry(row);
  }

  private findRowById(id: number): EntryRow | undefined {
    return this.database.prepare('SELECT * FROM journal_entries WHERE id = ?')
      .get(id) as EntryRow | undefined;
  }

  private findRowByPublicId(publicId: string): EntryRow | undefined {
    return this.database.prepare('SELECT * FROM journal_entries WHERE public_id = ?')
      .get(publicId) as EntryRow | undefined;
  }

  private representativeRow(row: EntryRow): EntryRow {
    if (row.media_group_id === null) return row;
    const representative = this.database.prepare(`
      SELECT * FROM journal_entries
      WHERE chat_id = ? AND media_group_id = ?
      ORDER BY source_message_id, id
      LIMIT 1
    `).get(row.chat_id, row.media_group_id) as EntryRow | undefined;
    if (!representative) {
      throw new Error(`Journal media group ${row.media_group_id} does not have an entry.`);
    }
    return representative;
  }

  private updateAccess(
    sourceRow: EntryRow,
    visibility: JournalVisibility,
    accessPasswordHash?: string,
  ): void {
    const row = this.representativeRow(sourceRow);
    const updatedAt = new Date().toISOString();
    if (visibility !== 'protected') {
      if (accessPasswordHash !== undefined) {
        throw new Error('Only protected Journal entries accept an access password.');
      }
      this.updateGroup(
        row,
        'visibility = ?, access_password_hash = NULL, updated_at = ?',
        [visibility, updatedAt],
      );
      return;
    }

    if (accessPasswordHash === undefined) {
      if (row.visibility !== 'protected') {
        throw new Error('Protected Journal entries require a 6-digit access password.');
      }
      this.updateGroup(row, 'visibility = ?, updated_at = ?', [visibility, updatedAt]);
      return;
    }

    this.updateGroup(
      row,
      `visibility = ?, access_password_hash = ?,
       access_revision = access_revision + 1, updated_at = ?`,
      [visibility, accessPasswordHash, updatedAt],
    );
  }

  private updateGroup(row: EntryRow, assignments: string, parameters: unknown[]): void {
    if (row.media_group_id === null) {
      this.database.prepare(`
        UPDATE journal_entries SET ${assignments}
        WHERE id = ? AND publication_status = 'published'
      `)
        .run(...parameters, row.id);
      return;
    }
    this.database.prepare(`
      UPDATE journal_entries SET ${assignments}
      WHERE chat_id = ? AND media_group_id = ?
        AND publication_status = 'published'
    `).run(...parameters, row.chat_id, row.media_group_id);
  }

  private replaceWebEntryAssets(
    id: number,
    publicationStatus: JournalPublicationStatus,
    removedAssetIds: number[],
    newAssets: WebEntryAssetInput[],
  ): Array<{ kind: string }> {
    if (removedAssetIds.length > 0) {
      const placeholders = removedAssetIds.map(() => '?').join(', ');
      const result = this.database.prepare(`
        DELETE FROM journal_assets
        WHERE id IN (${placeholders})
          AND entry_id = ?
          AND source_kind = 'web'
          AND role = 'attachment'
          AND EXISTS (
            SELECT 1
            FROM journal_entries e
            WHERE e.id = journal_assets.entry_id
              AND e.source_kind = 'web'
              AND e.body_format = 'plain'
              AND e.publication_status = ?
          )
      `).run(...removedAssetIds, id, publicationStatus);
      if (result.changes !== removedAssetIds.length) {
        throw new Error(`One or more assets do not belong to web draft ${id}.`);
      }
    }

    const existingRows = this.database.prepare(`
      SELECT a.id, a.kind
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE a.entry_id = ?
        AND a.source_kind = 'web'
        AND a.role = 'attachment'
        AND e.source_kind = 'web'
        AND e.body_format = 'plain'
        AND e.publication_status = ?
      ORDER BY a.sort_order, a.id
    `).all(id, publicationStatus) as Array<{ id: number; kind: string }>;
    const updateSortOrder = this.database.prepare(`
      UPDATE journal_assets SET sort_order = ? WHERE id = ?
    `);
    existingRows.forEach((row, index) => {
      updateSortOrder.run(index, row.id);
    });
    this.insertWebAttachments(id, newAssets, existingRows.length);
    return [
      ...existingRows.map((row) => ({ kind: row.kind })),
      ...newAssets.map((asset) => ({ kind: asset.kind })),
    ];
  }

  private insertWebAttachments(
    entryId: number,
    assets: WebEntryAssetInput[],
    startingSortOrder: number,
  ): void {
    const insertAsset = this.database.prepare(`
      INSERT INTO journal_assets (
        entry_id, source_kind, role, kind, telegram_file_id, telegram_file_unique_id,
        original_name, mime_type, byte_size, relative_path, preview_relative_path,
        poster_relative_path, width, height, duration, sort_order
      ) VALUES (?, 'web', 'attachment', ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    assets.forEach((asset, index) => {
      insertAsset.run(
        entryId,
        asset.kind,
        asset.originalName,
        asset.mimeType,
        asset.byteSize,
        asset.relativePath,
        asset.previewRelativePath,
        asset.posterRelativePath,
        asset.width,
        asset.height,
        asset.duration ?? null,
        asset.sortOrder ?? startingSortOrder + index,
      );
    });
  }

  private deletionTarget(row: EntryRow): JournalDeletionTarget {
    const entries = row.media_group_id === null
      ? [row]
      : this.database.prepare(`
          SELECT * FROM journal_entries
          WHERE chat_id = ? AND media_group_id = ?
          ORDER BY source_message_id, id
        `).all(row.chat_id, row.media_group_id) as EntryRow[];
    const entryIds = entries.map((entry) => entry.id);
    const placeholders = entryIds.map(() => '?').join(', ');
    const assets = this.database.prepare(`
      SELECT entry_id, relative_path
      FROM journal_assets
      WHERE entry_id IN (${placeholders})
      ORDER BY entry_id, sort_order, id
    `).all(...entryIds) as Array<{ entry_id: number; relative_path: string }>;

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        publicId: entry.public_id,
        assetRelativePaths: assets
          .filter((asset) => asset.entry_id === entry.id)
          .map((asset) => asset.relative_path),
      })),
      assetCount: assets.length,
    };
  }

  private toEntry(row: EntryRow): JournalEntry {
    const assets = this.assetsFor(row);
    const richBody = row.rich_body_json === null
      ? null
      : journalRichDocumentSchema.parse(JSON.parse(row.rich_body_json)) as JournalRichDocument;
    return {
      id: row.id,
      publicId: row.public_id,
      sourceKind: row.source_kind,
      contentType: row.content_type,
      title: row.title,
      bodyFormat: row.body_format,
      richBody,
      contentText: row.content_text,
      publicationStatus: row.publication_status,
      channel: row.channel,
      visibility: row.visibility,
      tags: z.array(z.string()).parse(JSON.parse(row.tags_json)),
      pinned: row.pinned === 1,
      aiGenerated: row.ai_generated === 1,
      structuredContent: parseStructuredContent(row.structured_content_json),
      sourceCreatedAt: row.source_created_at,
      capturedAt: row.captured_at,
      updatedAt: row.updated_at,
      assets: assets.map((asset) => ({
        id: asset.id,
        sourceKind: asset.source_kind,
        role: asset.role,
        kind: asset.kind,
        url: `/media/${asset.id}`,
        previewUrl: asset.preview_relative_path === null
          ? null
          : `/media/${asset.id}/preview`,
        posterUrl: asset.poster_relative_path === null
          ? null
          : `/media/${asset.id}/poster`,
        originalName: asset.original_name,
        mimeType: asset.mime_type,
        byteSize: asset.byte_size,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
      })),
    };
  }

  private toProtectedPreview(row: EntryRow): JournalProtectedEntryPreview {
    return {
      kind: 'protected',
      publicId: row.public_id,
      channel: row.channel,
      entryType: row.body_format === 'rich' ? 'article' : 'record',
      sourceCreatedAt: row.source_created_at,
    };
  }

  private assetsFor(row: EntryRow): AssetRow[] {
    if (row.media_group_id === null) {
      return this.database.prepare(`
        SELECT id, source_kind, role, kind, original_name, mime_type, byte_size,
               relative_path, preview_relative_path, poster_relative_path,
               width, height, duration
        FROM journal_assets
        WHERE entry_id = ?
        ORDER BY sort_order, id
      `).all(row.id) as AssetRow[];
    }
    return this.database.prepare(`
      SELECT a.id, a.source_kind, a.role, a.kind, a.original_name, a.mime_type, a.byte_size,
             a.relative_path, a.preview_relative_path, a.poster_relative_path,
             a.width, a.height, a.duration
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE e.chat_id = ? AND e.media_group_id = ?
      ORDER BY e.source_message_id, a.sort_order, a.id
    `).all(row.chat_id, row.media_group_id) as AssetRow[];
  }

  private groupRepresentativeCondition(alias: string): string {
    return `(
      ${alias}.media_group_id IS NULL OR
      ${alias}.source_message_id = (
        SELECT MIN(grouped.source_message_id)
        FROM journal_entries grouped
        WHERE grouped.chat_id = ${alias}.chat_id
          AND grouped.media_group_id = ${alias}.media_group_id
      )
    )`;
  }

  private findContributionRow(publicId: string): ContributionRow | undefined {
    return this.database.prepare(`
      SELECT *
      FROM journal_contributions
      WHERE public_id = ?
    `).get(publicId) as ContributionRow | undefined;
  }

  private getContributionDetailById(id: number): JournalContributionDetail {
    const row = this.database.prepare(`
      SELECT *
      FROM journal_contributions
      WHERE id = ?
    `).get(id) as ContributionRow | undefined;
    if (!row) throw new Error(`Contribution ${id} does not exist.`);
    return this.toContributionDetail(row);
  }

  private contributionAssetsFor(contributionId: number): ContributionAssetRow[] {
    return this.database.prepare(`
      SELECT *
      FROM journal_contribution_assets
      WHERE contribution_id = ?
      ORDER BY sort_order, id
    `).all(contributionId) as ContributionAssetRow[];
  }

  private toContributionDetail(row: ContributionRow): JournalContributionDetail {
    return {
      publicId: row.public_id,
      senderName: row.sender_name,
      contentText: row.content_text,
      submittedAt: row.submitted_at,
      assets: this.contributionAssetsFor(row.id)
        .map((asset) => this.toContributionAsset(row, asset)),
    };
  }

  private toContributionAsset(
    contribution: ContributionRow,
    asset: ContributionAssetRow,
  ): JournalContributionAsset {
    const assetUrl = `/api/private/contributions/${contribution.public_id}/assets/${asset.id}`;
    return {
      id: asset.id,
      kind: asset.kind,
      url: assetUrl,
      previewUrl: `${assetUrl}/preview`,
      sourceName: asset.source_name,
      mimeType: asset.mime_type,
      byteSize: asset.byte_size,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
      sortOrder: asset.sort_order,
    };
  }

  private toContributionLink(row: ContributionLinkRow): JournalContributionLinkRecord {
    return {
      id: row.id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    };
  }

  private getRequiredSiteProfile(): JournalSiteProfileRecord {
    const profile = this.getSiteProfileOrNull();
    if (!profile) throw new Error('Journal site profile was not initialized.');
    return profile;
  }

  private toSiteProfile(row: SiteProfileRow): JournalSiteProfileRecord {
    return {
      bio: row.bio,
      avatarWebp: row.avatar_webp,
      avatarRevision: row.avatar_revision,
      weatherEnabled: row.weather_enabled === 1,
      channelTags: journalChannelTagsSchema.parse(JSON.parse(row.channel_tags_json)),
      aboutIntro: row.about_intro,
      contactItems: journalSiteContactItemsSchema.parse(JSON.parse(row.contact_items_json)),
      updatedAt: row.updated_at,
    };
  }
}
