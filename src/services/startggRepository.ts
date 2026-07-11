import { getDb } from '../reminders/db.js';

export type StartggWatchStatus = 'not_entered' | 'in_winners' | 'in_losers' | 'eliminated' | 'completed';
export type StartggWatchEventSource = 'manual' | 'auto';

export interface StartggWatchPlayer {
  id: number;
  player_id: number;
  player_name: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface StartggWatchEvent {
  id: number;
  event_slug: string;
  event_name: string;
  event_id: number | null;
  active: number;
  subscription_source: StartggWatchEventSource;
  tournament_end_at: string | null;
  tournament_name: string | null;
  event_display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartggWatchSnapshot {
  id: number;
  watch_player_id: number;
  watch_event_id: number;
  status: StartggWatchStatus;
  placement: number | null;
  last_set_id: number | null;
  last_set_round: number | null;
  last_set_round_label: string | null;
  last_set_score_text: string | null;
  last_set_state: number | null;
  initial_message_sent: number;
  captured_at: string;
}

export interface UpsertStartggSnapshotInput {
  watch_player_id: number;
  watch_event_id: number;
  status: StartggWatchStatus;
  placement: number | null;
  last_set_id: number | null;
  last_set_round: number | null;
  last_set_round_label: string | null;
  last_set_score_text: string | null;
  last_set_state: number | null;
  captured_at: string;
}

export interface StartggWatchStatusView {
  player_name: string;
  event_name: string;
  event_slug: string;
  status: StartggWatchStatus;
  placement: number | null;
  last_set_round_label: string | null;
  last_set_score_text: string | null;
  captured_at: string;
}

export function isStartggPollingPersistedEnabled(): boolean {
  const row = getDb().prepare(`
    SELECT polling_enabled
    FROM startgg_runtime_settings
    WHERE id = 1
  `).get() as { polling_enabled: number } | undefined;
  return row?.polling_enabled === 1;
}

export function setStartggPollingPersistedEnabled(enabled: boolean): void {
  getDb().prepare(`
    INSERT INTO startgg_runtime_settings (id, polling_enabled, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      polling_enabled = excluded.polling_enabled,
      updated_at = excluded.updated_at
  `).run(enabled ? 1 : 0, new Date().toISOString());
}

function clearStartggWatchEventState(db: ReturnType<typeof getDb>, eventRowId: number): void {
  db.prepare(`DELETE FROM startgg_watch_snapshots WHERE watch_event_id = ?`).run(eventRowId);
  db.prepare(`DELETE FROM startgg_watch_event_entrants WHERE watch_event_id = ?`).run(eventRowId);
  db.prepare(`DELETE FROM startgg_pushed_sets WHERE watch_event_id = ?`).run(eventRowId);
}

export function createStartggWatchPlayer(playerId: number, playerName: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO startgg_watch_players (player_id, player_name, enabled, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
  `).run(playerId, playerName, new Date().toISOString(), new Date().toISOString());
}

export function findStartggWatchPlayerByPlayerId(playerId: number): StartggWatchPlayer | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM startgg_watch_players
    WHERE player_id = ?
    LIMIT 1
  `).get(playerId);
  return (row as StartggWatchPlayer) ?? null;
}

export function updateStartggWatchPlayerName(id: number, playerName: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE startgg_watch_players
    SET player_name = ?, updated_at = ?
    WHERE id = ?
  `).run(playerName, new Date().toISOString(), id);
}

export function replaceActiveStartggWatchEvent(
  eventSlug: string,
  eventName: string,
  tournamentName: string,
  eventDisplayName: string,
  tournamentEndAt: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const replace = db.transaction(() => {
    db.prepare(`
      UPDATE startgg_watch_events
      SET active = 0, updated_at = ?
      WHERE active = 1
    `).run(now);
    db.prepare(`
      INSERT INTO startgg_watch_events (
        event_slug,
        event_name,
        active,
        subscription_source,
        tournament_end_at,
        tournament_name,
        event_display_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, 1, 'manual', ?, ?, ?, ?, ?)
      ON CONFLICT(event_slug) DO UPDATE SET
        event_name = excluded.event_name,
        active = 1,
        subscription_source = 'manual',
        tournament_end_at = excluded.tournament_end_at,
        tournament_name = excluded.tournament_name,
        event_display_name = excluded.event_display_name,
        updated_at = excluded.updated_at
    `).run(eventSlug, eventName, tournamentEndAt, tournamentName, eventDisplayName, now, now);
    const event = db.prepare(`
      SELECT id
      FROM startgg_watch_events
      WHERE event_slug = ?
      LIMIT 1
    `).get(eventSlug) as { id: number };
    clearStartggWatchEventState(db, event.id);
  });
  replace();
}

export function replaceActiveStartggWatchEvents(events: Array<{
  event_slug: string;
  event_name: string;
  event_id: number;
  tournament_end_at: string;
  tournament_name: string;
  event_display_name: string;
}>, source: StartggWatchEventSource = 'manual'): void {
  if (events.length === 0) {
    throw new Error('start.gg go did not discover any events.');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const activeEventSlugs = new Set(
    (db.prepare(`
      SELECT event_slug
      FROM startgg_watch_events
      WHERE active = 1
    `).all() as Array<{ event_slug: string }>).map((event) => event.event_slug),
  );
  const replace = db.transaction(() => {
    db.prepare(`
      UPDATE startgg_watch_events
      SET active = 0, updated_at = ?
      WHERE active = 1
    `).run(now);

    const upsert = db.prepare(`
      INSERT INTO startgg_watch_events (
        event_slug,
        event_name,
        event_id,
        active,
        subscription_source,
        tournament_end_at,
        tournament_name,
        event_display_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_slug) DO UPDATE SET
        event_name = excluded.event_name,
        event_id = excluded.event_id,
        active = 1,
        subscription_source = excluded.subscription_source,
        tournament_end_at = excluded.tournament_end_at,
        tournament_name = excluded.tournament_name,
        event_display_name = excluded.event_display_name,
        updated_at = excluded.updated_at
    `);

    for (const event of events) {
      upsert.run(event.event_slug, event.event_name, event.event_id, source, event.tournament_end_at, event.tournament_name, event.event_display_name, now, now);
      const eventRow = db.prepare(`
        SELECT id
        FROM startgg_watch_events
        WHERE event_slug = ?
        LIMIT 1
      `).get(event.event_slug) as { id: number };
      if (!activeEventSlugs.has(event.event_slug)) {
        clearStartggWatchEventState(db, eventRow.id);
      }
    }
  });
  replace();
}

export function syncAutoDiscoveredStartggWatchEvents(events: Array<{
  event_slug: string;
  event_name: string;
  event_id: number;
  tournament_end_at: string;
  tournament_name: string;
  event_display_name: string;
}>): void {
  const db = getDb();
  const now = new Date().toISOString();
  const sync = db.transaction(() => {
    const manualEvent = db.prepare(`
      SELECT 1
      FROM startgg_watch_events
      WHERE active = 1 AND subscription_source = 'manual'
      LIMIT 1
    `).get();
    if (manualEvent) return;

    const findExisting = db.prepare(`
      SELECT id, active, subscription_source
      FROM startgg_watch_events
      WHERE event_slug = ?
      LIMIT 1
    `);
    const existingEvents = new Map<string, {
      id: number;
      active: number;
      subscription_source: StartggWatchEventSource;
    }>();
    for (const event of events) {
      const existing = findExisting.get(event.event_slug) as {
        id: number;
        active: number;
        subscription_source: StartggWatchEventSource;
      } | undefined;
      if (existing) {
        existingEvents.set(event.event_slug, existing);
      }
    }

    db.prepare(`
      UPDATE startgg_watch_events
      SET active = 0, updated_at = ?
      WHERE active = 1
        AND subscription_source = 'auto'
        AND tournament_end_at <= ?
    `).run(now, now);

    const upsert = db.prepare(`
      INSERT INTO startgg_watch_events (
        event_slug,
        event_name,
        event_id,
        active,
        subscription_source,
        tournament_end_at,
        tournament_name,
        event_display_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_slug) DO UPDATE SET
        event_name = excluded.event_name,
        event_id = excluded.event_id,
        active = 1,
        subscription_source = excluded.subscription_source,
        tournament_end_at = excluded.tournament_end_at,
        tournament_name = excluded.tournament_name,
        event_display_name = excluded.event_display_name,
        updated_at = excluded.updated_at
    `);

    for (const event of events) {
      const existing = existingEvents.get(event.event_slug);
      const source = existing?.active === 1 && existing.subscription_source === 'manual'
        ? 'manual'
        : 'auto';
      upsert.run(event.event_slug, event.event_name, event.event_id, source, event.tournament_end_at, event.tournament_name, event.event_display_name, now, now);
      if (existing && existing.active === 0) {
        clearStartggWatchEventState(db, existing.id);
      }
    }
  });
  sync();
}

export function resetActiveStartggWatchEventStates(): void {
  const db = getDb();
  const activeEvents = db.prepare(`
    SELECT id
    FROM startgg_watch_events
    WHERE active = 1
  `).all() as Array<{ id: number }>;
  const reset = db.transaction(() => {
    for (const event of activeEvents) {
      clearStartggWatchEventState(db, event.id);
    }
  });
  reset();
}

export function findStartggWatchEventById(id: number): StartggWatchEvent | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM startgg_watch_events
    WHERE id = ?
    LIMIT 1
  `).get(id);
  return (row as StartggWatchEvent) ?? null;
}

export function listStartggWatchPlayers(): StartggWatchPlayer[] {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM startgg_watch_players
    ORDER BY id ASC
  `).all() as StartggWatchPlayer[];
}

export function listStartggWatchEvents(): StartggWatchEvent[] {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM startgg_watch_events
    ORDER BY id ASC
  `).all() as StartggWatchEvent[];
}

export function listEnabledStartggWatchPlayers(): StartggWatchPlayer[] {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM startgg_watch_players
    WHERE enabled = 1
    ORDER BY id ASC
  `).all() as StartggWatchPlayer[];
}

export function listActiveStartggWatchEvents(): StartggWatchEvent[] {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM startgg_watch_events
    WHERE active = 1
    ORDER BY id ASC
  `).all() as StartggWatchEvent[];
}

export function findStartggWatchSnapshot(watchPlayerId: number, watchEventId: number): StartggWatchSnapshot | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM startgg_watch_snapshots
    WHERE watch_player_id = ? AND watch_event_id = ?
    LIMIT 1
  `).get(watchPlayerId, watchEventId);
  return (row as StartggWatchSnapshot) ?? null;
}

export function upsertStartggWatchSnapshot(input: UpsertStartggSnapshotInput): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO startgg_watch_snapshots (
      watch_player_id,
      watch_event_id,
      status,
      placement,
      last_set_id,
      last_set_round,
      last_set_round_label,
      last_set_score_text,
      last_set_state,
      captured_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(watch_player_id, watch_event_id) DO UPDATE SET
      status = excluded.status,
      placement = excluded.placement,
      last_set_id = excluded.last_set_id,
      last_set_round = excluded.last_set_round,
      last_set_round_label = excluded.last_set_round_label,
      last_set_score_text = excluded.last_set_score_text,
      last_set_state = excluded.last_set_state,
      captured_at = excluded.captured_at
  `).run(
    input.watch_player_id,
    input.watch_event_id,
    input.status,
    input.placement,
    input.last_set_id,
    input.last_set_round,
    input.last_set_round_label,
    input.last_set_score_text,
    input.last_set_state,
    input.captured_at
  );
}

export function updateStartggWatchEventResolved(
  eventRowId: number,
  eventId: number,
  eventName: string,
  tournamentEndAt: string,
  tournamentName: string,
  eventDisplayName: string,
): void {
  const db = getDb();
  db.prepare(`
    UPDATE startgg_watch_events
    SET event_id = ?, event_name = ?, tournament_end_at = ?, tournament_name = ?, event_display_name = ?, updated_at = ?
    WHERE id = ?
  `).run(eventId, eventName, tournamentEndAt, tournamentName, eventDisplayName, new Date().toISOString(), eventRowId);
}

export interface StartggWatchEventEntrant {
  id: number;
  watch_player_id: number;
  watch_event_id: number;
  entrant_id: number | null;
  entrant_name: string | null;
}

export function upsertStartggWatchEventEntrant(input: {
  watch_player_id: number;
  watch_event_id: number;
  entrant_id: number | null;
  entrant_name: string | null;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO startgg_watch_event_entrants (
      watch_player_id, watch_event_id, entrant_id, entrant_name
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(watch_player_id, watch_event_id) DO UPDATE SET
      entrant_id = excluded.entrant_id,
      entrant_name = excluded.entrant_name
  `).run(input.watch_player_id, input.watch_event_id, input.entrant_id, input.entrant_name);
}

export function findStartggWatchEventEntrant(
  watchPlayerId: number,
  watchEventId: number
): StartggWatchEventEntrant | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM startgg_watch_event_entrants
    WHERE watch_player_id = ? AND watch_event_id = ?
    LIMIT 1
  `).get(watchPlayerId, watchEventId);
  return (row as StartggWatchEventEntrant) ?? null;
}

export function listStartggWatchEventEntrantsByEvent(
  watchEventId: number
): StartggWatchEventEntrant[] {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM startgg_watch_event_entrants
    WHERE watch_event_id = ?
    ORDER BY id ASC
  `).all(watchEventId) as StartggWatchEventEntrant[];
}

export function hasStartggPushedSet(watchPlayerId: number, watchEventId: number, setId: number): boolean {
  const db = getDb();
  const row = db.prepare(`
    SELECT 1
    FROM startgg_pushed_sets
    WHERE watch_player_id = ? AND watch_event_id = ? AND set_id = ?
    LIMIT 1
  `).get(watchPlayerId, watchEventId, setId);
  return Boolean(row);
}

export function markStartggPushedSet(watchPlayerId: number, watchEventId: number, setId: number): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO startgg_pushed_sets (watch_player_id, watch_event_id, set_id, pushed_at)
    VALUES (?, ?, ?, ?)
  `).run(watchPlayerId, watchEventId, setId, new Date().toISOString());
}

export function recordStartggSentMessage(messageId: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO startgg_sent_messages (message_id, sent_at)
    VALUES (?, ?)
  `).run(messageId, new Date().toISOString());
}

export function markStartggInitialMessageSent(watchPlayerId: number, watchEventId: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE startgg_watch_snapshots
    SET initial_message_sent = 1
    WHERE watch_player_id = ? AND watch_event_id = ?
  `).run(watchPlayerId, watchEventId);
}

export function listStartggSentMessageIds(): number[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT message_id
    FROM startgg_sent_messages
    ORDER BY message_id ASC
  `).all() as Array<{ message_id: number }>;
  return rows.map((row) => row.message_id);
}

export function clearStartggWatchState(): void {
  const db = getDb();
  const clear = db.transaction(() => {
    db.prepare('DELETE FROM startgg_sent_messages').run();
    db.prepare('DELETE FROM startgg_pushed_sets').run();
    db.prepare('DELETE FROM startgg_watch_event_entrants').run();
    db.prepare('DELETE FROM startgg_watch_snapshots').run();
    db.prepare('DELETE FROM startgg_watch_events').run();
  });
  clear();
}

export function listStartggWatchStatusViews(): StartggWatchStatusView[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      p.player_name,
      e.event_name,
      e.event_slug,
      s.status,
      s.placement,
      s.last_set_round_label,
      s.last_set_score_text,
      s.captured_at
    FROM startgg_watch_snapshots s
    JOIN startgg_watch_players p ON p.id = s.watch_player_id
    JOIN startgg_watch_events e ON e.id = s.watch_event_id
    WHERE p.enabled = 1 AND e.active = 1
    ORDER BY s.captured_at DESC, s.id DESC
  `).all() as StartggWatchStatusView[];
}
