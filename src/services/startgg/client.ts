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
} from './queries.js';

const STARTGG_GRAPHQL_ENDPOINT = 'https://api.start.gg/gql/alpha';
const STARTGG_REQUEST_TIMEOUT_MS = 15000;
const TRACKING_SETS_PER_PAGE = 120;
const TRACKING_ENTRANTS_PER_PAGE = 300;
const TRACKING_STANDINGS_PER_PAGE = 350;
const ENTRANTS_PER_PAGE = 300;

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