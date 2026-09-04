import type Database from 'better-sqlite3';
import type { GuestbookStatus } from '../shared/guestbookProtocol.js';

export interface GuestbookRow {
  id: number;
  parentId: number | null;
  authorRole: 'visitor' | 'owner';
  authorName: string;
  contentMarkdown: string;
  status: GuestbookStatus;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GuestbookDbRow {
  id: number;
  parent_id: number | null;
  author_role: 'visitor' | 'owner';
  author_name: string;
  content_markdown: string;
  status: GuestbookStatus;
  pinned: 0 | 1;
  created_at: string;
  updated_at: string;
}

function compareTopLevelRows(a: GuestbookDbRow, b: GuestbookDbRow): number {
  if (a.pinned !== b.pinned) return b.pinned - a.pinned;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return b.id - a.id;
}

function compareReplyRows(a: GuestbookDbRow, b: GuestbookDbRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id - b.id;
}

export class GuestbookRepository {
  private readonly ownerMessageName = '小明同学';

  constructor(private readonly database: Database.Database) {}

  listPublicRows(): GuestbookRow[] {
    const topLevel = (this.database.prepare(`
      SELECT * FROM journal_guestbook_messages
      WHERE parent_id IS NULL AND status = 'published'
    `).all() as GuestbookDbRow[]).sort(compareTopLevelRows);
    const replies = (this.database.prepare(`
      SELECT * FROM journal_guestbook_messages
      WHERE parent_id IS NOT NULL
        AND status = 'published'
        AND parent_id IN (
          SELECT id FROM journal_guestbook_messages
          WHERE parent_id IS NULL AND status = 'published'
        )
    `).all() as GuestbookDbRow[]).sort(compareReplyRows);
    return [...topLevel, ...replies].map(row => this.toRow(row));
  }

  listAdminRows(): GuestbookRow[] {
    const topLevel = (this.database.prepare(`
      SELECT * FROM journal_guestbook_messages
      WHERE parent_id IS NULL
    `).all() as GuestbookDbRow[]).sort(compareTopLevelRows);
    const replies = (this.database.prepare(`
      SELECT * FROM journal_guestbook_messages
      WHERE parent_id IS NOT NULL
    `).all() as GuestbookDbRow[]).sort(compareReplyRows);
    return [...topLevel, ...replies].map(row => this.toRow(row));
  }

  getRow(id: number): GuestbookRow | null {
    const row = this.database.prepare(
      'SELECT * FROM journal_guestbook_messages WHERE id = ?',
    ).get(id) as GuestbookDbRow | undefined;
    return row ? this.toRow(row) : null;
  }

  createVisitor(input: {
    authorName: string;
    contentMarkdown: string;
    createdAt: string;
  }): GuestbookRow {
    const result = this.database.prepare(`
      INSERT INTO journal_guestbook_messages (
        parent_id, author_role, author_name, content_markdown,
        status, pinned, created_at, updated_at
      ) VALUES (NULL, 'visitor', ?, ?, 'published', 0, ?, ?)
    `).run(
      input.authorName,
      input.contentMarkdown,
      input.createdAt,
      input.createdAt,
    );
    return this.getRow(Number(result.lastInsertRowid))!;
  }

  createOwnerReply(input: {
    parentId: number;
    contentMarkdown: string;
    createdAt: string;
  }): GuestbookRow {
    const result = this.database.prepare(`
      INSERT INTO journal_guestbook_messages (
        parent_id, author_role, author_name, content_markdown,
        status, pinned, created_at, updated_at
      ) VALUES (?, 'owner', ?, ?, 'published', 0, ?, ?)
    `).run(
      input.parentId,
      this.ownerMessageName,
      input.contentMarkdown,
      input.createdAt,
      input.createdAt,
    );
    return this.getRow(Number(result.lastInsertRowid))!;
  }

  updateStatus(id: number, status: GuestbookStatus, updatedAt: string): GuestbookRow | null {
    this.database.prepare(`
      UPDATE journal_guestbook_messages
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, updatedAt, id);
    return this.getRow(id);
  }

  updatePinned(id: number, pinned: boolean, updatedAt: string): GuestbookRow | null {
    this.database.prepare(`
      UPDATE journal_guestbook_messages
      SET pinned = ?, updated_at = ?
      WHERE id = ?
    `).run(pinned ? 1 : 0, updatedAt, id);
    return this.getRow(id);
  }

  delete(id: number): boolean {
    const result = this.database.prepare(
      'DELETE FROM journal_guestbook_messages WHERE id = ?',
    ).run(id);
    return result.changes > 0;
  }

  private toRow(row: GuestbookDbRow): GuestbookRow {
    return {
      id: row.id,
      parentId: row.parent_id,
      authorRole: row.author_role,
      authorName: row.author_name,
      contentMarkdown: row.content_markdown,
      status: row.status,
      pinned: row.pinned === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
