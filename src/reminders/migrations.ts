import type Database from 'better-sqlite3';

interface DbMigration {
  version: number;
  up: (db: Database.Database) => void;
}

function tableHasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function getTableSql(db: Database.Database, tableName: string): string | null {
  const row = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name = ?
    LIMIT 1
  `).get(tableName) as { sql?: string } | undefined;
  return row?.sql ?? null;
}

const MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    up(db) {
      if (!tableHasColumn(db, 'push_history', 'cover_sent')) {
        db.exec(`ALTER TABLE push_history ADD COLUMN cover_sent INTEGER NOT NULL DEFAULT 0;`);
      }
    },
  },
  {
    version: 2,
    up(db) {
      if (!tableHasColumn(db, 'vitamin_reminders', 'eaten')) {
        db.exec(`ALTER TABLE vitamin_reminders ADD COLUMN eaten INTEGER NOT NULL DEFAULT 0;`);
      }
      if (!tableHasColumn(db, 'vitamin_reminders', 'loop_active')) {
        db.exec(`ALTER TABLE vitamin_reminders ADD COLUMN loop_active INTEGER NOT NULL DEFAULT 0;`);
      }
      if (!tableHasColumn(db, 'vitamin_reminders', 'next_trigger_at')) {
        db.exec(`ALTER TABLE vitamin_reminders ADD COLUMN next_trigger_at TEXT;`);
      }
    },
  },
  {
    version: 3,
    up(db) {
      const trackedTargetsSql = getTableSql(db, 'tracked_targets');
      const needsTrackedTargetsMigration = trackedTargetsSql?.includes(
        `target_type TEXT NOT NULL CHECK (target_type IN ('star', 'label'))`
      );
      if (!needsTrackedTargetsMigration) {
        return;
      }

      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS tracked_targets_new;
        BEGIN;
        CREATE TABLE tracked_targets_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'javbus',
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO tracked_targets_new (id, name, source, target_type, target_id, updated_at)
        SELECT id, name, source, target_type, target_id, updated_at
        FROM tracked_targets;
        DROP TABLE tracked_targets;
        ALTER TABLE tracked_targets_new RENAME TO tracked_targets;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_targets_unique
        ON tracked_targets(source, target_type, target_id);
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
    },
  },
  {
    version: 4,
    up(db) {
      if (!tableHasColumn(db, 'startgg_watch_events', 'subscription_source')) {
        db.exec(`
          ALTER TABLE startgg_watch_events
          ADD COLUMN subscription_source TEXT NOT NULL DEFAULT 'manual'
          CHECK (subscription_source IN ('manual', 'auto'));

          UPDATE startgg_watch_events
          SET subscription_source = 'auto'
          WHERE active = 1;

          DELETE FROM startgg_watch_event_entrants
          WHERE watch_event_id IN (
            SELECT id FROM startgg_watch_events WHERE active = 1
          );
          DELETE FROM startgg_watch_snapshots
          WHERE watch_event_id IN (
            SELECT id FROM startgg_watch_events WHERE active = 1
          );
          DELETE FROM startgg_pushed_sets
          WHERE watch_event_id IN (
            SELECT id FROM startgg_watch_events WHERE active = 1
          );
        `);
      }
    },
  },
  {
    version: 5,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS startgg_sent_messages (
          message_id INTEGER PRIMARY KEY,
          sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    version: 6,
    up(db) {
      if (!tableHasColumn(db, 'startgg_watch_snapshots', 'initial_message_sent')) {
        db.exec(`
          ALTER TABLE startgg_watch_snapshots
          ADD COLUMN initial_message_sent INTEGER NOT NULL DEFAULT 0
          CHECK (initial_message_sent IN (0, 1));
        `);
      }
    },
  },
  {
    version: 7,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS startgg_runtime_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          polling_enabled INTEGER NOT NULL DEFAULT 0 CHECK (polling_enabled IN (0, 1)),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    version: 8,
    up(db) {
      if (!tableHasColumn(db, 'startgg_watch_events', 'tournament_end_at')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN tournament_end_at TEXT;`);
      }
    },
  },
  {
    version: 9,
    up(db) {
      if (!tableHasColumn(db, 'startgg_watch_events', 'tournament_name')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN tournament_name TEXT;`);
      }
      if (!tableHasColumn(db, 'startgg_watch_events', 'event_display_name')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN event_display_name TEXT;`);
      }
    },
  },
  {
    version: 10,
    up(db) {
      if (!tableHasColumn(db, 'recurring_reminder_rules', 'calendar_filter')) {
        db.exec(`
          ALTER TABLE recurring_reminder_rules
          ADD COLUMN calendar_filter TEXT
          CHECK (calendar_filter IS NULL OR calendar_filter = 'china_workday');
        `);
      }
    },
  },
  {
    version: 11,
    up(db) {
      if (!tableHasColumn(db, 'startgg_watch_events', 'event_state')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN event_state TEXT;`);
      }
      if (!tableHasColumn(db, 'startgg_watch_events', 'final_phase_id')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN final_phase_id INTEGER;`);
      }
      if (!tableHasColumn(db, 'startgg_watch_events', 'final_phase_name')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN final_phase_name TEXT;`);
      }
      if (!tableHasColumn(db, 'startgg_watch_events', 'final_phase_num_seeds')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN final_phase_num_seeds INTEGER;`);
      }
      if (!tableHasColumn(db, 'startgg_watch_events', 'final_phase_tracking_completed')) {
        db.exec(`
          ALTER TABLE startgg_watch_events
          ADD COLUMN final_phase_tracking_completed INTEGER NOT NULL DEFAULT 0
          CHECK (final_phase_tracking_completed IN (0, 1));
        `);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS startgg_event_pushed_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          watch_event_id INTEGER NOT NULL,
          set_id INTEGER NOT NULL,
          pushed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(watch_event_id) REFERENCES startgg_watch_events(id),
          UNIQUE(watch_event_id, set_id)
        );
      `);
    },
  },
  {
    version: 12,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS steam_price_watches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app_id INTEGER NOT NULL UNIQUE,
          name TEXT NOT NULL,
          currency TEXT NOT NULL CHECK (currency = 'CNY'),
          target_price_minor INTEGER NOT NULL CHECK (target_price_minor > 0),
          initial_price_minor INTEGER NOT NULL CHECK (initial_price_minor >= 0),
          final_price_minor INTEGER NOT NULL CHECK (final_price_minor >= 0),
          discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 0 AND 100),
          lowest_price_minor INTEGER NOT NULL CHECK (lowest_price_minor >= 0),
          last_checked_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 13,
    up(db) {
      if (!tableHasColumn(db, 'startgg_watch_players', 'user_id')) {
        db.exec(`ALTER TABLE startgg_watch_players ADD COLUMN user_id INTEGER;`);
      }
      if (!tableHasColumn(db, 'startgg_watch_players', 'gamer_tag')) {
        db.exec(`ALTER TABLE startgg_watch_players ADD COLUMN gamer_tag TEXT;`);
      }
    },
  },
  {
    version: 14,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS journal_capture_sessions (
          chat_id TEXT PRIMARY KEY,
          visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
          prompt_message_id INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 15,
    up(db) {
      if (!tableHasColumn(db, 'startgg_runtime_settings', 'featured_seed_count')) {
        db.exec(`
          ALTER TABLE startgg_runtime_settings
          ADD COLUMN featured_seed_count INTEGER NOT NULL DEFAULT 16
          CHECK (featured_seed_count IN (0, 16, 32));
        `);
      }
      db.exec(`
        INSERT OR IGNORE INTO startgg_runtime_settings (
          id, polling_enabled, featured_seed_count, updated_at
        )
        VALUES (1, 0, 16, CURRENT_TIMESTAMP);
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS startgg_watch_event_featured_entrants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          watch_event_id INTEGER NOT NULL,
          phase_id INTEGER NOT NULL,
          entrant_id INTEGER NOT NULL,
          entrant_name TEXT NOT NULL,
          seed_num INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(watch_event_id) REFERENCES startgg_watch_events(id),
          UNIQUE(watch_event_id, entrant_id),
          UNIQUE(watch_event_id, seed_num)
        );
      `);
    },
  },
  {
    version: 16,
    up(db) {
      if (!tableHasColumn(db, 'startgg_watch_events', 'videogame_id')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN videogame_id INTEGER;`);
      }
      if (!tableHasColumn(db, 'startgg_watch_events', 'videogame_name')) {
        db.exec(`ALTER TABLE startgg_watch_events ADD COLUMN videogame_name TEXT;`);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS startgg_videogame_preferences (
          videogame_id INTEGER PRIMARY KEY,
          videogame_name TEXT NOT NULL,
          preference TEXT NOT NULL CHECK (preference IN ('follow', 'ignore')),
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS startgg_pending_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_slug TEXT NOT NULL UNIQUE,
          event_name TEXT NOT NULL,
          tournament_name TEXT NOT NULL,
          tournament_end_at TEXT NOT NULL,
          videogame_id INTEGER NOT NULL,
          videogame_name TEXT NOT NULL,
          player_names TEXT NOT NULL,
          prompt_message_id INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS startgg_event_interest_overrides (
          event_slug TEXT PRIMARY KEY,
          tournament_end_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 17,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS work_checkins (
          date_key TEXT PRIMARY KEY,
          completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS work_checkin_messages (
          date_key TEXT NOT NULL,
          message_id INTEGER NOT NULL,
          PRIMARY KEY (date_key, message_id),
          FOREIGN KEY(date_key) REFERENCES work_checkins(date_key)
        );
      `);
    },
  },
  {
    version: 18,
    up(db) {
      if (!tableHasColumn(db, 'masturbation_records', 'note')) {
        db.exec(`ALTER TABLE masturbation_records ADD COLUMN note TEXT;`);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS masturbation_capture_sessions (
          chat_id TEXT PRIMARY KEY,
          prompt_message_id INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 19,
    up(db) {
      if (!tableHasColumn(db, 'masturbation_capture_sessions', 'reference_date')) {
        db.exec(`ALTER TABLE masturbation_capture_sessions ADD COLUMN reference_date TEXT;`);
      }
      if (!tableHasColumn(db, 'masturbation_capture_sessions', 'expires_at')) {
        db.exec(`ALTER TABLE masturbation_capture_sessions ADD COLUMN expires_at TEXT;`);
      }
    },
  },
  {
    version: 20,
    up(db) {
      db.exec(`
        CREATE TABLE startgg_videogame_preferences_next (
          videogame_id INTEGER PRIMARY KEY,
          videogame_name TEXT NOT NULL,
          preference TEXT NOT NULL CHECK (preference = 'follow'),
          updated_at TEXT NOT NULL
        );

        INSERT INTO startgg_videogame_preferences_next (
          videogame_id, videogame_name, preference, updated_at
        )
        SELECT videogame_id, videogame_name, preference, updated_at
        FROM startgg_videogame_preferences
        WHERE preference = 'follow';

        DROP TABLE startgg_videogame_preferences;
        ALTER TABLE startgg_videogame_preferences_next
          RENAME TO startgg_videogame_preferences;

        CREATE TABLE IF NOT EXISTS startgg_event_interest_dismissals (
          event_slug TEXT PRIMARY KEY,
          tournament_end_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    },
  },
];

export function runDbMigrations(db: Database.Database): void {
  let currentVersion = db.pragma('user_version', { simple: true }) as number;
  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }
    migration.up(db);
    db.pragma(`user_version = ${migration.version}`);
    currentVersion = migration.version;
  }
}
