import type Database from 'better-sqlite3';

interface JournalMigration {
  version: number;
  up: (database: Database.Database) => void;
}

const migrations: JournalMigration[] = [
  {
    version: 1,
    up(database) {
      database.exec(`
        CREATE TABLE journal_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          public_id TEXT NOT NULL UNIQUE,
          chat_id TEXT NOT NULL,
          source_message_id INTEGER NOT NULL,
          media_group_id TEXT,
          content_type TEXT NOT NULL,
          content_text TEXT NOT NULL DEFAULT '',
          visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
          tags_json TEXT NOT NULL DEFAULT '[]',
          structured_content_json TEXT,
          telegram_message_json TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
          source_created_at TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(chat_id, source_message_id)
        );

        CREATE TABLE journal_assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          telegram_file_id TEXT NOT NULL,
          telegram_file_unique_id TEXT NOT NULL,
          original_name TEXT,
          mime_type TEXT,
          byte_size INTEGER,
          relative_path TEXT NOT NULL UNIQUE,
          width INTEGER,
          height INTEGER,
          duration INTEGER,
          sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY(entry_id) REFERENCES journal_entries(id)
        );

        CREATE INDEX idx_journal_entries_timeline
        ON journal_entries(visibility, pinned, source_created_at);

        CREATE INDEX idx_journal_entries_media_group
        ON journal_entries(chat_id, media_group_id);

        CREATE INDEX idx_journal_entries_source_created_at
        ON journal_entries(source_created_at);

        CREATE INDEX idx_journal_assets_entry
        ON journal_assets(entry_id, sort_order);
      `);
    },
  },
];

export function runJournalMigrations(database: Database.Database): void {
  const currentVersion = database.pragma('user_version', { simple: true }) as number;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    database.transaction(() => {
      migration.up(database);
      database.pragma(`user_version = ${migration.version}`);
    })();
  }
}
