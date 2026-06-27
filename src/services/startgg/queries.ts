export const EVENT_TRACKING_HEADER_QUERY = `
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

export const EVENT_TRACKING_SETS_PAGE_QUERY = `
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

export const EVENT_TRACKING_ENTRANTS_PAGE_QUERY = `
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

export const EVENT_TRACKING_STANDINGS_PAGE_QUERY = `
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

export const EVENT_BASIC_QUERY = `
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

export const EVENT_ENTRANTS_QUERY = `
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

export const USER_PLAYER_QUERY = `
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

export const PLAYER_RECENT_SETS_QUERY = `
query PlayerRecentSets($playerId: ID!, $playerIds: [ID!]!, $updatedAfter: Timestamp, $page: Int!, $perPage: Int!) {
  player(id: $playerId) {
    id
    sets(page: $page, perPage: $perPage, filters: { playerIds: $playerIds, updatedAfter: $updatedAfter }) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        state
        completedAt
        event {
          id
          name
          slug
          startAt
          tournament {
            id
            name
            slug
            startAt
            endAt
            timezone
          }
        }
      }
    }
  }
}
`;

export const EVENT_SETS_BY_ENTRANTS_QUERY = `
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

interface PageInfo {
  totalPages: number | null;
}

interface SetNodeFields {
  id: number;
  state: number | null;
  round: number | null;
  fullRoundText: string | null;
  displayScore: string | null;
  winnerId: number | null;
  completedAt: number | null;
  slots: Array<{
    entrant: { id: number } | null;
  }>;
}

interface EntrantNodeFields {
  id: number;
  name: string;
  participants: Array<{
    player: {
      id: number;
    } | null;
  }>;
}

interface EntrantNodeWithPlayerFields {
  id: number;
  name: string;
  participants: Array<{
    player: {
      id: number;
      gamerTag: string | null;
      prefix: string | null;
    } | null;
  }>;
}

interface StandingNodeFields {
  placement: number;
  entrant: { id: number } | null;
}

export interface EventTrackingHeaderResponse {
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

export interface EventTrackingSetsPageResponse {
  event: {
    sets: {
      pageInfo: PageInfo | null;
      nodes: SetNodeFields[];
    };
  } | null;
}

export interface EventTrackingEntrantsPageResponse {
  event: {
    entrants: {
      pageInfo: PageInfo | null;
      nodes: EntrantNodeFields[];
    };
  } | null;
}

export interface EventTrackingStandingsPageResponse {
  event: {
    standings: {
      pageInfo: PageInfo | null;
      nodes: StandingNodeFields[];
    };
  } | null;
}

export interface EventSetsByEntrantsResponse {
  event: {
    sets: {
      pageInfo: PageInfo | null;
      nodes: SetNodeFields[];
    };
  } | null;
}

export interface EventBasicResponse {
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

export interface EventEntrantsResponse {
  event: {
    id: number;
    name: string;
    slug: string | null;
    entrants: {
      pageInfo: PageInfo | null;
      nodes: EntrantNodeWithPlayerFields[];
    };
  } | null;
}

export interface UserPlayerResponse {
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

export interface PlayerRecentSetsResponse {
  player: {
    id: number;
    sets: {
      pageInfo: PageInfo | null;
      nodes: Array<{
        id: number;
        state: number | null;
        completedAt: number | null;
        event: {
          id: number;
          name: string;
          slug: string | null;
          startAt: number | null;
          tournament: {
            id: number;
            name: string;
            slug: string | null;
            startAt: number | null;
            endAt: number | null;
            timezone: string | null;
          } | null;
        } | null;
      }>;
    };
  } | null;
}

export type TrackedSetNode = SetNodeFields;
export type TrackedStandingNode = StandingNodeFields;
export type PlayerRecentSetNode = NonNullable<PlayerRecentSetsResponse['player']>['sets']['nodes'][number];
