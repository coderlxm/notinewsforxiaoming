import { GraphQLClient } from 'graphql-request';
import type { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import { formatStartggStatusChangedMessage } from '../formatters/startggFormatter.js';
import { sendTelegramMessage } from '../publishers/telegram.js';
import {
  findStartggWatchSnapshot,
  listActiveStartggWatchEvents,
  listEnabledStartggWatchPlayers,
  type StartggWatchStatus,
  upsertStartggWatchSnapshot,
  updateStartggWatchEventResolved,
  upsertStartggWatchEventEntrant,
  findStartggWatchEventEntrant,
  type StartggWatchPlayer,
  hasStartggPushedSet,
  markStartggPushedSet,
} from './startggRepository.js';

const STARTGG_GRAPHQL_ENDPOINT = 'https://api.start.gg/gql/alpha';
const TRACKING_SETS_PER_PAGE = 120;
const TRACKING_ENTRANTS_PER_PAGE = 300;
const TRACKING_STANDINGS_PER_PAGE = 350;
const ENTRANTS_PER_PAGE = 300;
const STARTGG_REQUEST_TIMEOUT_MS = 15000;

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

const EVENT_SETS_BY_ENTRANTS_QUERY = `
query EventSetsByEntrants($slug: String!, $entrantIds: [ID!]!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    sets(page: $page, perPage: $perPage, sortType: STANDARD, filters: { entrantIds: $entrantIds }) {
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

const startggClient = new GraphQLClient(STARTGG_GRAPHQL_ENDPOINT, {
  requestMiddleware: (request) => {
    request.headers = { ...request.headers, Authorization: `Bearer ${config.startggApiToken}` };
    return request;
  },
});

export async function queryStartgg<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
  if (!config.startggApiToken) {
    throw new Error('STARTGG_API_TOKEN is not set.');
  }
  return startggClient.request<TData, Record<string, unknown>>({
    document: query,
    variables,
    signal: AbortSignal.timeout(STARTGG_REQUEST_TIMEOUT_MS),
  });
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

interface EventSetsByEntrantsResponse {
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

type TrackedSetNode = NonNullable<EventSetsByEntrantsResponse['event']>['sets']['nodes'][number];
type TrackedStandingNode = NonNullable<EventTrackingStandingsPageResponse['event']>['standings']['nodes'][number];

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
  pendingSetExists: boolean;
}

export interface StartggWatchSummary {
  checkedPlayers: number;
  checkedEvents: number;
  changed: number;
  pendingSetCount: number;
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
  entrantId: number;
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

function normalizeTotalPages(totalPages: number | null | undefined): number {
  if (!totalPages || totalPages < 1) return 1;
  return totalPages;
}

// Kept for admin/debug purposes; not used in the live monitoring path.
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
          entrantId: entrant.id,
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

async function ensureEventEntrantMappings(
  eventSlug: string,
  watchEventId: number,
  players: StartggWatchPlayer[]
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();
  const playersNeedingMapping: StartggWatchPlayer[] = [];

  for (const player of players) {
    const existing = findStartggWatchEventEntrant(player.id, watchEventId);
    if (existing) {
      result.set(player.id, existing.entrant_id);
    } else {
      playersNeedingMapping.push(player);
    }
  }

  if (playersNeedingMapping.length === 0) {
    return result;
  }

  const allEntrants = await listEventEntrantPlayers(eventSlug);
  const entrantByPlayerId = new Map(allEntrants.map((entrant) => [entrant.playerId, entrant]));

  for (const player of playersNeedingMapping) {
    const entrant = entrantByPlayerId.get(player.player_id) ?? null;

    upsertStartggWatchEventEntrant({
      watch_player_id: player.id,
      watch_event_id: watchEventId,
      entrant_id: entrant?.entrantId ?? null,
      entrant_name: entrant?.entrantName ?? null,
    });

    result.set(player.id, entrant?.entrantId ?? null);
  }

  return result;
}

async function fetchEventSetsByEntrants(
  eventSlug: string,
  entrantIds: number[]
): Promise<TrackedSetNode[]> {
  const sets: TrackedSetNode[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const pageData = await queryStartgg<EventSetsByEntrantsResponse>(
      EVENT_SETS_BY_ENTRANTS_QUERY,
      { slug: eventSlug, entrantIds, page, perPage: TRACKING_SETS_PER_PAGE }
    );
    if (!pageData.event) {
      throw new Error(`start.gg event not found while reading sets: ${eventSlug}`);
    }
    sets.push(...pageData.event.sets.nodes);
    totalPages = normalizeTotalPages(pageData.event.sets.pageInfo?.totalPages);
    page += 1;
  }
  return sets;
}

async function fetchEventStandings(slug: string): Promise<TrackedStandingNode[]> {
  const standings: TrackedStandingNode[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const pageData = await queryStartgg<EventTrackingStandingsPageResponse>(
      EVENT_TRACKING_STANDINGS_PAGE_QUERY,
      { slug, page, perPage: TRACKING_STANDINGS_PER_PAGE }
    );
    if (!pageData.event) {
      throw new Error(`start.gg event not found while reading standings: ${slug}`);
    }
    standings.push(...pageData.event.standings.nodes);
    totalPages = normalizeTotalPages(pageData.event.standings.pageInfo?.totalPages);
    page += 1;
  }
  return standings;
}

function computePlayerSnapshot(
  eventSlug: string,
  playerSets: TrackedSetNode[],
  entrantId: number | null,
  standings: TrackedStandingNode[],
): PlayerStatusSnapshot {
  if (!eventSlug) {
    throw new Error(`Event slug is empty: ${eventSlug}`);
  }

  if (!entrantId) {
    return {
      status: 'not_entered',
      placement: null,
      lastSetId: null,
      lastSetRound: null,
      lastSetRoundLabel: null,
      lastSetScoreText: null,
      lastSetState: null,
      setPageUrl: null,
      pendingSetExists: false,
    };
  }

  playerSets.sort(compareSetRecency);
  const latestSet = playerSets[0] ?? null;
  const latestSetLost = latestSet?.winnerId !== null && latestSet?.winnerId !== undefined && latestSet.winnerId !== entrantId;
  const inLosersSignal = Boolean(
    (latestSet?.round !== null && latestSet?.round !== undefined && latestSet.round < 0)
    || (latestSet?.fullRoundText && /losers/i.test(latestSet.fullRoundText))
  );
  const pendingSetExists = playerSets.some((set) => set.completedAt === null);
  const standing = standings.find((node) => node.entrant?.id === entrantId) ?? null;

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

  if (standing?.placement === 1 && latestSet?.winnerId === entrantId && !pendingSetExists) {
    status = 'completed';
  }

  const setId = latestSet?.id ?? null;
  const normalizedSlug = normalizeEventSlug(eventSlug);
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
    pendingSetExists,
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

function compareSetChronology(a: { completedAt: number | null; id: number }, b: { completedAt: number | null; id: number }): number {
  const aTime = a.completedAt ?? 0;
  const bTime = b.completedAt ?? 0;
  if (aTime !== bTime) {
    return aTime - bTime;
  }
  return a.id - b.id;
}

function selectSetsToPush(
  playerSets: TrackedSetNode[],
  previous: ReturnType<typeof findStartggWatchSnapshot>,
  watchPlayerId: number,
  watchEventId: number
): TrackedSetNode[] {
  if (!previous) {
    for (const set of playerSets) {
      markStartggPushedSet(watchPlayerId, watchEventId, set.id);
    }
    return [];
  }

  const sortedSets = [...playerSets].sort(compareSetChronology);
  if (previous.last_set_id !== null) {
    const previousSetIndex = sortedSets.findIndex((set) => set.id === previous.last_set_id);
    if (previousSetIndex < 0) {
      throw new Error(`start.gg previous set missing from fetched sets: ${previous.last_set_id}`);
    }
    for (const set of sortedSets.slice(0, previousSetIndex + 1)) {
      markStartggPushedSet(watchPlayerId, watchEventId, set.id);
    }
    return sortedSets
      .slice(previousSetIndex + 1)
      .filter((set) => !hasStartggPushedSet(watchPlayerId, watchEventId, set.id));
  }

  return sortedSets
    .filter((set) => !hasStartggPushedSet(watchPlayerId, watchEventId, set.id));
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
  let pendingSetCount = 0;
  for (const eventRow of targetEvents) {
    const normalizedSlug = normalizeEventSlug(eventRow.event_slug);
    const header = await queryStartgg<EventTrackingHeaderResponse>(EVENT_TRACKING_HEADER_QUERY, { slug: normalizedSlug });
    if (!header.event) {
      throw new Error(`start.gg event not found: ${normalizedSlug}`);
    }
    if (!header.event.slug) {
      throw new Error(`start.gg event missing slug: ${normalizedSlug}`);
    }
    if (!header.event.tournament?.name) {
      throw new Error(`start.gg event missing tournament name: ${normalizedSlug}`);
    }

    const resolvedEventName = `${header.event.tournament.name} / ${header.event.name}`;
    updateStartggWatchEventResolved(eventRow.id, header.event.id, resolvedEventName);

    const entrantMappings = await ensureEventEntrantMappings(normalizedSlug, eventRow.id, players);

    const mappedEntrantIds = Array.from(entrantMappings.values()).filter((id): id is number => id !== null);
    const entrantSets = mappedEntrantIds.length > 0
      ? await fetchEventSetsByEntrants(normalizedSlug, mappedEntrantIds)
      : [];

    const eventStandings = mappedEntrantIds.length > 0
      ? await fetchEventStandings(normalizedSlug)
      : [];

    for (const player of players) {
      const entrantId = entrantMappings.get(player.id) ?? null;
      const playerSets = entrantSets.filter((set) =>
        set.slots.some((slot) => slot.entrant?.id === entrantId)
      );

      const snapshot = computePlayerSnapshot(normalizedSlug, playerSets, entrantId, eventStandings);
      if (snapshot.pendingSetExists) {
        pendingSetCount += 1;
      }
      const previous = findStartggWatchSnapshot(player.id, eventRow.id);
      const changedNow = hasSnapshotChanged(snapshot, previous);
      const setsToPush = selectSetsToPush(playerSets, previous, player.id, eventRow.id);
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

      if (setsToPush.length === 0 && !changedNow) continue;

      if (setsToPush.length === 0) {
        changed += 1;
        const message = formatStartggStatusChangedMessage({
          tournamentName: header.event.tournament.name,
          eventName: header.event.name,
          eventSlug: header.event.slug,
          playerName: player.player_name,
          status: snapshot.status,
          placement: snapshot.placement,
          roundLabel: snapshot.lastSetRoundLabel,
          scoreText: snapshot.lastSetScoreText,
          setPageUrl: snapshot.setPageUrl,
        });
        await sendTelegramMessage(message, bot);
        continue;
      }

      for (const set of setsToPush) {
        changed += 1;
        const setPageUrl = `https://www.start.gg/${normalizedSlug}/set/${set.id}`;
        const message = formatStartggStatusChangedMessage({
          tournamentName: header.event.tournament.name,
          eventName: header.event.name,
          eventSlug: header.event.slug,
          playerName: player.player_name,
          status: snapshot.status,
          placement: snapshot.placement,
          roundLabel: set.fullRoundText,
          scoreText: buildSetScoreText(set.displayScore),
          setPageUrl,
        });
        await sendTelegramMessage(message, bot);
        markStartggPushedSet(player.id, eventRow.id, set.id);
      }
    }
  }

  return {
    checkedPlayers: players.length,
    checkedEvents: targetEvents.length,
    changed,
    pendingSetCount,
  };
}
