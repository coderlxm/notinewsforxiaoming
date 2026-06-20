import { getDb } from '../reminders/db.js';

export interface V2exBufferBatch {
  id: number;
  batch_date: string;
  source: string;
  is_holiday: number;
  consumed: number;
  created_at: string;
}

export interface V2exBufferItem {
  id: number;
  batch_id: number;
  topic_id: string | null;
  topic_url: string;
  title: string;
  author: string | null;
  reply_count: number;
  created_at: string;
}

export function createV2exHolidayBatch(batchDate: string): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO v2ex_buffer_batches (batch_date, source, is_holiday, consumed, created_at)
    VALUES (?, 'v2ex', 1, 0, ?)
  `);
  const result = stmt.run(batchDate, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function insertV2exBatchItems(
  batchId: number,
  items: Array<{ topicId: string | null; topicUrl: string; title: string; author: string | null; replyCount: number }>
): void {
  if (items.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO v2ex_buffer_items (batch_id, topic_id, topic_url, title, author, reply_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    for (const item of items) {
      stmt.run(batchId, item.topicId, item.topicUrl, item.title, item.author, item.replyCount, now);
    }
  });
  tx();
}

export function findUnconsumedV2exHolidayBatches(): V2exBufferBatch[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM v2ex_buffer_batches
    WHERE consumed = 0 AND is_holiday = 1 AND source = 'v2ex'
    ORDER BY batch_date ASC, id ASC
  `);
  return stmt.all() as V2exBufferBatch[];
}

export function findV2exItemsByBatchIds(batchIds: number[]): V2exBufferItem[] {
  if (batchIds.length === 0) return [];
  const db = getDb();
  const placeholders = batchIds.map(() => '?').join(', ');
  const stmt = db.prepare(`
    SELECT *
    FROM v2ex_buffer_items
    WHERE batch_id IN (${placeholders})
    ORDER BY batch_id ASC, id ASC
  `);
  return stmt.all(...batchIds) as V2exBufferItem[];
}

export function markV2exBatchesConsumed(batchIds: number[]): void {
  if (batchIds.length === 0) return;
  const db = getDb();
  const placeholders = batchIds.map(() => '?').join(', ');
  const stmt = db.prepare(`
    UPDATE v2ex_buffer_batches
    SET consumed = 1
    WHERE id IN (${placeholders})
  `);
  stmt.run(...batchIds);
}
