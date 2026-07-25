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
  {
    version: 2,
    up(database) {
      database.exec(`
        CREATE TABLE journal_entries_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          public_id TEXT NOT NULL UNIQUE,
          source_kind TEXT NOT NULL
            CHECK (source_kind IN ('telegram', 'web')),
          chat_id TEXT,
          source_message_id INTEGER,
          media_group_id TEXT,
          content_type TEXT NOT NULL,
          title TEXT,
          body_format TEXT NOT NULL DEFAULT 'plain'
            CHECK (body_format IN ('plain', 'rich')),
          content_text TEXT NOT NULL DEFAULT '',
          rich_body_json TEXT,
          visibility TEXT NOT NULL
            CHECK (visibility IN ('private', 'public')),
          tags_json TEXT NOT NULL DEFAULT '[]',
          structured_content_json TEXT,
          telegram_message_json TEXT,
          pinned INTEGER NOT NULL DEFAULT 0
            CHECK (pinned IN (0, 1)),
          source_created_at TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (
            (source_kind = 'telegram'
              AND chat_id IS NOT NULL
              AND source_message_id IS NOT NULL
              AND telegram_message_json IS NOT NULL
              AND body_format = 'plain'
              AND rich_body_json IS NULL)
            OR
            (source_kind = 'web'
              AND chat_id IS NULL
              AND source_message_id IS NULL
              AND media_group_id IS NULL
              AND telegram_message_json IS NULL
              AND content_type = 'article'
              AND body_format = 'rich'
              AND title IS NOT NULL
              AND rich_body_json IS NOT NULL)
          ),
          UNIQUE(chat_id, source_message_id)
        );

        CREATE TABLE journal_assets_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          source_kind TEXT NOT NULL
            CHECK (source_kind IN ('telegram', 'web')),
          role TEXT NOT NULL DEFAULT 'attachment'
            CHECK (role IN ('attachment', 'cover', 'inline')),
          kind TEXT NOT NULL,
          telegram_file_id TEXT,
          telegram_file_unique_id TEXT,
          original_name TEXT,
          mime_type TEXT,
          byte_size INTEGER,
          relative_path TEXT NOT NULL UNIQUE,
          width INTEGER,
          height INTEGER,
          duration INTEGER,
          sort_order INTEGER NOT NULL DEFAULT 0,
          CHECK (
            (source_kind = 'telegram'
              AND telegram_file_id IS NOT NULL
              AND telegram_file_unique_id IS NOT NULL)
            OR
            (source_kind = 'web'
              AND telegram_file_id IS NULL
              AND telegram_file_unique_id IS NULL)
          ),
          FOREIGN KEY(entry_id) REFERENCES journal_entries_v2(id)
        );

        INSERT INTO journal_entries_v2 (
          id, public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          visibility, tags_json, structured_content_json, telegram_message_json,
          pinned, source_created_at, captured_at, updated_at
        )
        SELECT
          id, public_id, 'telegram', chat_id, source_message_id, media_group_id,
          content_type, NULL, 'plain', content_text, NULL,
          visibility, tags_json, structured_content_json, telegram_message_json,
          pinned, source_created_at, captured_at, updated_at
        FROM journal_entries;

        INSERT INTO journal_assets_v2 (
          id, entry_id, source_kind, role, kind, telegram_file_id, telegram_file_unique_id,
          original_name, mime_type, byte_size, relative_path, width, height, duration, sort_order
        )
        SELECT
          id, entry_id, 'telegram', 'attachment', kind, telegram_file_id, telegram_file_unique_id,
          original_name, mime_type, byte_size, relative_path, width, height, duration, sort_order
        FROM journal_assets;

        DROP TABLE journal_assets;
        DROP TABLE journal_entries;

        ALTER TABLE journal_entries_v2 RENAME TO journal_entries;
        ALTER TABLE journal_assets_v2 RENAME TO journal_assets;

        CREATE INDEX idx_journal_entries_timeline
        ON journal_entries(visibility, pinned, source_created_at);

        CREATE INDEX idx_journal_entries_media_group
        ON journal_entries(chat_id, media_group_id);

        CREATE INDEX idx_journal_entries_source_created_at
        ON journal_entries(source_created_at);

        CREATE INDEX idx_journal_entries_content_type
        ON journal_entries(content_type);

        CREATE INDEX idx_journal_assets_entry
        ON journal_assets(entry_id, sort_order);

        CREATE UNIQUE INDEX idx_journal_assets_one_cover
        ON journal_assets(entry_id)
        WHERE role = 'cover';
      `);
    },
  },
  {
    version: 3,
    up(database) {
      database.exec(`
        ALTER TABLE journal_assets
        ADD COLUMN preview_relative_path TEXT;

        CREATE UNIQUE INDEX idx_journal_assets_preview_relative_path
        ON journal_assets(preview_relative_path)
        WHERE preview_relative_path IS NOT NULL;
      `);
    },
  },
  {
    version: 4,
    up(database) {
      database.exec(`
        CREATE TABLE journal_entries_v4 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          public_id TEXT NOT NULL UNIQUE,
          source_kind TEXT NOT NULL
            CHECK (source_kind IN ('telegram', 'web')),
          chat_id TEXT,
          source_message_id INTEGER,
          media_group_id TEXT,
          content_type TEXT NOT NULL,
          title TEXT,
          body_format TEXT NOT NULL DEFAULT 'plain'
            CHECK (body_format IN ('plain', 'rich')),
          content_text TEXT NOT NULL DEFAULT '',
          rich_body_json TEXT,
          publication_status TEXT NOT NULL DEFAULT 'published'
            CHECK (publication_status IN ('draft', 'published')),
          visibility TEXT NOT NULL
            CHECK (visibility IN ('private', 'public')),
          tags_json TEXT NOT NULL DEFAULT '[]',
          structured_content_json TEXT,
          telegram_message_json TEXT,
          pinned INTEGER NOT NULL DEFAULT 0
            CHECK (pinned IN (0, 1)),
          source_created_at TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (
            (source_kind = 'telegram'
              AND chat_id IS NOT NULL
              AND source_message_id IS NOT NULL
              AND telegram_message_json IS NOT NULL
              AND body_format = 'plain'
              AND rich_body_json IS NULL)
            OR
            (source_kind = 'web'
              AND chat_id IS NULL
              AND source_message_id IS NULL
              AND media_group_id IS NULL
              AND telegram_message_json IS NULL
              AND content_type = 'article'
              AND body_format = 'rich'
              AND title IS NOT NULL
              AND rich_body_json IS NOT NULL)
            OR
            (source_kind = 'web'
              AND chat_id IS NULL
              AND source_message_id IS NULL
              AND media_group_id IS NULL
              AND telegram_message_json IS NULL
              AND content_type IN ('text', 'photo')
              AND body_format = 'plain'
              AND title IS NULL
              AND rich_body_json IS NULL)
          ),
          CHECK (
            publication_status = 'published'
            OR (
              publication_status = 'draft'
              AND source_kind = 'web'
              AND body_format = 'plain'
              AND visibility = 'private'
            )
          ),
          UNIQUE(chat_id, source_message_id)
        );

        CREATE TABLE journal_assets_v4 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          source_kind TEXT NOT NULL
            CHECK (source_kind IN ('telegram', 'web')),
          role TEXT NOT NULL DEFAULT 'attachment'
            CHECK (role IN ('attachment', 'cover', 'inline')),
          kind TEXT NOT NULL,
          telegram_file_id TEXT,
          telegram_file_unique_id TEXT,
          original_name TEXT,
          mime_type TEXT,
          byte_size INTEGER,
          relative_path TEXT NOT NULL UNIQUE,
          preview_relative_path TEXT,
          width INTEGER,
          height INTEGER,
          duration INTEGER,
          sort_order INTEGER NOT NULL DEFAULT 0,
          CHECK (
            (source_kind = 'telegram'
              AND telegram_file_id IS NOT NULL
              AND telegram_file_unique_id IS NOT NULL)
            OR
            (source_kind = 'web'
              AND telegram_file_id IS NULL
              AND telegram_file_unique_id IS NULL)
          ),
          FOREIGN KEY(entry_id) REFERENCES journal_entries_v4(id)
        );

        INSERT INTO journal_entries_v4 (
          id, public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          publication_status, visibility, tags_json, structured_content_json,
          telegram_message_json, pinned, source_created_at, captured_at, updated_at
        )
        SELECT
          id, public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          'published', visibility, tags_json, structured_content_json,
          telegram_message_json, pinned, source_created_at, captured_at, updated_at
        FROM journal_entries;

        INSERT INTO journal_assets_v4 (
          id, entry_id, source_kind, role, kind, telegram_file_id, telegram_file_unique_id,
          original_name, mime_type, byte_size, relative_path, preview_relative_path,
          width, height, duration, sort_order
        )
        SELECT
          id, entry_id, source_kind, role, kind, telegram_file_id, telegram_file_unique_id,
          original_name, mime_type, byte_size, relative_path, preview_relative_path,
          width, height, duration, sort_order
        FROM journal_assets;

        DROP TABLE journal_assets;
        DROP TABLE journal_entries;

        ALTER TABLE journal_entries_v4 RENAME TO journal_entries;
        ALTER TABLE journal_assets_v4 RENAME TO journal_assets;

        CREATE INDEX idx_journal_entries_timeline
        ON journal_entries(visibility, pinned, source_created_at);

        CREATE INDEX idx_journal_entries_media_group
        ON journal_entries(chat_id, media_group_id);

        CREATE INDEX idx_journal_entries_source_created_at
        ON journal_entries(source_created_at);

        CREATE INDEX idx_journal_entries_content_type
        ON journal_entries(content_type);

        CREATE INDEX idx_journal_assets_entry
        ON journal_assets(entry_id, sort_order);

        CREATE UNIQUE INDEX idx_journal_assets_one_cover
        ON journal_assets(entry_id)
        WHERE role = 'cover';

        CREATE UNIQUE INDEX idx_journal_assets_preview_relative_path
        ON journal_assets(preview_relative_path)
        WHERE preview_relative_path IS NOT NULL;
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
