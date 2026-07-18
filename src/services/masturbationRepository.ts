import { getDb } from '../reminders/db.js';

export interface MasturbationRecord {
  id: number;
  occurred_at: string;
  created_at: string;
}

export function createRecord(occurredAt: Date): MasturbationRecord {
  const occurredAtIso = occurredAt.toISOString();
  const createdAt = new Date().toISOString();
  const { lastInsertRowid } = getDb().prepare(`
    INSERT INTO masturbation_records (occurred_at, created_at)
    VALUES (?, ?)
  `).run(occurredAtIso, createdAt);
  return {
    id: Number(lastInsertRowid),
    occurred_at: occurredAtIso,
    created_at: createdAt,
  };
}

export function findRecordById(id: number): MasturbationRecord | undefined {
  return getDb().prepare('SELECT * FROM masturbation_records WHERE id = ?').get(id) as MasturbationRecord | undefined;
}

export function deleteRecordById(id: number): MasturbationRecord | undefined {
  const record = findRecordById(id);
  if (record) {
    getDb().prepare('DELETE FROM masturbation_records WHERE id = ?').run(id);
  }
  return record;
}

export function findLatestRecord(): MasturbationRecord | undefined {
  return getDb().prepare(`
    SELECT * FROM masturbation_records
    ORDER BY occurred_at DESC, id DESC
    LIMIT 1
  `).get() as MasturbationRecord | undefined;
}

export function deleteLatestRecord(): MasturbationRecord | undefined {
  const latest = findLatestRecord();
  if (latest) {
    getDb().prepare('DELETE FROM masturbation_records WHERE id = ?').run(latest.id);
  }
  return latest;
}

export function findRecordsInRange(rangeStartUtc: string, rangeEndUtc: string): MasturbationRecord[] {
  return getDb().prepare(`
    SELECT * FROM masturbation_records
    WHERE occurred_at >= ? AND occurred_at < ?
    ORDER BY occurred_at ASC, id ASC
  `).all(rangeStartUtc, rangeEndUtc) as MasturbationRecord[];
}
