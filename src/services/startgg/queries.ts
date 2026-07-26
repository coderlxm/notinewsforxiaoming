export const EVENT_TRACKING_HEADER_QUERY = `
query EventTrackingHeader($slug: String!) {
  event(slug: $slug) {
    id
    name
    slug
    tournament {
      id
      name
      endAt
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
        startedAt
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
        isFinal
        entrant {
          id
          name
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
    videogame {
      id
      name
    }
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
          id
          gamerTag
          user {
            id
          }
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
    id
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
        completedAt
        event {
          id
          name
          slug
          startAt
          videogame {
            id
            name
          }
          tournament {
            id
            name
            slug
            startAt
            endAt
          }
        }
      }
    }
  }
}
`;

export const TOURNAMENT_CANDIDATES_QUERY = `
query TournamentCandidates($videogameId: ID!, $computedUpdatedAt: Timestamp!, $page: Int!, $perPage: Int!) {
  tournaments(query: {
    page: $page
    perPage: $perPage
    filter: {
      videogameIds: [$videogameId]
      computedUpdatedAt: $computedUpdatedAt
      published: true
      publiclySearchable: true
    }
  }) {
    pageInfo {
      totalPages
    }
    nodes {
      id
      name
      slug
      startAt
      endAt
    }
  }
}
`;

export const TOURNAMENT_IDENTITY_EVENT_FIELDS = `
id
name
slug
`;

export const TOURNAMENT_IDENTITY_PARTICIPANT_FIELDS = `
pageInfo {
  totalPages
}
nodes {
  id
  gamerTag
  user {
    id
  }
  player {
    id
  }
  entrants {
    id
    name
    event {
      id
      name
      slug
      videogame {
        id
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
        startedAt
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
        }
      }
    }
  }
}
`;

export const EVENT_FINAL_PHASE_META_QUERY = `
query EventFinalPhaseMeta($slug: String!) {
  event(slug: $slug) {
    state
    phases {
      id
      name
      phaseOrder
      numSeeds
      state
    }
  }
}
`;

export const PHASE_SEEDS_QUERY = `
query PhaseSeeds($phaseId: ID!, $page: Int!, $perPage: Int!) {
  phase(id: $phaseId) {
    seeds(query: { page: $page, perPage: $perPage }) {
      pageInfo { totalPages }
      nodes {
        seedNum
        entrant { id name }
      }
    }
  }
}
`;

export const PHASE_SETS_QUERY = `
query PhaseSets($phaseId: ID!, $page: Int!, $perPage: Int!) {
  phase(id: $phaseId) {
    event { state }
    sets(page: $page, perPage: $perPage, sortType: STANDARD) {
      pageInfo { totalPages }
      nodes {
        id
        state
        startedAt
        round
        fullRoundText
        displayScore
        winnerId
        completedAt
        slots { entrant { id name } }
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
  startedAt: number | null;
  round: number | null;
  fullRoundText: string | null;
  displayScore: string | null;
  winnerId: number | null;
  completedAt: number | null;
  slots: Array<{
    entrant: { id: number; name?: string } | null;
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
    id: number;
    gamerTag: string | null;
    user: {
      id: number;
    } | null;
    player: {
      id: number;
      gamerTag: string | null;
      prefix: string | null;
    } | null;
  }>;
}

interface StandingNodeFields {
  placement: number;
  isFinal: boolean | null;
  entrant: { id: number; name?: string } | null;
}

export interface EventTrackingHeaderResponse {
  event: {
    id: number;
    name: string;
    slug: string | null;
    tournament: {
      id: number;
      name: string;
      endAt: number | null;
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

export interface EventFinalPhaseMetaResponse {
  event: {
    state: string;
    phases: Array<{
      id: number;
      name: string;
      phaseOrder: number;
      numSeeds: number | null;
      state: string;
    }>;
  } | null;
}

export interface PhaseSeedsResponse {
  phase: {
    seeds: {
      pageInfo: PageInfo | null;
      nodes: Array<{
        seedNum: number;
        entrant: { id: number; name: string } | null;
      }>;
    };
  } | null;
}

export interface PhaseSetsResponse {
  phase: {
    event: { state: string };
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
    videogame: {
      id: number;
      name: string;
    } | null;
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
    id: number;
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
        completedAt: number | null;
        event: {
          id: number;
          name: string;
          slug: string | null;
          startAt: number | null;
          videogame: {
            id: number;
            name: string;
          } | null;
          tournament: {
            id: number;
            name: string;
            slug: string | null;
            startAt: number | null;
            endAt: number | null;
          } | null;
        } | null;
      }>;
    };
  } | null;
}

export interface TournamentCandidateNode {
  id: number;
  name: string;
  slug: string | null;
  startAt: number | null;
  endAt: number | null;
}

export interface TournamentCandidatesResponse {
  tournaments: {
    pageInfo: PageInfo | null;
    nodes: TournamentCandidateNode[];
  };
}

export interface TournamentIdentityEntrantNode {
  id: number;
  name: string;
}

export interface TournamentIdentityEventNode {
  id: number;
  name: string;
  slug: string | null;
}

export interface TournamentIdentityParticipantNode {
  id: number;
  gamerTag: string | null;
  user: {
    id: number;
  } | null;
  player: {
    id: number;
  } | null;
  entrants: Array<{
    id: number;
    name: string;
    event: {
      id: number;
      name: string;
      slug: string | null;
      videogame: {
        id: number;
      } | null;
    } | null;
  }>;
}

export type TrackedSetNode = SetNodeFields;
export type TrackedStandingNode = StandingNodeFields;
export type PlayerRecentSetNode = NonNullable<PlayerRecentSetsResponse['player']>['sets']['nodes'][number];
