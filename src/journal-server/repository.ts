import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import type {
  JournalAssetRole,
  JournalAssetSourceKind,
  JournalBodyFormat,
  JournalDeletionResult,
  JournalEntry,
  JournalFeed,
  JournalPublicationStatus,
  JournalRichDocument,
  JournalSourceKind,
  JournalVisibility,
} from '../shared/journalProtocol.js';
import { journalRichDocumentSchema } from '../shared/journalProtocol.js';
import type {
  CreateJournalEntryInput,
  JournalAssetAccess,
  JournalDeletionTarget,
  JournalImagePreviewBackfillAsset,
  JournalListFilters,
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
  visibility: JournalVisibility;
  tags_json: string;
  structured_content_json: string | null;
  telegram_message_json: string | null;
  pinned: 0 | 1;
  source_created_at: string;
  captured_at: string;
  updated_at: string;
}

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
}

export interface CreateArticleInput {
  title: string;
  richBodyJson: string;
  tags: string[];
  contentText: string;
}

export interface UpdateArticleInput {
  title: string;
  richBodyJson: string;
  tags: string[];
  contentText: string;
}

export interface WebEntryAssetInput {
  relativePath: string;
  previewRelativePath: string;
  kind: string;
  mimeType: string;
  originalName: string | null;
  byteSize: number;
  width: number;
  height: number;
  duration?: number | null;
}

export interface CreateWebEntryInput {
  publicId: string;
  contentText: string;
  tags: string[];
  publicationStatus: JournalPublicationStatus;
  visibility: JournalVisibility;
  sourceCreatedAt: string;
  assets: WebEntryAssetInput[];
}

export interface UpdateWebDraftInput {
  contentText: string;
  tags: string[];
  updatedAt: string;
  removedAssetIds: number[];
  newAssets: WebEntryAssetInput[];
}

export interface PublishWebDraftInput extends UpdateWebDraftInput {
  visibility: JournalVisibility;
  sourceCreatedAt: string;
}

export interface WebDraftAssetRecord {
  id: number;
  relativePath: string;
  previewRelativePath: string;
}

export interface InlineAssetRecord {
  id: number;
  relativePath: string;
  previewRelativePath: string;
}

export interface CoverAssetRecord {
  id: number;
  relativePath: string;
  previewRelativePath: string;
}

const cursorSchema = z.object({
  pinned: z.union([z.literal(0), z.literal(1)]),
  sourceCreatedAt: z.string().datetime(),
  id: z.number().int().positive(),
});

type Cursor = z.infer<typeof cursorSchema>;

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
          visibility, tags_json, structured_content_json,
          telegram_message_json, source_created_at, captured_at, updated_at
        ) VALUES (?, 'telegram', ?, ?, ?, ?, NULL, 'plain', NULL, ?, ?, ?, ?, ?, ?, ?, ?)
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
          mime_type, byte_size, relative_path, preview_relative_path,
          width, height, duration, sort_order
        ) VALUES (?, 'telegram', 'attachment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          visibility, tags_json, structured_content_json, telegram_message_json,
          source_created_at, captured_at, updated_at
        ) VALUES (?, 'web', NULL, NULL, NULL, 'article', ?, 'rich', ?, ?, 'private', ?, NULL, NULL, ?, ?, ?)
      `).run(
        publicId,
        input.title,
        input.richBodyJson,
        input.contentText,
        JSON.stringify(input.tags),
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
    const insert = this.database.transaction(() => {
      const result = this.database.prepare(`
        INSERT INTO journal_entries (
          public_id, source_kind, chat_id, source_message_id, media_group_id, content_type,
          title, body_format, rich_body_json, content_text, publication_status,
          visibility, tags_json, structured_content_json, telegram_message_json,
          source_created_at, captured_at, updated_at
        ) VALUES (?, 'web', NULL, NULL, NULL, ?, NULL, 'plain', NULL, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
      `).run(
        input.publicId,
        input.assets.length === 0 ? 'text' : 'photo',
        input.contentText,
        input.publicationStatus,
        input.visibility,
        JSON.stringify(input.tags),
        input.sourceCreatedAt,
        input.sourceCreatedAt,
        input.sourceCreatedAt,
      );
      const entryId = Number(result.lastInsertRowid);
      this.insertWebAttachments(entryId, input.assets, 0);
      return entryId;
    });
    return this.getById(insert());
  }

  updateWebDraft(id: number, input: UpdateWebDraftInput): JournalEntry {
    const update = this.database.transaction(() => {
      const assetCount = this.replaceWebDraftAssets(id, input.removedAssetIds, input.newAssets);
      const result = this.database.prepare(`
        UPDATE journal_entries
        SET content_type = ?, content_text = ?, tags_json = ?, updated_at = ?
        WHERE id = ?
          AND source_kind = 'web'
          AND body_format = 'plain'
          AND publication_status = 'draft'
      `).run(
        assetCount === 0 ? 'text' : 'photo',
        input.contentText,
        JSON.stringify(input.tags),
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
      const assetCount = this.replaceWebDraftAssets(id, input.removedAssetIds, input.newAssets);
      const result = this.database.prepare(`
        UPDATE journal_entries
        SET content_type = ?, content_text = ?, tags_json = ?,
            publication_status = 'published', visibility = ?,
            source_created_at = ?, updated_at = ?
        WHERE id = ?
          AND source_kind = 'web'
          AND body_format = 'plain'
          AND publication_status = 'draft'
      `).run(
        assetCount === 0 ? 'text' : 'photo',
        input.contentText,
        JSON.stringify(input.tags),
        input.visibility,
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

  listWebDraftAssets(id: number): WebDraftAssetRecord[] {
    const rows = this.database.prepare(`
      SELECT a.id, a.relative_path, a.preview_relative_path
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
    }>;
    return rows.map((row) => ({
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
    }));
  }

  updateArticle(id: number, input: UpdateArticleInput, removedAssetIds: number[]): JournalEntry {
    const update = this.database.transaction(() => {
      const result = this.database.prepare(`
        UPDATE journal_entries
        SET title = ?, rich_body_json = ?, content_text = ?, tags_json = ?, updated_at = ?
        WHERE id = ? AND source_kind = 'web' AND body_format = 'rich'
          AND publication_status = 'published'
      `).run(
        input.title,
        input.richBodyJson,
        input.contentText,
        JSON.stringify(input.tags),
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
      SELECT id, relative_path, preview_relative_path
      FROM journal_assets
      WHERE entry_id = ? AND source_kind = 'web' AND role = 'inline'
      ORDER BY sort_order, id
    `).all(id) as Array<{
      id: number;
      relative_path: string;
      preview_relative_path: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
    }));
  }

  findCover(id: number): CoverAssetRecord | null {
    const row = this.database.prepare(`
      SELECT id, relative_path, preview_relative_path
      FROM journal_assets
      WHERE entry_id = ? AND source_kind = 'web' AND role = 'cover'
    `).get(id) as {
      id: number;
      relative_path: string;
      preview_relative_path: string;
    } | undefined;
    return row ? {
      id: row.id,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
    } : null;
  }

  insertWebAsset(
    input: {
      entryId: number;
      role: JournalAssetRole;
      relativePath: string;
      previewRelativePath: string;
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
          width, height, duration, sort_order
        ) VALUES (?, 'web', ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.entryId,
        input.role,
        input.kind,
        input.originalName,
        input.mimeType,
        input.byteSize,
        input.relativePath,
        input.previewRelativePath,
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

  updateVisibilityByPublicId(publicId: string, visibility: JournalVisibility): JournalEntry | null {
    const row = this.findRowByPublicId(publicId);
    if (!row || row.publication_status !== 'published') return null;
    this.updateGroup(row, 'visibility = ?, updated_at = ?', [visibility, new Date().toISOString()]);
    return this.getById(row.id);
  }

  updateVisibilityById(id: number, visibility: JournalVisibility): JournalEntry | null {
    const row = this.findRowById(id);
    if (!row || row.publication_status !== 'published') return null;
    this.updateGroup(row, 'visibility = ?, updated_at = ?', [visibility, new Date().toISOString()]);
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
    const row = this.database.prepare(`
      SELECT * FROM journal_entries
      WHERE public_id = ?
        AND visibility = 'public'
        AND publication_status = 'published'
    `).get(publicId) as EntryRow | undefined;
    return row ? this.toEntry(row) : null;
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

  list(filters: JournalListFilters): JournalFeed {
    const conditions = [this.groupRepresentativeCondition('e')];
    const parameters: unknown[] = [];

    if (filters.visibility) {
      conditions.push('e.visibility = ?');
      parameters.push(filters.visibility);
    }
    if (filters.visibility === 'public') {
      conditions.push("e.publication_status = 'published'");
    }
    if (filters.tag) {
      conditions.push('EXISTS (SELECT 1 FROM json_each(e.tags_json) WHERE instr(value, ?) > 0)');
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
        a.id, a.kind, a.relative_path, a.preview_relative_path,
        a.original_name, a.mime_type, a.byte_size,
        e.visibility
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE a.id = ?
    `).get(assetId) as {
      id: number;
      kind: string;
      relative_path: string;
      preview_relative_path: string | null;
      original_name: string | null;
      mime_type: string | null;
      byte_size: number | null;
      visibility: JournalVisibility;
    } | undefined;
    return row ? {
      id: row.id,
      kind: row.kind,
      relativePath: row.relative_path,
      previewRelativePath: row.preview_relative_path,
      originalName: row.original_name,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      visibility: row.visibility,
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

  private replaceWebDraftAssets(
    id: number,
    removedAssetIds: number[],
    newAssets: WebEntryAssetInput[],
  ): number {
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
              AND e.publication_status = 'draft'
          )
      `).run(...removedAssetIds, id);
      if (result.changes !== removedAssetIds.length) {
        throw new Error(`One or more assets do not belong to web draft ${id}.`);
      }
    }

    const existingRows = this.database.prepare(`
      SELECT a.id
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE a.entry_id = ?
        AND a.source_kind = 'web'
        AND a.role = 'attachment'
        AND e.source_kind = 'web'
        AND e.body_format = 'plain'
        AND e.publication_status = 'draft'
      ORDER BY a.sort_order, a.id
    `).all(id) as Array<{ id: number }>;
    const updateSortOrder = this.database.prepare(`
      UPDATE journal_assets SET sort_order = ? WHERE id = ?
    `);
    existingRows.forEach((row, index) => {
      updateSortOrder.run(index, row.id);
    });
    this.insertWebAttachments(id, newAssets, existingRows.length);
    return existingRows.length + newAssets.length;
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
        width, height, duration, sort_order
      ) VALUES (?, 'web', 'attachment', ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        asset.width,
        asset.height,
        asset.duration ?? null,
        startingSortOrder + index,
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
      visibility: row.visibility,
      tags: z.array(z.string()).parse(JSON.parse(row.tags_json)),
      pinned: row.pinned === 1,
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
        originalName: asset.original_name,
        mimeType: asset.mime_type,
        byteSize: asset.byte_size,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
      })),
    };
  }

  private assetsFor(row: EntryRow): AssetRow[] {
    if (row.media_group_id === null) {
      return this.database.prepare(`
        SELECT id, source_kind, role, kind, original_name, mime_type, byte_size,
               relative_path, preview_relative_path, width, height, duration
        FROM journal_assets
        WHERE entry_id = ?
        ORDER BY sort_order, id
      `).all(row.id) as AssetRow[];
    }
    return this.database.prepare(`
      SELECT a.id, a.source_kind, a.role, a.kind, a.original_name, a.mime_type, a.byte_size,
             a.relative_path, a.preview_relative_path, a.width, a.height, a.duration
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
}
