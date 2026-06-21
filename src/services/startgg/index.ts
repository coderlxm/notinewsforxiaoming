export { queryStartgg } from './client.js';
export { fetchEventHeader, fetchEventSetsPages, fetchEventEntrantsPages, fetchEventStandings, fetchEventSetsByEntrants, fetchEventEntrantsDetailed, fetchEventBasic, fetchUserPlayer } from './client.js';
export {
  normalizeEventSlug,
  normalizeUserSlug,
  fetchEventMeta,
  listEventEntrantPlayers,
  resolveUserToPlayer,
  runStartggWatchOnce,
} from './tracker.js';
export type { StartggWatchSummary, RunStartggWatchOptions, StartggEventMeta, StartggEventEntrantPlayer, StartggUserResolvedPlayer } from './tracker.js';
export type { EventTrackingHeaderResponse, EventTrackingSetsPageResponse, EventTrackingEntrantsPageResponse, EventTrackingStandingsPageResponse, EventSetsByEntrantsResponse, EventBasicResponse, EventEntrantsResponse, UserPlayerResponse, TrackedSetNode, TrackedStandingNode } from './queries.js';