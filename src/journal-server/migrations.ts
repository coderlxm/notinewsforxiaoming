import type Database from 'better-sqlite3';
import { journalRichDocumentSchema, type JournalRichDocument } from '../shared/journalProtocol.js';
import { assertRichDocument, normalizeRichDocument } from './richText.js';

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
  {
    version: 5,
    up(database) {
      database.exec(`
        CREATE TABLE journal_site_profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          bio TEXT NOT NULL CHECK (length(bio) <= 120),
          avatar_webp BLOB NOT NULL,
          avatar_revision INTEGER NOT NULL CHECK (avatar_revision > 0),
          updated_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 6,
    up(database) {
      database.exec(`
        ALTER TABLE journal_site_profile
        ADD COLUMN weather_enabled INTEGER NOT NULL DEFAULT 1
          CHECK (weather_enabled IN (0, 1));
      `);
    },
  },
  {
    version: 7,
    up(database) {
      database.exec(`
        CREATE TABLE journal_entries_v7 (
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
              AND content_type IN ('text', 'photo', 'video')
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

        CREATE TABLE journal_assets_v7 (
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
          FOREIGN KEY(entry_id) REFERENCES journal_entries_v7(id)
        );

        INSERT INTO journal_entries_v7
        SELECT * FROM journal_entries;

        INSERT INTO journal_assets_v7
        SELECT * FROM journal_assets;

        DROP TABLE journal_assets;
        DROP TABLE journal_entries;

        ALTER TABLE journal_entries_v7 RENAME TO journal_entries;
        ALTER TABLE journal_assets_v7 RENAME TO journal_assets;

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

        CREATE TABLE journal_contribution_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          revoked_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE journal_contributions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          public_id TEXT NOT NULL UNIQUE,
          link_id INTEGER NOT NULL,
          sender_name TEXT NOT NULL,
          content_text TEXT NOT NULL DEFAULT '',
          submitted_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(link_id) REFERENCES journal_contribution_links(id)
        );

        CREATE TABLE journal_contribution_assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contribution_id INTEGER NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
          source_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          byte_size INTEGER NOT NULL,
          relative_path TEXT NOT NULL UNIQUE,
          preview_relative_path TEXT NOT NULL UNIQUE,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          duration REAL,
          sort_order INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(contribution_id) REFERENCES journal_contributions(id)
        );

        CREATE INDEX idx_journal_contribution_links_token_hash
        ON journal_contribution_links(token_hash);

        CREATE INDEX idx_journal_contributions_submitted
        ON journal_contributions(submitted_at DESC, id DESC);

        CREATE INDEX idx_journal_contribution_assets_contribution
        ON journal_contribution_assets(contribution_id, sort_order, id);
      `);
    },
  },
  {
    version: 8,
    up(database) {
      const rows = database.prepare(`
        SELECT id, rich_body_json
        FROM journal_entries
        WHERE body_format = 'rich'
      `).all() as Array<{ id: number; rich_body_json: string }>;
      const update = database.prepare(`
        UPDATE journal_entries
        SET rich_body_json = ?
        WHERE id = ?
      `);

      for (const row of rows) {
        const document = journalRichDocumentSchema.parse(
          JSON.parse(row.rich_body_json),
        ) as JournalRichDocument;
        const normalized = normalizeRichDocument(document);
        assertRichDocument(normalized, { allowImages: true });
        update.run(JSON.stringify(normalized), row.id);
      }
    },
  },
  {
    version: 9,
    up(database) {
      database.exec(`
        ALTER TABLE journal_entries
        ADD COLUMN channel TEXT NOT NULL DEFAULT 'life';

        UPDATE journal_entries
        SET channel = 'article'
        WHERE body_format = 'rich';

        CREATE INDEX idx_journal_entries_channel_timeline
        ON journal_entries(
          visibility,
          publication_status,
          channel,
          pinned DESC,
          source_created_at DESC,
          id DESC
        );
      `);
    },
  },
  {
    version: 10,
    up(database) {
      database.exec(`
        ALTER TABLE journal_site_profile
        ADD COLUMN channel_tags_json TEXT NOT NULL
          DEFAULT '{"life":[],"article":[],"interest":[]}';
      `);
    },
  },
  {
    version: 11,
    up(database) {
      database.exec(`
        ALTER TABLE journal_site_profile
        ADD COLUMN about_intro TEXT NOT NULL DEFAULT ''
          CHECK (length(about_intro) <= 1200);

        ALTER TABLE journal_site_profile
        ADD COLUMN contact_items_json TEXT NOT NULL
          DEFAULT '[{"kind":"telegram","label":"Telegram","value":"@example","url":"https://t.me/example","enabled":true},{"kind":"email","label":"Email","value":"example@example.com","url":"mailto:example@example.com","enabled":true},{"kind":"wechat","label":"微信","value":"xiaoming","url":null,"enabled":true},{"kind":"github","label":"GitHub","value":"github.com/example","url":"https://github.com/example","enabled":true},{"kind":"website","label":"个人网站","value":"example.com","url":"https://example.com","enabled":true}]';
      `);
    },
  },
  {
    version: 12,
    up(database) {
      database.exec(`
        PRAGMA defer_foreign_keys = ON;

        CREATE TABLE journal_contribution_links_v12 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT,
          revoked_at TEXT,
          created_at TEXT NOT NULL
        );

        INSERT INTO journal_contribution_links_v12 (
          id, token_hash, expires_at, revoked_at, created_at
        )
        SELECT id, token_hash, expires_at, revoked_at, created_at
        FROM journal_contribution_links;

        DROP TABLE journal_contribution_links;
        ALTER TABLE journal_contribution_links_v12 RENAME TO journal_contribution_links;

        CREATE INDEX idx_journal_contribution_links_token_hash
        ON journal_contribution_links(token_hash);
      `);
    },
  },
  {
    version: 13,
    up(database) {
      database.exec(`
        PRAGMA defer_foreign_keys = ON;

        CREATE TABLE journal_entries_v13 (
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
          channel TEXT NOT NULL DEFAULT 'life'
            CHECK (channel IN ('life', 'article', 'interest')),
          visibility TEXT NOT NULL
            CHECK (visibility IN ('private', 'protected', 'public')),
          access_password_hash TEXT,
          access_revision INTEGER NOT NULL DEFAULT 0
            CHECK (access_revision >= 0),
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
              AND content_type IN ('text', 'photo', 'video')
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
          CHECK (
            (visibility = 'protected'
              AND access_password_hash IS NOT NULL
              AND access_revision > 0)
            OR
            (visibility IN ('private', 'public')
              AND access_password_hash IS NULL)
          ),
          UNIQUE(chat_id, source_message_id)
        );

        CREATE TABLE journal_assets_v13 (
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
          FOREIGN KEY(entry_id) REFERENCES journal_entries_v13(id)
        );

        INSERT INTO journal_entries_v13 (
          id, public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          publication_status, channel, visibility, access_password_hash,
          access_revision, tags_json, structured_content_json, telegram_message_json,
          pinned, source_created_at, captured_at, updated_at
        )
        SELECT
          id, public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          publication_status, channel, visibility, NULL,
          0, tags_json, structured_content_json, telegram_message_json,
          pinned, source_created_at, captured_at, updated_at
        FROM journal_entries;

        INSERT INTO journal_assets_v13 (
          id, entry_id, source_kind, role, kind, telegram_file_id,
          telegram_file_unique_id, original_name, mime_type, byte_size,
          relative_path, preview_relative_path, width, height, duration, sort_order
        )
        SELECT
          id, entry_id, source_kind, role, kind, telegram_file_id,
          telegram_file_unique_id, original_name, mime_type, byte_size,
          relative_path, preview_relative_path, width, height, duration, sort_order
        FROM journal_assets;

        DROP TABLE journal_assets;
        DROP TABLE journal_entries;

        ALTER TABLE journal_entries_v13 RENAME TO journal_entries;
        ALTER TABLE journal_assets_v13 RENAME TO journal_assets;

        CREATE INDEX idx_journal_entries_timeline
        ON journal_entries(visibility, pinned, source_created_at);

        CREATE INDEX idx_journal_entries_media_group
        ON journal_entries(chat_id, media_group_id);

        CREATE INDEX idx_journal_entries_source_created_at
        ON journal_entries(source_created_at);

        CREATE INDEX idx_journal_entries_content_type
        ON journal_entries(content_type);

        CREATE INDEX idx_journal_entries_channel_timeline
        ON journal_entries(
          visibility,
          publication_status,
          channel,
          pinned DESC,
          source_created_at DESC,
          id DESC
        );

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
  {
    version: 14,
    up(database) {
      database.exec(`
        PRAGMA defer_foreign_keys = ON;

        CREATE TABLE journal_entries_v14 (
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
          channel TEXT NOT NULL DEFAULT 'life'
            CHECK (channel IN ('life', 'article', 'interest')),
          visibility TEXT NOT NULL
            CHECK (visibility IN ('private', 'protected', 'public')),
          access_password_hash TEXT,
          access_revision INTEGER NOT NULL DEFAULT 0
            CHECK (access_revision >= 0),
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
              AND content_type IN ('text', 'photo', 'video')
              AND body_format = 'plain'
              AND (
                title IS NULL
                OR (title = trim(title) AND length(title) BETWEEN 1 AND 60)
              )
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
          CHECK (
            (visibility = 'protected'
              AND access_password_hash IS NOT NULL
              AND access_revision > 0)
            OR
            (visibility IN ('private', 'public')
              AND access_password_hash IS NULL)
          ),
          UNIQUE(chat_id, source_message_id)
        );

        CREATE TABLE journal_assets_v14 (
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
          FOREIGN KEY(entry_id) REFERENCES journal_entries_v14(id)
        );

        INSERT INTO journal_entries_v14 (
          id, public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          publication_status, channel, visibility, access_password_hash,
          access_revision, tags_json, structured_content_json, telegram_message_json,
          pinned, source_created_at, captured_at, updated_at
        )
        SELECT
          id, public_id, source_kind, chat_id, source_message_id, media_group_id,
          content_type, title, body_format, content_text, rich_body_json,
          publication_status, channel, visibility, access_password_hash,
          access_revision, tags_json, structured_content_json, telegram_message_json,
          pinned, source_created_at, captured_at, updated_at
        FROM journal_entries;

        INSERT INTO journal_assets_v14 (
          id, entry_id, source_kind, role, kind, telegram_file_id,
          telegram_file_unique_id, original_name, mime_type, byte_size,
          relative_path, preview_relative_path, width, height, duration, sort_order
        )
        SELECT
          id, entry_id, source_kind, role, kind, telegram_file_id,
          telegram_file_unique_id, original_name, mime_type, byte_size,
          relative_path, preview_relative_path, width, height, duration, sort_order
        FROM journal_assets;

        DROP TABLE journal_assets;
        DROP TABLE journal_entries;

        ALTER TABLE journal_entries_v14 RENAME TO journal_entries;
        ALTER TABLE journal_assets_v14 RENAME TO journal_assets;

        CREATE INDEX idx_journal_entries_timeline
        ON journal_entries(visibility, pinned, source_created_at);

        CREATE INDEX idx_journal_entries_media_group
        ON journal_entries(chat_id, media_group_id);

        CREATE INDEX idx_journal_entries_source_created_at
        ON journal_entries(source_created_at);

        CREATE INDEX idx_journal_entries_content_type
        ON journal_entries(content_type);

        CREATE INDEX idx_journal_entries_channel_timeline
        ON journal_entries(
          visibility,
          publication_status,
          channel,
          pinned DESC,
          source_created_at DESC,
          id DESC
        );

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
  {
    version: 15,
    up(database) {
      database.exec(`
        ALTER TABLE journal_assets
        ADD COLUMN poster_relative_path TEXT;

        CREATE UNIQUE INDEX idx_journal_assets_poster_relative_path
        ON journal_assets(poster_relative_path)
        WHERE poster_relative_path IS NOT NULL;
      `);
    },
  },
  {
    version: 16,
    up(database) {
      database.exec(`
        ALTER TABLE journal_entries
        ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0
          CHECK (ai_generated IN (0, 1));
      `);
    },
  },
  {
    version: 17,
    up(database) {
      database.exec(`
        CREATE TABLE journal_site_resume (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          format TEXT NOT NULL
            CHECK (format IN ('markdown', 'pdf')),
          original_name TEXT NOT NULL,
          content BLOB NOT NULL,
          rendered_html TEXT,
          access_mode TEXT NOT NULL DEFAULT 'private'
            CHECK (access_mode IN ('private', 'protected', 'temporary', 'public')),
          access_password_hash TEXT,
          access_grant_id TEXT NOT NULL,
          access_revision INTEGER NOT NULL DEFAULT 1
            CHECK (access_revision > 0),
          revision INTEGER NOT NULL
            CHECK (revision > 0),
          updated_at TEXT NOT NULL,
          CHECK (
            (format = 'markdown' AND rendered_html IS NOT NULL)
            OR (format = 'pdf' AND rendered_html IS NULL)
          ),
          CHECK (
            (access_mode = 'protected' AND access_password_hash IS NOT NULL)
            OR (access_mode <> 'protected' AND access_password_hash IS NULL)
          )
        );

        CREATE TABLE journal_resume_share_link (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 18,
    up(database) {
      database.exec(`
        CREATE TABLE journal_resume_preview_pages (
          page_number INTEGER PRIMARY KEY
            CHECK (page_number > 0),
          content_webp BLOB NOT NULL
            CHECK (length(content_webp) > 0),
          width INTEGER NOT NULL
            CHECK (width > 0),
          height INTEGER NOT NULL
            CHECK (height > 0)
        );
      `);
    },
  },
  {
    version: 19,
    up(database) {
      database.exec(`
        ALTER TABLE journal_resume_preview_pages
        ADD COLUMN content_dark_webp BLOB
          CHECK (
            content_dark_webp IS NULL
            OR length(content_dark_webp) > 0
          );
      `);
    },
  },
  {
    version: 20,
    up(database) {
      database.exec(`
        CREATE TABLE journal_entry_reactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          client_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
          UNIQUE (entry_id, client_hash)
        );

        CREATE TABLE journal_entry_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          parent_id INTEGER,
          author_role TEXT NOT NULL
            CHECK (author_role IN ('visitor', 'owner')),
          author_name TEXT NOT NULL,
          content_markdown TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'published'
            CHECK (status IN ('published', 'hidden')),
          client_hash TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (id, entry_id),
          FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_id, entry_id)
            REFERENCES journal_entry_comments(id, entry_id) ON DELETE CASCADE,
          CHECK (
            (author_role = 'visitor' AND parent_id IS NULL AND client_hash IS NOT NULL)
            OR
            (author_role = 'owner' AND parent_id IS NOT NULL AND client_hash IS NULL)
          )
        );

        CREATE INDEX idx_journal_entry_comments_public
        ON journal_entry_comments(entry_id, status, created_at, id);

        CREATE INDEX idx_journal_entry_comments_parent
        ON journal_entry_comments(parent_id, created_at, id)
        WHERE parent_id IS NOT NULL;
      `);
    },
  },
  {
    version: 21,
    up(database) {
      database.exec(`
        CREATE TABLE journal_games (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          original_title TEXT NOT NULL,
          cover_url TEXT NOT NULL,
          banner_url TEXT NOT NULL,
          platforms_json TEXT NOT NULL,
          genre_json TEXT NOT NULL,
          developer TEXT NOT NULL,
          publisher TEXT,
          release_year INTEGER NOT NULL,
          status TEXT NOT NULL
            CHECK (status IN ('completed', 'mastered', 'playing', 'shelved', 'backlog')),
          completed_at TEXT,
          playtime_hours REAL NOT NULL CHECK (playtime_hours >= 0),
          difficulty TEXT,
          is_goty INTEGER NOT NULL CHECK (is_goty IN (0, 1)),
          platinum_trophy INTEGER NOT NULL CHECK (platinum_trophy IN (0, 1)),
          rating REAL NOT NULL CHECK (rating >= 0 AND rating <= 10),
          verdict_title TEXT NOT NULL,
          punchline TEXT NOT NULL,
          pros_json TEXT NOT NULL,
          cons_json TEXT NOT NULL,
          dimension_ratings_json TEXT NOT NULL,
          review_markdown TEXT NOT NULL,
          screenshots_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX idx_journal_games_completed
        ON journal_games(completed_at DESC, created_at DESC);

        CREATE TABLE journal_game_images (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('cover', 'banner', 'screenshot')),
          relative_path TEXT NOT NULL UNIQUE,
          original_name TEXT,
          mime_type TEXT NOT NULL,
          byte_size INTEGER NOT NULL CHECK (byte_size > 0),
          created_at TEXT NOT NULL,
          FOREIGN KEY (game_id) REFERENCES journal_games(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_journal_game_images_game
        ON journal_game_images(game_id, created_at);
      `);

      const insertGame = database.prepare(`
        INSERT INTO journal_games (
          id, title, original_title, cover_url, banner_url, platforms_json, genre_json,
          developer, publisher, release_year, status, completed_at, playtime_hours,
          difficulty, is_goty, platinum_trophy, rating, verdict_title, punchline,
          pros_json, cons_json, dimension_ratings_json, review_markdown, screenshots_json,
          created_at, updated_at
        ) VALUES (
          @id, @title, @originalTitle, @coverUrl, @bannerUrl, @platformsJson, @genreJson,
          @developer, NULL, @releaseYear, @status, @completedAt, @playtimeHours,
          @difficulty, 1, 1, @rating, 'MASTERPIECE', @punchline,
          @prosJson, @consJson, @dimensionRatingsJson, @reviewMarkdown, @screenshotsJson,
          @createdAt, @updatedAt
        )
      `);
      insertGame.run({
        id: '11111111-1111-4111-8111-111111111111',
        title: '黑神话：悟空',
        originalTitle: 'Black Myth: Wukong',
        coverUrl: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=800&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
        platformsJson: JSON.stringify(['PC', 'PS5']),
        genreJson: JSON.stringify(['动作角色扮演', '神话', '魂系体验']),
        developer: '游戏科学 (Game Science)',
        releaseYear: 2024,
        status: 'mastered',
        completedAt: '2024-09-12',
        playtimeHours: 78,
        difficulty: '默认难度（全隐藏Boss全成就）',
        rating: 9.8,
        punchline: '中国单机游戏史上的不朽里程碑，极具东方美学神韵的西游史诗。',
        prosJson: JSON.stringify([
          '登峰造极的东方中式古建、造像与美术表现力',
          '极其丰满的 Boss 战阵型与独特的定身/变身战斗体系',
          '每章结尾动画及陕北说书等顶级文化视听呈现',
          '隐藏地图与六道轮回剧情挖掘极具深度',
        ]),
        consJson: JSON.stringify([
          '部分地图空气墙影响探索沉浸感',
          '个别高速移动 Boss 锁定视角偶有轻微镜头抖动',
        ]),
        dimensionRatingsJson: JSON.stringify({
          gameplay: 9.6,
          story: 9.8,
          visuals: 10,
          music: 9.9,
          performance: 9.2,
        }),
        reviewMarkdown: `踏上西行重走之路的那一刻，那种跨越千年的文化共鸣瞬间被点燃。

游戏科学将中国传统佛道造像、石窟艺术与虚幻5引擎的极致光影结合，呈现出真正意义上的“东方魔幻史诗”。黄风岭的苍凉与陕北说书的激昂，小西天的冰雪与亢金龙的长啸，每一幕都让人驻足凝视。

战斗系统以轻重棍法搭配铜头铁臂、定身法与七十二变，打出了极具辨识度的中式动作节奏。在经历了与大圣残躯的终极决战后，那首《敢问路在何方》响起时，眼眶真正湿润了。这是属于每一位中国玩家的西游梦。`,
        screenshotsJson: JSON.stringify([
          {
            id: 'bmw-1',
            url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
            caption: '浮屠塔壁画前的冥想时刻',
          },
          {
            id: 'bmw-2',
            url: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=1200&q=80',
            caption: '踏破凌霄，重走西游路',
          },
          {
            id: 'bmw-3',
            url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80',
            caption: '白雪皑皑间的小西天古刹',
          },
        ]),
        createdAt: '2024-09-12T14:30:00Z',
        updatedAt: '2024-09-12T14:30:00Z',
      });
      insertGame.run({
        id: '22222222-2222-4222-8222-222222222222',
        title: '艾尔登法环：黄金树幽影',
        originalTitle: 'Elden Ring: Shadow of the Erdtree',
        coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1920&q=80',
        platformsJson: JSON.stringify(['PS5', 'PC']),
        genreJson: JSON.stringify(['开放世界', '暗黑奇幻', 'ARPG']),
        developer: 'FromSoftware',
        releaseYear: 2024,
        status: 'mastered',
        completedAt: '2024-07-28',
        playtimeHours: 145,
        difficulty: '多周目全搜集',
        rating: 10,
        punchline: '箱庭与开放世界探索的极致结合，FromSoftware 奉献的又一座游戏设计神殿。',
        prosJson: JSON.stringify([
          '纵向立体感极强的幽影之地地图架构，探索感无出其右',
          '海量全新武器、战灰与法术极大拓展了 build 流派',
          '梅瑟莫与狂龙贝勒等 Boss 战演出震撼绝伦',
          '宏大而苍凉的叙事与史诗感十足的交响配乐',
        ]),
        consJson: JSON.stringify([
          '最终 Boss 数值压迫感较强，对玩家 build 与翻滚时机要求苛刻',
        ]),
        dimensionRatingsJson: JSON.stringify({
          gameplay: 10,
          story: 9.8,
          visuals: 9.9,
          music: 10,
          performance: 9.4,
        }),
        reviewMarkdown: `宫崎英高再次证明了在现代游戏工业中，对于“探索未知”这一纯粹乐趣的掌控力。

幽影之地并非简单的平铺地图，而是如同多层折叠的立体艺术品。当你穿过青蓝海岸、登上塔之镇，或是从幽影古城底部潜入深渊，每揭开一层帷幕，都会被那令人屏息的宏大奇观所震撼。全成就通关后，依然对交界地与幽影之地的往事回味无穷。`,
        screenshotsJson: JSON.stringify([
          {
            id: 'er-1',
            url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
            caption: '黄金树凋零之下的幽影之城',
          },
          {
            id: 'er-2',
            url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
            caption: '青蓝海岸的花海与彼岸棺柩',
          },
        ]),
        createdAt: '2024-07-28T20:10:00Z',
        updatedAt: '2024-07-28T20:10:00Z',
      });
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
