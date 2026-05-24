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
const TRACKING_SETS_PER_PAGE = 120;
const TRACKING_ENTRANTS_PER_PAGE = 300;
const TRACKING_STANDINGS_PER_PAGE = 350;
const ENTRANTS_PER_PAGE = 300;

const EVENT_TRACKING_HEADER_QUERY = `
query EventTrackingHeader($slug: String!) {
  event(slug: $slug) {
    id
    name
    slug
    tournament {
      id
      name
    }
  }
}
`;

const EVENT_TRACKING_SETS_PAGE_QUERY = `
query EventTrackingSetsPage($slug: String!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    sets(page: $page, perPage: $perPage, sortType: STANDARD) {
      pageInfo {
        totalPages
      }
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
          }
        }
      }
    }
  }
}
`;

const EVENT_TRACKING_ENTRANTS_PAGE_QUERY = `
query EventTrackingEntrantsPage($slug: String!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    entrants(query: { page: $page, perPage: $perPage }) {
      pageInfo {
        totalPages
      }
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
  }
}
`;

const EVENT_TRACKING_STANDINGS_PAGE_QUERY = `
query EventTrackingStandingsPage($slug: String!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    standings(query: { page: $page, perPage: $perPage }) {
      pageInfo {
        totalPages
      }
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

const EVENT_BASIC_QUERY = `
query EventBasic($slug: String!) {
  event(slug: $slug) {
    id
    name
    slug
    startAt
    tournament {
      id
      name
      startAt
      endAt
    }
  }
}
`;

const EVENT_ENTRANTS_QUERY = `
query EventEntrants($slug: String!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    id
    name
    slug
    entrants(query: { page: $page, perPage: $perPage }) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        name
        participants {
          player {
            id
            gamerTag
            prefix
          }
        }
      }
    }
  }
}
`;

const USER_PLAYER_QUERY = `
query UserPlayer($slug: String!) {
  user(slug: $slug) {
    slug
    discriminator
    player {
      id
      gamerTag
      prefix
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

type EventTrackingEvent = NonNullable<EventTrackingResponse['event']>;

interface EventTrackingHeaderResponse {
  event: {
    id: number;
    name: string;
    slug: string | null;
    tournament: {
      id: number;
      name: string;
    } | null;
  } | null;
}

interface EventTrackingSetsPageResponse {
  event: {
    sets: {
      pageInfo: {
        totalPages: number | null;
      } | null;
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
          } | null;
        }>;
      }>;
    };
  } | null;
}

interface EventTrackingEntrantsPageResponse {
  event: {
    entrants: {
      pageInfo: {
        totalPages: number | null;
      } | null;
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
  } | null;
}

interface EventTrackingStandingsPageResponse {
  event: {
    standings: {
      pageInfo: {
        totalPages: number | null;
      } | null;
      nodes: Array<{
        placement: number;
        entrant: {
          id: number;
        } | null;
      }>;
    };
  } | null;
}

interface EventBasicResponse {
  event: {
    id: number;
    name: string;
    slug: string | null;
    startAt: number | null;
    tournament: {
      id: number;
      name: string;
      startAt: number | null;
      endAt: number | null;
    } | null;
  } | null;
}

interface EventEntrantsResponse {
  event: {
    id: number;
    name: string;
    slug: string | null;
    entrants: {
      pageInfo: {
        totalPages: number | null;
      } | null;
      nodes: Array<{
        id: number;
        name: string;
        participants: Array<{
          player: {
            id: number;
            gamerTag: string | null;
            prefix: string | null;
          } | null;
        }>;
      }>;
    };
  } | null;
}

interface UserPlayerResponse {
  user: {
    slug: string | null;
    discriminator: string | null;
    player: {
      id: number;
      gamerTag: string | null;
      prefix: string | null;
    } | null;
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

export interface RunStartggWatchOptions {
  eventSlugs?: string[];
}

export interface StartggEventMeta {
  id: number;
  name: string;
  slug: string;
  tournamentName: string | null;
  eventStartAt: number | null;
  tournamentStartAt: number | null;
  tournamentEndAt: number | null;
}

export interface StartggEventEntrantPlayer {
  playerId: number;
  playerName: string;
  entrantName: string;
}

export interface StartggUserResolvedPlayer {
  playerId: number;
  playerName: string;
  userSlug: string;
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

export function normalizeUserSlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('start.gg user slug cannot be empty.');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const userIndex = parts.indexOf('user');
    if (userIndex < 0 || !parts[userIndex + 1]) {
      throw new Error(`Invalid start.gg user URL: ${raw}`);
    }
    return parts[userIndex + 1]!;
  }
  return trimmed.replace(/^\/+/, '').replace(/^user\//, '').split('/')[0] ?? trimmed;
}

function buildPlayerDisplayName(gamerTag: string | null, prefix: string | null): string {
  const gamer = gamerTag?.trim() ?? '';
  const org = prefix?.trim() ?? '';
  if (org && gamer) {
    return `${org} | ${gamer}`;
  }
  return gamer || org;
}

export async function queryStartgg<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
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

function normalizeTotalPages(totalPages: number | null | undefined): number {
  if (!totalPages || totalPages < 1) return 1;
  return totalPages;
}

async function fetchEventTrackingSnapshot(slug: string): Promise<EventTrackingEvent> {
  const header = await queryStartgg<EventTrackingHeaderResponse>(EVENT_TRACKING_HEADER_QUERY, { slug });
  if (!header.event) {
    throw new Error(`start.gg event not found: ${slug}`);
  }
  if (!header.event.slug) {
    throw new Error(`start.gg event missing slug: ${slug}`);
  }

  const sets: EventTrackingEvent['sets']['nodes'] = [];
  const entrants: EventTrackingEvent['entrants']['nodes'] = [];
  const standings: EventTrackingEvent['standings']['nodes'] = [];

  let setsPage = 1;
  let setsTotalPages = 1;
  while (setsPage <= setsTotalPages) {
    const pageData = await queryStartgg<EventTrackingSetsPageResponse>(EVENT_TRACKING_SETS_PAGE_QUERY, {
      slug,
      page: setsPage,
      perPage: TRACKING_SETS_PER_PAGE,
    });
    if (!pageData.event) {
      throw new Error(`start.gg event not found while reading sets: ${slug}`);
    }
    sets.push(...pageData.event.sets.nodes);
    setsTotalPages = normalizeTotalPages(pageData.event.sets.pageInfo?.totalPages);
    setsPage += 1;
  }

  let entrantsPage = 1;
  let entrantsTotalPages = 1;
  while (entrantsPage <= entrantsTotalPages) {
    const pageData = await queryStartgg<EventTrackingEntrantsPageResponse>(EVENT_TRACKING_ENTRANTS_PAGE_QUERY, {
      slug,
      page: entrantsPage,
      perPage: TRACKING_ENTRANTS_PER_PAGE,
    });
    if (!pageData.event) {
      throw new Error(`start.gg event not found while reading entrants: ${slug}`);
    }
    entrants.push(...pageData.event.entrants.nodes);
    entrantsTotalPages = normalizeTotalPages(pageData.event.entrants.pageInfo?.totalPages);
    entrantsPage += 1;
  }

  let standingsPage = 1;
  let standingsTotalPages = 1;
  while (standingsPage <= standingsTotalPages) {
    const pageData = await queryStartgg<EventTrackingStandingsPageResponse>(EVENT_TRACKING_STANDINGS_PAGE_QUERY, {
      slug,
      page: standingsPage,
      perPage: TRACKING_STANDINGS_PER_PAGE,
    });
    if (!pageData.event) {
      throw new Error(`start.gg event not found while reading standings: ${slug}`);
    }
    standings.push(...pageData.event.standings.nodes);
    standingsTotalPages = normalizeTotalPages(pageData.event.standings.pageInfo?.totalPages);
    standingsPage += 1;
  }

  return {
    id: header.event.id,
    name: header.event.name,
    slug: header.event.slug,
    tournament: header.event.tournament,
    sets: { nodes: sets },
    entrants: { nodes: entrants },
    standings: { nodes: standings },
  };
}

export async function fetchEventMeta(rawEventSlugOrUrl: string): Promise<StartggEventMeta> {
  const slug = normalizeEventSlug(rawEventSlugOrUrl);
  const data = await queryStartgg<EventBasicResponse>(EVENT_BASIC_QUERY, { slug });
  if (!data.event?.slug) {
    throw new Error(`start.gg 项目不存在：${slug}`);
  }
  return {
    id: data.event.id,
    name: data.event.name,
    slug: normalizeEventSlug(data.event.slug),
    tournamentName: data.event.tournament?.name ?? null,
    eventStartAt: data.event.startAt ?? null,
    tournamentStartAt: data.event.tournament?.startAt ?? null,
    tournamentEndAt: data.event.tournament?.endAt ?? null,
  };
}

export async function listEventEntrantPlayers(rawEventSlugOrUrl: string): Promise<StartggEventEntrantPlayer[]> {
  const slug = normalizeEventSlug(rawEventSlugOrUrl);
  const unique = new Map<number, StartggEventEntrantPlayer>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const data = await queryStartgg<EventEntrantsResponse>(EVENT_ENTRANTS_QUERY, {
      slug,
      page,
      perPage: ENTRANTS_PER_PAGE,
    });
    if (!data.event) {
      throw new Error(`start.gg 项目不存在：${slug}`);
    }
    for (const entrant of data.event.entrants.nodes) {
      for (const participant of entrant.participants) {
        const player = participant.player;
        if (!player) continue;
        if (unique.has(player.id)) continue;
        const playerName = buildPlayerDisplayName(player.gamerTag, player.prefix);
        if (!playerName) continue;
        unique.set(player.id, {
          playerId: player.id,
          playerName,
          entrantName: entrant.name,
        });
      }
    }
    totalPages = normalizeTotalPages(data.event.entrants.pageInfo?.totalPages);
    page += 1;
  }

  return Array.from(unique.values());
}

export async function resolveUserToPlayer(rawUserSlugOrUrl: string): Promise<StartggUserResolvedPlayer> {
  const slug = normalizeUserSlug(rawUserSlugOrUrl);
  const data = await queryStartgg<UserPlayerResponse>(USER_PLAYER_QUERY, { slug });
  if (!data.user) {
    throw new Error(`start.gg 用户不存在：${slug}`);
  }
  if (!data.user.player) {
    throw new Error('该 start.gg 用户没有关联 player，无法用于赛事状态追踪。');
  }

  const playerName = buildPlayerDisplayName(data.user.player.gamerTag, data.user.player.prefix);
  if (!playerName) {
    throw new Error(`start.gg 用户 player 名称为空：${slug}`);
  }

  return {
    playerId: data.user.player.id,
    playerName,
    userSlug: data.user.slug ?? slug,
  };
}

function buildSetScoreText(displayScore: string | null): string | null {
  if (displayScore && displayScore.trim()) {
    return displayScore.trim();
  }
  return null;
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
  event: EventTrackingEvent,
  watchPlayerId: number
): PlayerStatusSnapshot {
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
    lastSetScoreText: latestSet ? buildSetScoreText(latestSet.displayScore) : null,
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

export async function runStartggWatchOnce(bot?: Telegraf, options?: RunStartggWatchOptions): Promise<StartggWatchSummary> {
  const players = listEnabledStartggWatchPlayers();
  const events = listActiveStartggWatchEvents();
  const normalizedEventFilter = options?.eventSlugs
    ? new Set(options.eventSlugs.map((slug) => normalizeEventSlug(slug)))
    : null;
  const targetEvents = normalizedEventFilter
    ? events.filter((row) => normalizedEventFilter.has(normalizeEventSlug(row.event_slug)))
    : events;

  let changed = 0;
  for (const eventRow of targetEvents) {
    const normalizedSlug = normalizeEventSlug(eventRow.event_slug);
    const event = await fetchEventTrackingSnapshot(normalizedSlug);
    if (!event.slug) {
      throw new Error(`start.gg event missing slug: ${normalizedSlug}`);
    }
    if (!event.tournament?.name) {
      throw new Error(`start.gg event missing tournament name: ${normalizedSlug}`);
    }

    const resolvedEventName = event.tournament.name ? `${event.tournament.name} / ${event.name}` : event.name;
    updateStartggWatchEventResolved(eventRow.id, event.id, resolvedEventName);

    for (const player of players) {
      const snapshot = computePlayerSnapshot(normalizedSlug, event, player.player_id);
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
        tournamentName: event.tournament.name,
        eventName: event.name,
        eventSlug: event.slug,
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
    checkedEvents: targetEvents.length,
    changed,
  };
}
