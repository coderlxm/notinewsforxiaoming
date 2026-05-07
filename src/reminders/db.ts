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
    `);
  }
  return db;
}
