import axios from 'axios';
import type { Telegraf } from 'telegraf';
import { config } from '../config';
import { formatStartggStatusChangedMessage } from '../formatters/startggFormatter';
import { sendTelegramMessage } from '../publishers/telegram';
import {
  findStartggWatchSnapshot,
  listActiveStartggWatchEvents,
  listEnabledStartggWatchPlayers,
  type StartggWatchStatus,
  upsertStartggWatchSnapshot,
  updateStartggWatchEventResolved,
} from './startggRepository';

const STARTGG_GRAPHQL_ENDPOINT = 'https://api.start.gg/gql/alpha';
const SETS_PAGE = 1;
const SETS_PER_PAGE = 250;
const ENTRANTS_PAGE = 1;
const ENTRANTS_PER_PAGE = 500;
const STANDINGS_PAGE = 1;
const STANDINGS_PER_PAGE = 500;

const EVENT_TRACKING_QUERY = `
query EventTracking(
  $slug: String!,
  $setsPage: Int!,
  $setsPerPage: Int!,
  $entrantsPage: Int!,
  $entrantsPerPage: Int!,
  $standingsPage: Int!,
  $standingsPerPage: Int!
) {
  event(slug: $slug) {
    id
    name
    slug
    tournament {
      id
      name
    }
    sets(page: $setsPage, perPage: $setsPerPage, sortType: STANDARD) {
      nodes {
        id
        state
        round
        fullRoundText
        displayScore
        winnerId
        completedAt
        slots {
          entrant {
            id
            name
          }
          standing {
            stats {
              score {
                value
              }
            }
          }
        }
      }
    }
    entrants(query: { page: $entrantsPage, perPage: $entrantsPerPage }) {
      nodes {
        id
        name
        participants {
          player {
            id
          }
        }
      }
    }
    standings(query: { page: $standingsPage, perPage: $standingsPerPage }) {
      nodes {
        placement
        entrant {
          id
        }
      }
    }
  }
}
`;

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface EventTrackingResponse {
  event: {
    id: number;
    name: string;
    slug: string | null;
    tournament: {
      id: number;
      name: string;
    } | null;
    sets: {
      nodes: Array<{
        id: number;
        state: number | null;
        round: number | null;
        fullRoundText: string | null;
        displayScore: string | null;
        winnerId: number | null;
        completedAt: number | null;
        slots: Array<{
          entrant: {
            id: number;
            name: string;
          } | null;
          standing: {
            stats: {
              score: {
                value: number | null;
              } | null;
            } | null;
          } | null;
        }>;
      }>;
    };
    entrants: {
      nodes: Array<{
        id: number;
        name: string;
        participants: Array<{
          player: {
            id: number;
          } | null;
        }>;
      }>;
    };
    standings: {
      nodes: Array<{
        placement: number;
        entrant: {
          id: number;
        } | null;
      }>;
    };
  } | null;
}

interface PlayerStatusSnapshot {
  status: StartggWatchStatus;
  placement: number | null;
  lastSetId: number | null;
  lastSetRound: number | null;
  lastSetRoundLabel: string | null;
  lastSetScoreText: string | null;
  lastSetState: number | null;
  setPageUrl: string | null;
}

export interface StartggWatchSummary {
  checkedPlayers: number;
  checkedEvents: number;
  changed: number;
}

export function normalizeEventSlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('start.gg event slug cannot be empty.');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const tournamentIndex = parts.indexOf('tournament');
    const eventIndex = parts.indexOf('event');
    if (tournamentIndex < 0 || eventIndex < 0 || eventIndex !== tournamentIndex + 2) {
      throw new Error(`Invalid start.gg event URL: ${raw}`);
    }
    const tournamentSlug = parts[tournamentIndex + 1];
    const eventSlug = parts[eventIndex + 1];
    if (!tournamentSlug || !eventSlug) {
      throw new Error(`Invalid start.gg event URL: ${raw}`);
    }
    return `tournament/${tournamentSlug}/event/${eventSlug}`;
  }
  return trimmed.replace(/^\/+/, '');
}

async function queryStartgg<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
  if (!config.startggApiToken) {
    throw new Error('STARTGG_API_TOKEN is not set.');
  }

  const response = await axios.post<GraphqlResponse<TData>>(
    STARTGG_GRAPHQL_ENDPOINT,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${config.startggApiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  if (response.data.errors && response.data.errors.length > 0) {
    throw new Error(`start.gg GraphQL error: ${response.data.errors[0].message}`);
  }
  if (!response.data.data) {
    throw new Error('start.gg GraphQL returned empty data.');
  }
  return response.data.data;
}

function buildSetScoreText(slots: Array<{ standing: { stats: { score: { value: number | null } | null } | null } | null }>, displayScore: string | null): string | null {
  if (displayScore && displayScore.trim()) {
    return displayScore.trim();
  }
  if (slots.length < 2) {
    return null;
  }
  const left = slots[0]?.standing?.stats?.score?.value;
  const right = slots[1]?.standing?.stats?.score?.value;
  if (left === null || left === undefined || right === null || right === undefined) {
    return null;
  }
  return `${left}-${right}`;
}

function compareSetRecency(a: { completedAt: number | null; id: number }, b: { completedAt: number | null; id: number }): number {
  const aTime = a.completedAt ?? 0;
  const bTime = b.completedAt ?? 0;
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  return b.id - a.id;
}

function computePlayerSnapshot(
  eventSlug: string,
  event: EventTrackingResponse['event'],
  watchPlayerId: number
): PlayerStatusSnapshot {
  if (!event) {
    throw new Error(`Event not found for slug ${eventSlug}`);
  }
  if (!event.slug) {
    throw new Error(`Event slug is empty: ${eventSlug}`);
  }

  const entrant = event.entrants.nodes.find((node) =>
    node.participants.some((participant) => participant.player?.id === watchPlayerId)
  );

  if (!entrant) {
    return {
      status: 'not_entered',
      placement: null,
      lastSetId: null,
      lastSetRound: null,
      lastSetRoundLabel: null,
      lastSetScoreText: null,
      lastSetState: null,
      setPageUrl: null,
    };
  }

  const playerSets = event.sets.nodes.filter((set) =>
    set.slots.some((slot) => slot.entrant?.id === entrant.id)
  );
  playerSets.sort(compareSetRecency);
  const latestSet = playerSets[0] ?? null;
  const latestSetLost = latestSet?.winnerId !== null && latestSet?.winnerId !== undefined && latestSet.winnerId !== entrant.id;
  const inLosersSignal = Boolean(
    (latestSet?.round !== null && latestSet?.round !== undefined && latestSet.round < 0)
    || (latestSet?.fullRoundText && /losers/i.test(latestSet.fullRoundText))
  );
  const pendingSetExists = playerSets.some((set) => set.completedAt === null);
  const standing = event.standings.nodes.find((node) => node.entrant?.id === entrant.id) ?? null;

  let status: StartggWatchStatus;
  if (latestSet && latestSetLost) {
    if (pendingSetExists || inLosersSignal) {
      status = 'in_losers';
    } else if (standing) {
      status = 'eliminated';
    } else {
      status = 'eliminated';
    }
  } else if (inLosersSignal) {
    status = 'in_losers';
  } else {
    status = 'in_winners';
  }

  if (standing?.placement === 1 && latestSet?.winnerId === entrant.id && !pendingSetExists) {
    status = 'completed';
  }

  const setId = latestSet?.id ?? null;
  const normalizedSlug = normalizeEventSlug(event.slug);
  const setPageUrl = setId ? `https://www.start.gg/${normalizedSlug}/set/${setId}` : null;

  return {
    status,
    placement: standing?.placement ?? null,
    lastSetId: setId,
    lastSetRound: latestSet?.round ?? null,
    lastSetRoundLabel: latestSet?.fullRoundText ?? null,
    lastSetScoreText: latestSet ? buildSetScoreText(latestSet.slots, latestSet.displayScore) : null,
    lastSetState: latestSet?.state ?? null,
    setPageUrl,
  };
}

function hasSnapshotChanged(
  current: PlayerStatusSnapshot,
  previous: ReturnType<typeof findStartggWatchSnapshot>
): boolean {
  if (!previous) return true;
  return current.status !== previous.status
    || current.placement !== previous.placement
    || current.lastSetId !== previous.last_set_id
    || current.lastSetScoreText !== previous.last_set_score_text;
}

export async function runStartggWatchOnce(bot?: Telegraf): Promise<StartggWatchSummary> {
  const players = listEnabledStartggWatchPlayers();
  const events = listActiveStartggWatchEvents();

  let changed = 0;
  for (const eventRow of events) {
    const normalizedSlug = normalizeEventSlug(eventRow.event_slug);
    const data = await queryStartgg<EventTrackingResponse>(EVENT_TRACKING_QUERY, {
      slug: normalizedSlug,
      setsPage: SETS_PAGE,
      setsPerPage: SETS_PER_PAGE,
      entrantsPage: ENTRANTS_PAGE,
      entrantsPerPage: ENTRANTS_PER_PAGE,
      standingsPage: STANDINGS_PAGE,
      standingsPerPage: STANDINGS_PER_PAGE,
    });
    if (!data.event) {
      throw new Error(`start.gg event not found: ${normalizedSlug}`);
    }
    if (!data.event.slug) {
      throw new Error(`start.gg event missing slug: ${normalizedSlug}`);
    }
    if (!data.event.tournament?.name) {
      throw new Error(`start.gg event missing tournament name: ${normalizedSlug}`);
    }

    updateStartggWatchEventResolved(eventRow.id, data.event.id, data.event.name);

    for (const player of players) {
      const snapshot = computePlayerSnapshot(normalizedSlug, data.event, player.player_id);
      const previous = findStartggWatchSnapshot(player.id, eventRow.id);
      const changedNow = hasSnapshotChanged(snapshot, previous);
      upsertStartggWatchSnapshot({
        watch_player_id: player.id,
        watch_event_id: eventRow.id,
        status: snapshot.status,
        placement: snapshot.placement,
        last_set_id: snapshot.lastSetId,
        last_set_round: snapshot.lastSetRound,
        last_set_round_label: snapshot.lastSetRoundLabel,
        last_set_score_text: snapshot.lastSetScoreText,
        last_set_state: snapshot.lastSetState,
        captured_at: new Date().toISOString(),
      });

      if (!changedNow) continue;

      changed += 1;
      const message = formatStartggStatusChangedMessage({
        tournamentName: data.event.tournament.name,
        eventName: data.event.name,
        eventSlug: data.event.slug,
        playerName: player.player_name,
        status: snapshot.status,
        placement: snapshot.placement,
        roundLabel: snapshot.lastSetRoundLabel,
        scoreText: snapshot.lastSetScoreText,
        setPageUrl: snapshot.setPageUrl,
      });
      await sendTelegramMessage(message, bot);
    }
  }

  return {
    checkedPlayers: players.length,
    checkedEvents: events.length,
    changed,
  };
}
