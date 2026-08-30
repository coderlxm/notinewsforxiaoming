import { getDb } from '../reminders/db.js';

export interface StartggPendingEvent {
  id: number;
  event_slug: string;
  event_name: string;
  tournament_name: string;
  tournament_end_at: string;
  videogame_id: number;
  videogame_name: string;
  player_names: string;
  prompt_message_id: number | null;
  created_at: string;
  updated_at: string;
}

export function isStartggVideogameFollowed(videogameId: number): boolean {
  const row = getDb().prepare(`
    SELECT 1
    FROM startgg_videogame_preferences
    WHERE videogame_id = ? AND preference = 'follow'
    LIMIT 1
  `).get(videogameId);
  return Boolean(row);
}

export function updateStartggWatchEventVideogame(
  eventSlug: string,
  videogameId: number,
  videogameName: string,
): void {
  getDb().prepare(`
    UPDATE startgg_watch_events
    SET videogame_id = ?, videogame_name = ?, updated_at = ?
    WHERE event_slug = ?
  `).run(videogameId, videogameName, new Date().toISOString(), eventSlug);
}

export function followStartggVideogame(
  videogameId: number,
  videogameName: string,
): void {
  getDb().prepare(`
    INSERT INTO startgg_videogame_preferences (
      videogame_id, videogame_name, preference, updated_at
    )
    VALUES (?, ?, 'follow', ?)
    ON CONFLICT(videogame_id) DO UPDATE SET
      videogame_name = excluded.videogame_name,
      updated_at = excluded.updated_at
  `).run(videogameId, videogameName, new Date().toISOString());
}

export function hasStartggEventInterestOverride(eventSlug: string): boolean {
  return Boolean(getDb().prepare(`
    SELECT 1
    FROM startgg_event_interest_overrides
    WHERE event_slug = ? AND tournament_end_at > ?
    LIMIT 1
  `).get(eventSlug, new Date().toISOString()));
}

export function addStartggEventInterestOverride(
  eventSlug: string,
  tournamentEndAt: string,
): void {
  getDb().prepare(`
    INSERT INTO startgg_event_interest_overrides (
      event_slug, tournament_end_at, created_at
    )
    VALUES (?, ?, ?)
    ON CONFLICT(event_slug) DO UPDATE SET
      tournament_end_at = excluded.tournament_end_at
  `).run(eventSlug, tournamentEndAt, new Date().toISOString());
}

export function isStartggEventDismissed(eventSlug: string): boolean {
  return Boolean(getDb().prepare(`
    SELECT 1
    FROM startgg_event_interest_dismissals
    WHERE event_slug = ? AND tournament_end_at > ?
    LIMIT 1
  `).get(eventSlug, new Date().toISOString()));
}

export function dismissStartggEvent(eventSlug: string, tournamentEndAt: string): void {
  getDb().prepare(`
    INSERT INTO startgg_event_interest_dismissals (
      event_slug, tournament_end_at, created_at
    )
    VALUES (?, ?, ?)
    ON CONFLICT(event_slug) DO UPDATE SET
      tournament_end_at = excluded.tournament_end_at
  `).run(eventSlug, tournamentEndAt, new Date().toISOString());
}

export function upsertStartggPendingEvent(input: {
  eventSlug: string;
  eventName: string;
  tournamentName: string;
  tournamentEndAt: string;
  videogameId: number;
  videogameName: string;
  playerNames: string[];
}): void {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO startgg_pending_events (
      event_slug,
      event_name,
      tournament_name,
      tournament_end_at,
      videogame_id,
      videogame_name,
      player_names,
      prompt_message_id,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(event_slug) DO UPDATE SET
      event_name = excluded.event_name,
      tournament_name = excluded.tournament_name,
      tournament_end_at = excluded.tournament_end_at,
      videogame_id = excluded.videogame_id,
      videogame_name = excluded.videogame_name,
      player_names = excluded.player_names,
      updated_at = excluded.updated_at
  `).run(
    input.eventSlug,
    input.eventName,
    input.tournamentName,
    input.tournamentEndAt,
    input.videogameId,
    input.videogameName,
    JSON.stringify(input.playerNames),
    now,
    now,
  );
}

export function listStartggPendingEventsNeedingPrompt(): StartggPendingEvent[] {
  return getDb().prepare(`
    SELECT pending.*
    FROM startgg_pending_events pending
    WHERE pending.prompt_message_id IS NULL
      AND pending.tournament_end_at > ?
      AND NOT EXISTS (
        SELECT 1
        FROM startgg_pending_events prompted
        WHERE prompted.videogame_id = pending.videogame_id
          AND prompted.prompt_message_id IS NOT NULL
      )
      AND pending.id = (
        SELECT MIN(first_pending.id)
        FROM startgg_pending_events first_pending
        WHERE first_pending.videogame_id = pending.videogame_id
          AND first_pending.prompt_message_id IS NULL
      )
    ORDER BY pending.id ASC
  `).all(new Date().toISOString()) as StartggPendingEvent[];
}

export function markStartggPendingEventPrompted(id: number, messageId: number): void {
  getDb().prepare(`
    UPDATE startgg_pending_events
    SET prompt_message_id = ?, updated_at = ?
    WHERE id = ?
  `).run(messageId, new Date().toISOString(), id);
}

export function findStartggPendingEventById(id: number): StartggPendingEvent | null {
  const row = getDb().prepare(`
    SELECT *
    FROM startgg_pending_events
    WHERE id = ?
    LIMIT 1
  `).get(id);
  return (row as StartggPendingEvent) ?? null;
}

export function deleteStartggPendingEventsByVideogame(videogameId: number): void {
  getDb().prepare(`
    DELETE FROM startgg_pending_events
    WHERE videogame_id = ?
  `).run(videogameId);
}

export function deleteStartggPendingEvent(id: number): void {
  getDb().prepare(`
    DELETE FROM startgg_pending_events
    WHERE id = ?
  `).run(id);
}

export function deleteExpiredStartggInterestState(): void {
  const now = new Date().toISOString();
  const db = getDb();
  const clear = db.transaction(() => {
    db.prepare(`
      DELETE FROM startgg_pending_events
      WHERE tournament_end_at <= ?
    `).run(now);
    db.prepare(`
      DELETE FROM startgg_event_interest_overrides
      WHERE tournament_end_at <= ?
    `).run(now);
    db.prepare(`
      DELETE FROM startgg_event_interest_dismissals
      WHERE tournament_end_at <= ?
    `).run(now);
  });
  clear();
}

export function deactivateStartggWatchEventBySlug(eventSlug: string): void {
  getDb().prepare(`
    UPDATE startgg_watch_events
    SET active = 0, updated_at = ?
    WHERE event_slug = ?
  `).run(new Date().toISOString(), eventSlug);
}
