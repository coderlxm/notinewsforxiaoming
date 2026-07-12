import { GraphQLClient } from 'graphql-request';
import { config } from '../../config/index.js';
import {
  type EventTrackingHeaderResponse,
  type EventTrackingSetsPageResponse,
  type EventTrackingEntrantsPageResponse,
  type EventTrackingStandingsPageResponse,
  type EventSetsByEntrantsResponse,
  type EventEntrantsResponse,
  type UserPlayerResponse,
  type EventBasicResponse,
  type PlayerRecentSetsResponse,
  type PlayerRecentSetNode,
  type EventFinalPhaseMetaResponse,
  type PhaseSeedsResponse,
  type PhaseSetsResponse,
  type TrackedSetNode,
  type TrackedStandingNode,
  EVENT_TRACKING_HEADER_QUERY,
  EVENT_TRACKING_SETS_PAGE_QUERY,
  EVENT_TRACKING_ENTRANTS_PAGE_QUERY,
  EVENT_TRACKING_STANDINGS_PAGE_QUERY,
  EVENT_SETS_BY_ENTRANTS_QUERY,
  EVENT_ENTRANTS_QUERY,
  USER_PLAYER_QUERY,
  EVENT_BASIC_QUERY,
  PLAYER_RECENT_SETS_QUERY,
  EVENT_FINAL_PHASE_META_QUERY,
  PHASE_SEEDS_QUERY,
  PHASE_SETS_QUERY,
} from './queries.js';

const STARTGG_GRAPHQL_ENDPOINT = 'https://api.start.gg/gql/alpha';
const STARTGG_REQUEST_TIMEOUT_MS = 15000;
const TRACKING_SETS_PER_PAGE = 120;
const TRACKING_ENTRANTS_PER_PAGE = 200;
const TRACKING_STANDINGS_PER_PAGE = 250;
const ENTRANTS_PER_PAGE = 200;
const PLAYER_RECENT_SETS_PER_PAGE = 100;

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

function normalizeTotalPages(totalPages: number | null | undefined): number {
  if (!totalPages || totalPages < 1) return 1;
  return totalPages;
}

async function fetchAllPages<TNode>(
  query: string,
  variables: (page: number, perPage: number) => Record<string, unknown>,
  extractPageData: (data: unknown) => { totalPages: number | null | undefined; nodes: TNode[] } | null,
  perPage: number,
): Promise<TNode[]> {
  const nodes: TNode[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const data = await queryStartgg<unknown>(query, variables(page, perPage));
    const pageData = extractPageData(data);
    if (!pageData) {
      throw new Error(`start.gg: failed to extract page data for query`);
    }
    nodes.push(...pageData.nodes);
    totalPages = normalizeTotalPages(pageData.totalPages);
    page += 1;
  }
  return nodes;
}

export async function fetchEventHeader(slug: string): Promise<EventTrackingHeaderResponse['event']> {
  const data = await queryStartgg<EventTrackingHeaderResponse>(EVENT_TRACKING_HEADER_QUERY, { slug });
  return data.event;
}

export async function fetchEventFinalPhaseMeta(slug: string): Promise<EventFinalPhaseMetaResponse['event']> {
  const data = await queryStartgg<EventFinalPhaseMetaResponse>(EVENT_FINAL_PHASE_META_QUERY, { slug });
  return data.event;
}

export function fetchPhaseSeeds(phaseId: number): Promise<NonNullable<PhaseSeedsResponse['phase']>['seeds']['nodes']> {
  return fetchAllPages(
    PHASE_SEEDS_QUERY,
    (page, perPage) => ({ phaseId, page, perPage }),
    (data: PhaseSeedsResponse) => {
      if (!data.phase) return null;
      return { totalPages: data.phase.seeds.pageInfo?.totalPages, nodes: data.phase.seeds.nodes };
    },
    50,
  );
}

export async function fetchPhaseTracking(phaseId: number): Promise<{
  eventState: string;
  sets: TrackedSetNode[];
}> {
  const sets: TrackedSetNode[] = [];
  let page = 1;
  let totalPages = 1;
  let eventState = '';
  while (page <= totalPages) {
    const data = await queryStartgg<PhaseSetsResponse>(PHASE_SETS_QUERY, {
      phaseId,
      page,
      perPage: TRACKING_SETS_PER_PAGE,
    });
    if (!data.phase) {
      throw new Error(`start.gg phase not found: ${phaseId}`);
    }
    eventState = data.phase.event.state;
    sets.push(...data.phase.sets.nodes);
    totalPages = normalizeTotalPages(data.phase.sets.pageInfo?.totalPages);
    page += 1;
  }
  return { eventState, sets };
}

export function fetchEventSetsPages(slug: string): Promise<TrackedSetNode[]> {
  return fetchAllPages(
    EVENT_TRACKING_SETS_PAGE_QUERY,
    (page, perPage) => ({ slug, page, perPage }),
    (data: EventTrackingSetsPageResponse) => {
      if (!data.event) return null;
      return { totalPages: data.event.sets.pageInfo?.totalPages, nodes: data.event.sets.nodes };
    },
    TRACKING_SETS_PER_PAGE,
  );
}

export function fetchEventEntrantsPages(slug: string): Promise<EventTrackingEntrantsPageResponse['event']['entrants']['nodes']> {
  return fetchAllPages(
    EVENT_TRACKING_ENTRANTS_PAGE_QUERY,
    (page, perPage) => ({ slug, page, perPage }),
    (data: EventTrackingEntrantsPageResponse) => {
      if (!data.event) return null;
      return { totalPages: data.event.entrants.pageInfo?.totalPages, nodes: data.event.entrants.nodes };
    },
    TRACKING_ENTRANTS_PER_PAGE,
  );
}

export function fetchEventStandings(slug: string): Promise<TrackedStandingNode[]> {
  return fetchAllPages(
    EVENT_TRACKING_STANDINGS_PAGE_QUERY,
    (page, perPage) => ({ slug, page, perPage }),
    (data: EventTrackingStandingsPageResponse) => {
      if (!data.event) return null;
      return { totalPages: data.event.standings.pageInfo?.totalPages, nodes: data.event.standings.nodes };
    },
    TRACKING_STANDINGS_PER_PAGE,
  );
}

export async function fetchEntrantStandings(entrantIds: number[]): Promise<TrackedStandingNode[]> {
  const variables = Object.fromEntries(entrantIds.map((entrantId, index) => [`entrantId${index}`, entrantId]));
  const declarations = entrantIds.map((_, index) => `$entrantId${index}: ID!`).join(', ');
  const fields = entrantIds.map((_, index) => `
    entrant${index}: entrant(id: $entrantId${index}) {
      id
      standing {
        placement
        isFinal
      }
    }
  `).join('');
  const data = await queryStartgg<Record<string, {
    id: number;
    standing: { placement: number; isFinal: boolean | null } | null;
  } | null>>(`query EntrantStandings(${declarations}) {${fields}}`, variables);
  return Object.values(data).flatMap((entrant) => entrant?.standing
    ? [{ placement: entrant.standing.placement, isFinal: entrant.standing.isFinal, entrant: { id: entrant.id } }]
    : []);
}

export function fetchEventSetsByEntrants(slug: string, entrantIds: number[]): Promise<TrackedSetNode[]> {
  return fetchAllPages(
    EVENT_SETS_BY_ENTRANTS_QUERY,
    (page, perPage) => ({ slug, entrantIds, page, perPage }),
    (data: EventSetsByEntrantsResponse) => {
      if (!data.event) return null;
      return { totalPages: data.event.sets.pageInfo?.totalPages, nodes: data.event.sets.nodes };
    },
    TRACKING_SETS_PER_PAGE,
  );
}

export function fetchEventEntrantsDetailed(slug: string): Promise<EventEntrantsResponse['event']['entrants']['nodes']> {
  return fetchAllPages(
    EVENT_ENTRANTS_QUERY,
    (page, perPage) => ({ slug, page, perPage }),
    (data: EventEntrantsResponse) => {
      if (!data.event) return null;
      return { totalPages: data.event.entrants.pageInfo?.totalPages, nodes: data.event.entrants.nodes };
    },
    ENTRANTS_PER_PAGE,
  );
}

export async function fetchEventBasic(slug: string): Promise<EventBasicResponse['event']> {
  const data = await queryStartgg<EventBasicResponse>(EVENT_BASIC_QUERY, { slug });
  return data.event;
}

export async function fetchUserPlayer(slug: string): Promise<UserPlayerResponse['user']> {
  const data = await queryStartgg<UserPlayerResponse>(USER_PLAYER_QUERY, { slug });
  return data.user;
}

export async function fetchPlayerRecentSets(playerId: number, updatedAfter: number): Promise<PlayerRecentSetNode[]> {
  return fetchAllPages(
    PLAYER_RECENT_SETS_QUERY,
    (page, perPage) => ({ playerId, playerIds: [playerId], updatedAfter, page, perPage }),
    (data: PlayerRecentSetsResponse) => {
      if (!data.player) return null;
      return { totalPages: data.player.sets.pageInfo?.totalPages, nodes: data.player.sets.nodes };
    },
    PLAYER_RECENT_SETS_PER_PAGE,
  );
}
