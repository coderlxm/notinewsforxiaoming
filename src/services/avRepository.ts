import { getDb } from '../reminders/db.js';
import type { AvTargetType } from './avTargets.js';

export interface TrackedTarget {
  id: number;
  name: string;
  source: 'javbus';
  target_type: AvTargetType;
  target_id: string;
  updated_at: string;
}

interface CreateTrackedTargetInput {
  name: string;
  source?: 'javbus';
  target_type: AvTargetType;
  target_id: string;
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

export function findTrackedTargetById(id: number): TrackedTarget | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM tracked_targets
    WHERE id = ?
    LIMIT 1
  `);
  return (stmt.get(id) as TrackedTarget) ?? null;
}

export function findTrackedTargetByKey(
  source: 'javbus',
  targetType: AvTargetType,
  targetId: string
): TrackedTarget | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM tracked_targets
    WHERE source = ? AND target_type = ? AND target_id = ?
    LIMIT 1
  `);
  return (stmt.get(source, targetType, targetId) as TrackedTarget) ?? null;
}

export function createTrackedTarget(input: CreateTrackedTargetInput): TrackedTarget {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tracked_targets (name, source, target_type, target_id, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  const result = stmt.run(
    input.name,
    input.source ?? 'javbus',
    input.target_type,
    input.target_id,
    now
  );

  const target = findTrackedTargetById(Number(result.lastInsertRowid));
  if (!target) {
    throw new Error('Failed to create tracked AV target.');
  }
  return target;
}

export function deleteTrackedTargetById(id: number): TrackedTarget | null {
  const existing = findTrackedTargetById(id);
  if (!existing) {
    return null;
  }

  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM tracked_targets
    WHERE id = ?
  `);
  stmt.run(id);
  return existing;
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
