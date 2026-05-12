import { getDb } from '../reminders/db';

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
