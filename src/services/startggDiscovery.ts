import type { StartggWatchPlayer } from './startggRepository.js';
import { fetchPlayerRecentSets } from './startgg/client.js';
import { normalizeEventSlug } from './startgg/tracker.js';

const STARTGG_GO_SET_LOOKBACK_SECONDS = 7 * 24 * 60 * 60;

export interface StartggDiscoveredEvent {
  eventId: number;
  eventSlug: string;
  eventName: string;
}

function nowAsStartggTimestamp(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

function isActiveTournament(nowTimestamp: number, startAt: number, endAt: number): boolean {
  return startAt <= nowTimestamp && nowTimestamp <= endAt;
}

export async function discoverStartggActiveEventsForPlayers(
  players: StartggWatchPlayer[],
  now = new Date(),
): Promise<StartggDiscoveredEvent[]> {
  const nowTimestamp = nowAsStartggTimestamp(now);
  const updatedAfter = nowTimestamp - STARTGG_GO_SET_LOOKBACK_SECONDS;
  const events = new Map<string, StartggDiscoveredEvent>();

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
      if (event.tournament.startAt === null || event.tournament.endAt === null) {
        throw new Error(`start.gg tournament missing startAt/endAt: ${event.tournament.name}`);
      }
      if (!isActiveTournament(nowTimestamp, event.tournament.startAt, event.tournament.endAt)) continue;

      const eventSlug = normalizeEventSlug(event.slug);
      const eventName = `${event.tournament.name} / ${event.name}`;
      events.set(eventSlug, {
        eventId: event.id,
        eventSlug,
        eventName,
      });
    }
  }

  return Array.from(events.values()).sort((a, b) => a.eventName.localeCompare(b.eventName));
}
