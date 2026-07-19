import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runJournalMigrations } from './migrations.js';

export function openJournalDatabase(dataDir: string): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true });
  const database = new Database(path.join(dataDir, 'journal.sqlite'));
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  runJournalMigrations(database);
  return database;
}
