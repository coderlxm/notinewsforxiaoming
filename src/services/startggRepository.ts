import { getDb } from '../reminders/db';

export type StartggWatchStatus = 'not_entered' | 'in_winners' | 'in_losers' | 'eliminated' | 'completed';

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

export function createStartggWatchEvent(eventSlug: string, eventName: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO startgg_watch_events (event_slug, event_name, active, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
  `).run(eventSlug, eventName, new Date().toISOString(), new Date().toISOString());
}

export function findStartggWatchEventBySlug(eventSlug: string): StartggWatchEvent | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM startgg_watch_events
    WHERE event_slug = ?
    LIMIT 1
  `).get(eventSlug);
  return (row as StartggWatchEvent) ?? null;
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

export function updateStartggWatchEventResolved(eventRowId: number, eventId: number, eventName: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE startgg_watch_events
    SET event_id = ?, event_name = ?, updated_at = ?
    WHERE id = ?
  `).run(eventId, eventName, new Date().toISOString(), eventRowId);
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
