import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.resolve(__dirname, '../../data/notinews.sqlite');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        text TEXT NOT NULL,
        trigger_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'cancelled')),
        created_at TEXT NOT NULL,
        done_at TEXT,
        cancelled_at TEXT,
        source_message_id INTEGER,
        sent_message_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_pending_trigger_at
      ON reminders(status, trigger_at);

      CREATE TABLE IF NOT EXISTS recurring_reminder_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timezone TEXT NOT NULL,
        rrule_text TEXT NOT NULL,
        next_trigger_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'cancelled')),
        source TEXT NOT NULL CHECK (source IN ('deterministic', 'ai')),
        source_message_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_triggered_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_recur_active_next
      ON recurring_reminder_rules(status, next_trigger_at);

      CREATE TABLE IF NOT EXISTS recurring_reminder_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER NOT NULL,
        trigger_at TEXT NOT NULL,
        sent_message_id INTEGER,
        action TEXT CHECK (action IN ('done', 'skip', 'none')),
        acted_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(rule_id) REFERENCES recurring_reminder_rules(id)
      );
      CREATE INDEX IF NOT EXISTS idx_recur_runs_rule
      ON recurring_reminder_runs(rule_id, trigger_at);

      CREATE TABLE IF NOT EXISTS tracked_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'javbus',
        target_type TEXT NOT NULL CHECK (target_type IN ('star', 'label')),
        target_id TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_targets_unique
      ON tracked_targets(source, target_type, target_id);

      CREATE TABLE IF NOT EXISTS push_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_id INTEGER NOT NULL,
        item_guid TEXT NOT NULL,
        cover_sent INTEGER NOT NULL DEFAULT 0,
        pushed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(target_id) REFERENCES tracked_targets(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_push_history_target_guid
      ON push_history(target_id, item_guid);
    `);

    const pushHistoryColumns = db.prepare(`PRAGMA table_info(push_history)`).all() as Array<{ name: string }>;
    const hasCoverSent = pushHistoryColumns.some((column) => column.name === 'cover_sent');
    if (!hasCoverSent) {
      db.exec(`ALTER TABLE push_history ADD COLUMN cover_sent INTEGER NOT NULL DEFAULT 0;`);
    }
  }
  return db;
}
