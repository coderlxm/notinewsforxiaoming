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
