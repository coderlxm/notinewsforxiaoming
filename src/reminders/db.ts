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

      CREATE TABLE IF NOT EXISTS push_batch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dedupe_key TEXT NOT NULL,
        pushed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_push_batch_history_dedupe
      ON push_batch_history(dedupe_key);

      CREATE TABLE IF NOT EXISTS av_source_health (
        source_key TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('up', 'down')),
        last_error_type TEXT,
        last_error_message TEXT,
        last_error_at TEXT,
        last_alert_at TEXT,
        last_recovered_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS v2ex_buffer_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_date TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'v2ex',
        is_holiday INTEGER NOT NULL DEFAULT 1,
        consumed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_v2ex_batch_consumed
      ON v2ex_buffer_batches(consumed, batch_date);

      CREATE TABLE IF NOT EXISTS v2ex_buffer_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        topic_id TEXT,
        topic_url TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        reply_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(batch_id) REFERENCES v2ex_buffer_batches(id)
      );
      CREATE INDEX IF NOT EXISTS idx_v2ex_item_topic
      ON v2ex_buffer_items(topic_id);

      CREATE TABLE IF NOT EXISTS vitamin_reminders (
        date_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS vitamin_sent_messages (
        date_key TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        PRIMARY KEY (date_key, message_id)
      );

      CREATE TABLE IF NOT EXISTS startgg_watch_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL UNIQUE,
        player_name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS startgg_watch_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_slug TEXT NOT NULL UNIQUE,
        event_name TEXT NOT NULL,
        event_id INTEGER,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS startgg_watch_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_player_id INTEGER NOT NULL,
        watch_event_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('not_entered', 'in_winners', 'in_losers', 'eliminated', 'completed')),
        placement INTEGER,
        last_set_id INTEGER,
        last_set_round INTEGER,
        last_set_round_label TEXT,
        last_set_score_text TEXT,
        last_set_state INTEGER,
        captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(watch_player_id) REFERENCES startgg_watch_players(id),
        FOREIGN KEY(watch_event_id) REFERENCES startgg_watch_events(id),
        UNIQUE(watch_player_id, watch_event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_startgg_snapshot_player_event
      ON startgg_watch_snapshots(watch_player_id, watch_event_id);

      CREATE TABLE IF NOT EXISTS startgg_watch_event_entrants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_player_id INTEGER NOT NULL,
        watch_event_id INTEGER NOT NULL,
        entrant_id INTEGER,
        entrant_name TEXT,
        FOREIGN KEY(watch_player_id) REFERENCES startgg_watch_players(id),
        FOREIGN KEY(watch_event_id) REFERENCES startgg_watch_events(id),
        UNIQUE(watch_player_id, watch_event_id)
      );

      CREATE TABLE IF NOT EXISTS startgg_pushed_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_player_id INTEGER NOT NULL,
        watch_event_id INTEGER NOT NULL,
        set_id INTEGER NOT NULL,
        pushed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(watch_player_id) REFERENCES startgg_watch_players(id),
        FOREIGN KEY(watch_event_id) REFERENCES startgg_watch_events(id),
        UNIQUE(watch_player_id, watch_event_id, set_id)
      );
      CREATE INDEX IF NOT EXISTS idx_startgg_pushed_sets_player_event
      ON startgg_pushed_sets(watch_player_id, watch_event_id);
    `);

    const pushHistoryColumns = db.prepare(`PRAGMA table_info(push_history)`).all() as Array<{ name: string }>;
    const hasCoverSent = pushHistoryColumns.some((column) => column.name === 'cover_sent');
    if (!hasCoverSent) {
      db.exec(`ALTER TABLE push_history ADD COLUMN cover_sent INTEGER NOT NULL DEFAULT 0;`);
    }
  }
  return db;
}
