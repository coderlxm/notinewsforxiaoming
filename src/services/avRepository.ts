import { getDb } from '../reminders/db';

export interface TrackedTarget {
  id: number;
  name: string;
  source: 'javbus';
  target_type: 'star' | 'label';
  target_id: string;
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

export function hasPushHistory(targetId: number, itemGuid: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT 1 FROM push_history
    WHERE target_id = ? AND item_guid = ?
    LIMIT 1
  `);
  return Boolean(stmt.get(targetId, itemGuid));
}

export function createPushHistory(targetId: number, itemGuid: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO push_history (target_id, item_guid, pushed_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(targetId, itemGuid, new Date().toISOString());
}
