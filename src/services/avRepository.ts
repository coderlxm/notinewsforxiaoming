import { getDb } from '../reminders/db.js';

export interface TrackedTarget {
  id: number;
  name: string;
  source: 'javbus';
  target_type: 'star' | 'label';
  target_id: string;
  updated_at: string;
}

export interface PushHistoryRow {
  id: number;
  target_id: number;
  item_guid: string;
  cover_sent: number;
  pushed_at: string;
}

export interface PushBatchHistoryRow {
  id: number;
  dedupe_key: string;
  pushed_at: string;
}

export interface AvSourceHealthRow {
  source_key: string;
  status: 'up' | 'down';
  last_error_type: string | null;
  last_error_message: string | null;
  last_error_at: string | null;
  last_alert_at: string | null;
  last_recovered_at: string | null;
  updated_at: string;
}

export function findTrackedTargets(): TrackedTarget[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM tracked_targets
    WHERE source = 'javbus'
    ORDER BY id ASC
  `);
  return stmt.all() as TrackedTarget[];
}

export function findPushHistory(targetId: number, itemGuid: string): PushHistoryRow | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM push_history
    WHERE target_id = ? AND item_guid = ?
    LIMIT 1
  `);
  return (stmt.get(targetId, itemGuid) as PushHistoryRow) ?? null;
}

export function createPushHistory(targetId: number, itemGuid: string, coverSent: boolean): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO push_history (target_id, item_guid, cover_sent, pushed_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(targetId, itemGuid, coverSent ? 1 : 0, new Date().toISOString());
}

export function markCoverSent(pushHistoryId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE push_history
    SET cover_sent = 1
    WHERE id = ?
  `);
  stmt.run(pushHistoryId);
}

export function findPushBatchHistory(dedupeKey: string): PushBatchHistoryRow | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM push_batch_history
    WHERE dedupe_key = ?
    LIMIT 1
  `);
  return (stmt.get(dedupeKey) as PushBatchHistoryRow) ?? null;
}

export function createPushBatchHistory(dedupeKey: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO push_batch_history (dedupe_key, pushed_at)
    VALUES (?, ?)
  `);
  stmt.run(dedupeKey, new Date().toISOString());
}

export function findAvSourceHealth(sourceKey: string): AvSourceHealthRow | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM av_source_health
    WHERE source_key = ?
    LIMIT 1
  `);
  return (stmt.get(sourceKey) as AvSourceHealthRow) ?? null;
}

export function upsertAvSourceDown(sourceKey: string, errorType: string, errorMessage: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO av_source_health (
      source_key, status, last_error_type, last_error_message, last_error_at, updated_at
    )
    VALUES (?, 'down', ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      status = 'down',
      last_error_type = excluded.last_error_type,
      last_error_message = excluded.last_error_message,
      last_error_at = excluded.last_error_at,
      updated_at = excluded.updated_at
  `);
  stmt.run(sourceKey, errorType, errorMessage, now, now);
}

export function updateAvSourceLastAlertAt(sourceKey: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE av_source_health
    SET last_alert_at = ?, updated_at = ?
    WHERE source_key = ?
  `);
  stmt.run(now, now, sourceKey);
}

export function markAvSourceRecovered(sourceKey: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO av_source_health (
      source_key, status, last_recovered_at, updated_at
    )
    VALUES (?, 'up', ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      status = 'up',
      last_recovered_at = excluded.last_recovered_at,
      updated_at = excluded.updated_at
  `);
  stmt.run(sourceKey, now, now);
}
