import type Database from 'better-sqlite3';
import { z } from 'zod';
import type {
  JournalDeletionResult,
  JournalEntry,
  JournalFeed,
  JournalVisibility,
} from '../shared/journalProtocol.js';
import type {
  CreateJournalEntryInput,
  JournalAssetAccess,
  JournalDeletionTarget,
  JournalListFilters,
} from './types.js';

interface EntryRow {
  id: number;
  public_id: string;
  chat_id: string;
  source_message_id: number;
  media_group_id: string | null;
  content_type: string;
  content_text: string;
  visibility: JournalVisibility;
  tags_json: string;
  structured_content_json: string | null;
  pinned: 0 | 1;
  source_created_at: string;
  captured_at: string;
  updated_at: string;
}

interface AssetRow {
  id: number;
  kind: string;
  original_name: string | null;
  mime_type: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
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
          public_id, chat_id, source_message_id, media_group_id, content_type,
          content_text, visibility, tags_json, structured_content_json,
          telegram_message_json, source_created_at, captured_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          entry_id, kind, telegram_file_id, telegram_file_unique_id, original_name,
          mime_type, byte_size, relative_path, width, height, duration, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  updateVisibilityByPublicId(publicId: string, visibility: JournalVisibility): JournalEntry | null {
    const row = this.findRowByPublicId(publicId);
    if (!row) return null;
    this.updateGroup(row, 'visibility = ?, updated_at = ?', [visibility, new Date().toISOString()]);
    return this.getById(row.id);
  }

  updateVisibilityById(id: number, visibility: JournalVisibility): JournalEntry | null {
    const row = this.findRowById(id);
    if (!row) return null;
    this.updateGroup(row, 'visibility = ?, updated_at = ?', [visibility, new Date().toISOString()]);
    return this.getById(row.id);
  }

  updateContent(id: number, contentText: string): JournalEntry | null {
    const tags = [...new Set(
      [...contentText.matchAll(/#([\p{L}\p{N}_]+)/gu)]
        .map((match) => match[1])
        .filter((tag): tag is string => Boolean(tag)),
    )];
    const result = this.database.prepare(`
      UPDATE journal_entries
      SET content_text = ?, tags_json = ?, updated_at = ?
      WHERE id = ?
    `).run(contentText, JSON.stringify(tags), new Date().toISOString(), id);
    return result.changes === 0 ? null : this.getById(id);
  }

  updatePinned(id: number, pinned: boolean): JournalEntry | null {
    const row = this.findRowById(id);
    if (!row) return null;
    this.updateGroup(row, 'pinned = ?, updated_at = ?', [pinned ? 1 : 0, new Date().toISOString()]);
    return this.getById(row.id);
  }

  getPublicByPublicId(publicId: string): JournalEntry | null {
    const row = this.database.prepare(`
      SELECT * FROM journal_entries
      WHERE public_id = ? AND visibility = 'public'
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
    if (filters.tag) {
      conditions.push('EXISTS (SELECT 1 FROM json_each(e.tags_json) WHERE value = ?)');
      parameters.push(filters.tag);
    }
    if (filters.query) {
      conditions.push('e.content_text LIKE ?');
      parameters.push(`%${filters.query}%`);
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
        AND ${this.groupRepresentativeCondition('e')}
      ORDER BY e.source_created_at DESC, e.id DESC
    `).all(monthDay, currentYear) as EntryRow[];
    return rows.map((row) => this.toEntry(row));
  }

  getAssetAccess(assetId: number): JournalAssetAccess | null {
    const row = this.database.prepare(`
      SELECT
        a.id, a.kind, a.relative_path, a.original_name, a.mime_type, a.byte_size,
        e.visibility
      FROM journal_assets a
      JOIN journal_entries e ON e.id = a.entry_id
      WHERE a.id = ?
    `).get(assetId) as {
      id: number;
      kind: string;
      relative_path: string;
      original_name: string | null;
      mime_type: string | null;
      byte_size: number | null;
      visibility: JournalVisibility;
    } | undefined;
    return row ? {
      id: row.id,
      kind: row.kind,
      relativePath: row.relative_path,
      originalName: row.original_name,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      visibility: row.visibility,
    } : null;
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
      this.database.prepare(`UPDATE journal_entries SET ${assignments} WHERE id = ?`)
        .run(...parameters, row.id);
      return;
    }
    this.database.prepare(`
      UPDATE journal_entries SET ${assignments}
      WHERE chat_id = ? AND media_group_id = ?
    `).run(...parameters, row.chat_id, row.media_group_id);
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
    return {
      id: row.id,
      publicId: row.public_id,
      contentType: row.content_type,
      contentText: row.content_text,
      visibility: row.visibility,
      tags: z.array(z.string()).parse(JSON.parse(row.tags_json)),
      pinned: row.pinned === 1,
      structuredContent: parseStructuredContent(row.structured_content_json),
      sourceCreatedAt: row.source_created_at,
      capturedAt: row.captured_at,
      updatedAt: row.updated_at,
      assets: assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        url: `/media/${asset.id}`,
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
        SELECT id, kind, original_name, mime_type, byte_size, width, height, duration
        FROM journal_assets
        WHERE entry_id = ?
        ORDER BY sort_order, id
      `).all(row.id) as AssetRow[];
    }
    return this.database.prepare(`
      SELECT a.id, a.kind, a.original_name, a.mime_type, a.byte_size,
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
}
