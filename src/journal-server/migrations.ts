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
