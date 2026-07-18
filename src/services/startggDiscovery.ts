import type { StartggWatchPlayer } from './startggRepository.js';
import {
  fetchPlayerRecentSets,
  fetchTournamentCandidateIdentities,
  fetchTournamentCandidates,
} from './startgg/client.js';
import { normalizeEventSlug } from './startgg/tracker.js';
import {
  resolveStartggEntrantIdentities,
  type StartggEntrantMatchKind,
} from './startggIdentity.js';

const STREET_FIGHTER_6_VIDEOGAME_ID = 43868;
const STARTGG_GO_SET_LOOKBACK_SECONDS = 7 * 24 * 60 * 60;
const STARTGG_ACTIVE_EVENT_LOOKBACK_SECONDS = 2 * 24 * 60 * 60;
const STARTGG_TOURNAMENT_ACTIVITY_LOOKBACK_SECONDS = 48 * 60 * 60;

export interface StartggDiscoveredEntrantMapping {
  watchPlayerId: number;
  entrantId: number;
  entrantName: string;
  matchKind: StartggEntrantMatchKind;
}

export interface StartggDiscoveredEvent {
  tournamentId: number;
  tournamentName: string;
  tournamentSlug: string;
  tournamentEndAt: number;
  eventId: number;
  eventSlug: string;
  eventName: string;
  eventDisplayName: string;
  entrantMappings: StartggDiscoveredEntrantMapping[];
}

function nowAsStartggTimestamp(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

function isActiveTournament(nowTimestamp: number, startAt: number, endAt: number): boolean {
  return startAt <= nowTimestamp && nowTimestamp <= endAt;
}

function hasRecentEventActivity(
  nowTimestamp: number,
  eventStartAt: number | null,
  setCompletedAt: number | null,
): boolean {
  const cutoff = nowTimestamp - STARTGG_ACTIVE_EVENT_LOOKBACK_SECONDS;
  if (setCompletedAt !== null) {
    return setCompletedAt >= cutoff;
  }
  return eventStartAt !== null && eventStartAt <= nowTimestamp && eventStartAt >= cutoff;
}

export async function discoverStartggActiveEventsForPlayers(
  players: StartggWatchPlayer[],
  now = new Date(),
): Promise<StartggDiscoveredEvent[]> {
  const nowTimestamp = nowAsStartggTimestamp(now);
  const computedUpdatedAt = nowTimestamp - STARTGG_TOURNAMENT_ACTIVITY_LOOKBACK_SECONDS;
  const tournaments = await fetchTournamentCandidates(
    STREET_FIGHTER_6_VIDEOGAME_ID,
    computedUpdatedAt,
  );
  for (const tournament of tournaments) {
    if (!tournament.slug) {
      throw new Error(`start.gg tournament missing slug: ${tournament.name}`);
    }
    if (tournament.startAt === null || tournament.endAt === null) {
      throw new Error(`start.gg tournament missing startAt/endAt: ${tournament.name}`);
    }
  }
  const activeTournaments = tournaments.filter((tournament) =>
    tournament.startAt! <= nowTimestamp && nowTimestamp <= tournament.endAt!,
  );
  const identities = await fetchTournamentCandidateIdentities(
    activeTournaments,
    players.map((player) => ({
      watchPlayerId: player.id,
      userId: player.user_id,
      gamerTag: player.gamer_tag,
    })),
    STREET_FIGHTER_6_VIDEOGAME_ID,
  );
  const matches = resolveStartggEntrantIdentities(players, identities);
  const tournamentById = new Map(activeTournaments.map((tournament) => [tournament.id, tournament]));
  const events = new Map<string, StartggDiscoveredEvent>();

  for (const match of matches) {
    const tournament = tournamentById.get(match.tournamentId);
    if (!tournament?.slug || tournament.endAt === null) {
      throw new Error(`start.gg active tournament metadata missing: ${match.tournamentId}`);
    }
    const eventSlug = normalizeEventSlug(match.eventSlug);
    const existing = events.get(eventSlug);
    const mapping: StartggDiscoveredEntrantMapping = {
      watchPlayerId: match.watchPlayerId,
      entrantId: match.entrantId,
      entrantName: match.entrantName,
      matchKind: match.matchKind,
    };
    if (existing) {
      const existingMapping = existing.entrantMappings.find((item) => item.watchPlayerId === match.watchPlayerId);
      if (existingMapping && existingMapping.entrantId !== match.entrantId) {
        throw new Error(`start.gg discovered entrant conflict: player ${match.watchPlayerId}, event ${match.eventId}`);
      }
      if (!existingMapping) {
        existing.entrantMappings.push(mapping);
      }
      continue;
    }
    events.set(eventSlug, {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      tournamentEndAt: tournament.endAt,
      eventId: match.eventId,
      eventSlug,
      eventName: `${tournament.name} / ${match.eventName}`,
      eventDisplayName: match.eventName,
      entrantMappings: [mapping],
    });
  }

  const updatedAfter = nowTimestamp - STARTGG_GO_SET_LOOKBACK_SECONDS;
  for (const player of players) {
    const sets = await fetchPlayerRecentSets(player.player_id, updatedAfter);
    for (const set of sets) {
      const event = set.event;
      if (!event) {
        throw new Error(`start.gg set missing event: ${set.id}`);
      }
      if (!event.slug) {
        throw new Error(`start.gg event missing slug: ${event.name}`);
      }
      if (!event.tournament) {
        throw new Error(`start.gg event missing tournament: ${event.name}`);
      }
      if (!event.tournament.slug) {
        throw new Error(`start.gg tournament missing slug: ${event.tournament.name}`);
      }
      if (event.tournament.startAt === null || event.tournament.endAt === null) {
        throw new Error(`start.gg tournament missing startAt/endAt: ${event.tournament.name}`);
      }
      if (!isActiveTournament(nowTimestamp, event.tournament.startAt, event.tournament.endAt)) continue;
      if (!hasRecentEventActivity(nowTimestamp, event.startAt, set.completedAt)) continue;

      const eventSlug = normalizeEventSlug(event.slug);
      if (events.has(eventSlug)) continue;
      events.set(eventSlug, {
        tournamentId: event.tournament.id,
        tournamentName: event.tournament.name,
        tournamentSlug: event.tournament.slug,
        tournamentEndAt: event.tournament.endAt,
        eventId: event.id,
        eventSlug,
        eventName: `${event.tournament.name} / ${event.name}`,
        eventDisplayName: event.name,
        entrantMappings: [],
      });
    }
  }

  for (const event of events.values()) {
    event.entrantMappings.sort((a, b) => a.watchPlayerId - b.watchPlayerId);
  }
  return Array.from(events.values()).sort((a, b) => a.eventName.localeCompare(b.eventName));
}
