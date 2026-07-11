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
