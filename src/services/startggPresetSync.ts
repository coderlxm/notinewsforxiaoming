import {
  createStartggWatchPlayer,
  findStartggWatchPlayerByPlayerId,
  listEnabledStartggWatchPlayers,
  listActiveStartggWatchEvents,
  replaceActiveStartggWatchEvents,
  syncAutoDiscoveredStartggWatchEvents,
  type StartggWatchEventInput,
  updateStartggWatchPlayerIdentity,
  updateStartggWatchPlayerName,
  getFeaturedSeedCount,
  listEventFeaturedEntrants,
  replaceEventFeaturedEntrants,
  markStartggEventPushedSet,
  type StartggFeaturedSeedCount,
  type StartggWatchEvent,
  type StartggWatchPlayer,
} from './startggRepository.js';
import {
  loadStartggPresetPlayersConfig,
  writeStartggPresetPlayersConfig,
} from './startggPresetConfig.js';
import {
  discoverStartggActiveEventsForPlayers,
  type StartggDiscoveredEvent,
} from './startggDiscovery.js';
import {
  resolveUserToPlayer,
  runStartggWatchOnce,
  normalizeEventSlug,
  fetchFeaturedSeedPhaseMeta,
  fetchPhaseSeeds,
  fetchEventSetsByEntrants,
} from './startgg/index.js';
import type { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import {
  buildStartggInterestPromptButtons,
  formatStartggInterestPrompt,
} from '../formatters/startggFormatter.js';
import {
  deactivateStartggWatchEventBySlug,
  deleteExpiredStartggInterestState,
  findStartggVideogamePreference,
  hasStartggEventInterestOverride,
  listStartggPendingEventsNeedingPrompt,
  markStartggPendingEventPrompted,
  setStartggVideogamePreference,
  updateStartggWatchEventVideogame,
  upsertStartggPendingEvent,
} from './startggInterestRepository.js';

export interface StartggGoTournamentCandidate {
  tournamentId: number;
  tournamentName: string;
  tournamentSlug: string;
  events: StartggDiscoveredEvent[];
}

export type StartggGoResult =
  | {
      status: 'candidates';
      reason: 'no_match' | 'multiple_matches';
      keyword: string;
      syncedPlayers: number;
      candidates: StartggGoTournamentCandidate[];
    }
  | {
      status: 'interest_pending';
      syncedPlayers: number;
      pendingEvents: number;
    }
  | {
      status: 'started';
      keyword: string;
      syncedPlayers: number;
      tournamentName: string;
      tournamentSlug: string;
      discoveredEvents: number;
      checkedPlayers: number;
      checkedEvents: number;
      changed: number;
      activeSetCount: number;
      activeEventSlugs: string[];
    };

async function loadFeaturedEntrants(
  event: StartggWatchEvent,
  seedCount: Exclude<StartggFeaturedSeedCount, 0>,
): Promise<{
  phaseId: number;
  entrants: Array<{ entrantId: number; entrantName: string; seedNum: number }>;
  completedSetIds: number[];
}> {
  const slug = normalizeEventSlug(event.event_slug);
  const seedPhase = await fetchFeaturedSeedPhaseMeta(slug);
  if (!seedPhase) {
    throw new Error(`start.gg event has no featured seed phase: ${slug}`);
  }

  const seeds = await fetchPhaseSeeds(seedPhase.phaseId);
  const entrants = seeds
    .filter((seed): seed is { seedNum: number; entrant: { id: number; name: string } } =>
      seed.entrant !== null && seed.seedNum <= seedCount)
    .sort((a, b) => a.seedNum - b.seedNum)
    .map((seed) => ({
      entrantId: seed.entrant.id,
      entrantName: seed.entrant.name,
      seedNum: seed.seedNum,
    }));
  if (entrants.length === 0) {
    throw new Error(`start.gg featured seed phase has no entrants: ${slug}`);
  }

  const sets = await fetchEventSetsByEntrants(slug, entrants.map((entrant) => entrant.entrantId));
  return {
    phaseId: seedPhase.phaseId,
    entrants,
    completedSetIds: sets
      .filter((set) => set.completedAt !== null && Number.isInteger(set.id))
      .map((set) => set.id),
  };
}

function saveFeaturedEntrants(
  eventRowId: number,
  sync: Awaited<ReturnType<typeof loadFeaturedEntrants>>,
): void {
  replaceEventFeaturedEntrants(eventRowId, sync.phaseId, sync.entrants);
  for (const setId of sync.completedSetIds) {
    markStartggEventPushedSet(eventRowId, setId);
  }
}

export async function syncFeaturedEntrantsForActiveEvents(): Promise<void> {
  const seedCount = getFeaturedSeedCount();
  if (seedCount === 0) return;

  const activeEvents = listActiveStartggWatchEvents();
  const newEvents = activeEvents.filter((event) => listEventFeaturedEntrants(event.id).length === 0);
  const eventSyncs = await Promise.all(newEvents.map(async (event) => ({
    event,
    sync: await loadFeaturedEntrants(event, seedCount),
  })));
  for (const { event, sync } of eventSyncs) {
    saveFeaturedEntrants(event.id, sync);
  }
}

export async function resyncFeaturedEntrantsForActiveEvents(seedCount: StartggFeaturedSeedCount): Promise<void> {
  const activeEvents = listActiveStartggWatchEvents();
  if (seedCount === 0) {
    for (const event of activeEvents) {
      replaceEventFeaturedEntrants(event.id, 0, []);
    }
    return;
  }

  const eventSyncs = await Promise.all(activeEvents.map(async (event) => ({
    event,
    sync: await loadFeaturedEntrants(event, seedCount),
  })));
  for (const { event, sync } of eventSyncs) {
    saveFeaturedEntrants(event.id, sync);
  }
}

function toWatchEventInput(event: StartggDiscoveredEvent): StartggWatchEventInput {
  return {
    event_slug: event.eventSlug,
    event_name: event.eventName,
    event_id: event.eventId,
    tournament_end_at: new Date(event.tournamentEndAt * 1000).toISOString(),
    tournament_name: event.tournamentName,
    event_display_name: event.eventDisplayName,
    videogame_id: event.videogameId,
    videogame_name: event.videogameName,
    entrant_mappings: event.entrantMappings.map((mapping) => ({
      watch_player_id: mapping.watchPlayerId,
      entrant_id: mapping.entrantId,
      entrant_name: mapping.entrantName,
    })),
  };
}

async function filterDiscoveredEventsByInterest(
  bot: Telegraf | undefined,
  events: StartggDiscoveredEvent[],
  players: StartggWatchPlayer[],
): Promise<StartggDiscoveredEvent[]> {
  deleteExpiredStartggInterestState();
  const playerNames = new Map(players.map((player) => [player.id, player.player_name]));
  const allowed: StartggDiscoveredEvent[] = [];

  for (const event of events) {
    updateStartggWatchEventVideogame(
      event.eventSlug,
      event.videogameId,
      event.videogameName,
    );
    const preference = findStartggVideogamePreference(event.videogameId);
    if (preference === 'follow' || hasStartggEventInterestOverride(event.eventSlug)) {
      allowed.push(event);
      continue;
    }
    deactivateStartggWatchEventBySlug(event.eventSlug);
    if (preference === 'ignore') continue;

    upsertStartggPendingEvent({
      eventSlug: event.eventSlug,
      eventName: event.eventName,
      tournamentName: event.tournamentName,
      tournamentEndAt: new Date(event.tournamentEndAt * 1000).toISOString(),
      videogameId: event.videogameId,
      videogameName: event.videogameName,
      playerNames: event.watchPlayerIds.map((id) => {
        const name = playerNames.get(id);
        if (!name) {
          throw new Error(`start.gg discovered watch player is missing: ${id}`);
        }
        return name;
      }),
    });
  }

  const pendingPrompts = listStartggPendingEventsNeedingPrompt();
  if (pendingPrompts.length > 0 && !bot) {
    throw new Error('start.gg interest prompt requires Telegram bot.');
  }
  for (const pending of pendingPrompts) {
    const message = await bot!.telegram.sendMessage(
      config.tgChatId,
      formatStartggInterestPrompt({
        playerNames: JSON.parse(pending.player_names) as string[],
        videogameName: pending.videogame_name,
        tournamentName: pending.tournament_name,
      }),
      {
        parse_mode: 'HTML',
        ...buildStartggInterestPromptButtons(pending.id),
      },
    );
    markStartggPendingEventPrompted(pending.id, message.message_id);
  }

  return allowed;
}

export async function syncStartggPresetPlayers(): Promise<number> {
  const config = loadStartggPresetPlayersConfig();
  let updatedConfig = false;
  let synced = 0;
  for (const player of config.players) {
    let playerId: number;
    let playerName: string;
    let userId: number | null = null;
    let gamerTag: string | null = null;
    const cachedPlayer = player.player_id
      ? findStartggWatchPlayerByPlayerId(player.player_id)
      : null;
    const hasCachedIdentity = cachedPlayer?.user_id !== null
      && cachedPlayer?.user_id !== undefined
      && Boolean(cachedPlayer.gamer_tag);

    if (player.user_url && !hasCachedIdentity) {
      const resolved = await resolveUserToPlayer(player.user_url);
      playerId = resolved.playerId;
      playerName = resolved.playerName;
      userId = resolved.userId;
      gamerTag = resolved.gamerTag;
      if (player.player_id !== resolved.playerId || player.player_name !== resolved.playerName) {
        player.player_id = resolved.playerId;
        player.player_name = resolved.playerName;
        updatedConfig = true;
      }
    } else if (player.player_id) {
      playerId = player.player_id;
      playerName = player.player_name || cachedPlayer?.player_name || player.alias;
      userId = cachedPlayer?.user_id ?? null;
      gamerTag = cachedPlayer?.gamer_tag ?? null;
    } else {
      throw new Error(`无效选手配置：${player.alias}`);
    }

    const existing = findStartggWatchPlayerByPlayerId(playerId);
    if (!existing) {
      createStartggWatchPlayer(playerId, playerName, userId, gamerTag);
    } else if (userId !== null && gamerTag !== null && (
      existing.player_name !== playerName
      || existing.user_id !== userId
      || existing.gamer_tag !== gamerTag
    )) {
      updateStartggWatchPlayerIdentity(existing.id, playerName, userId, gamerTag);
    } else if (existing.player_name !== playerName) {
      updateStartggWatchPlayerName(existing.id, playerName);
    }
    synced += 1;
  }
  if (updatedConfig) {
    writeStartggPresetPlayersConfig(config);
  }
  return synced;
}

export async function runStartggWatchNow(bot?: Telegraf): Promise<{
  checkedPlayers: number;
  checkedEvents: number;
  changed: number;
  activeSetCount: number;
  activeEventSlugs: string[];
}> {
  await syncStartggPresetPlayers();
  const players = listEnabledStartggWatchPlayers();
  const discoveredEvents = await discoverStartggActiveEventsForPlayers(players);
  const allowedEvents = await filterDiscoveredEventsByInterest(bot, discoveredEvents, players);
  syncAutoDiscoveredStartggWatchEvents(allowedEvents.map(toWatchEventInput));
  await syncFeaturedEntrantsForActiveEvents();
  const watchSummary = await runStartggWatchOnce(bot);
  return {
    checkedPlayers: watchSummary.checkedPlayers,
    checkedEvents: watchSummary.checkedEvents,
    changed: watchSummary.changed,
    activeSetCount: watchSummary.activeSetCount,
    activeEventSlugs: watchSummary.activeEventSlugs,
  };
}

function groupDiscoveredEventsByTournament(events: StartggDiscoveredEvent[]): StartggGoTournamentCandidate[] {
  const grouped = new Map<number, StartggGoTournamentCandidate>();
  for (const event of events) {
    const existing = grouped.get(event.tournamentId);
    if (existing) {
      existing.events.push(event);
      continue;
    }
    grouped.set(event.tournamentId, {
      tournamentId: event.tournamentId,
      tournamentName: event.tournamentName,
      tournamentSlug: event.tournamentSlug,
      events: [event],
    });
  }

  return Array.from(grouped.values()).sort((a, b) => a.tournamentName.localeCompare(b.tournamentName));
}

function normalizeStartggGoSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactStartggGoSearchText(value: string): string {
  return normalizeStartggGoSearchText(value).replace(/\s+/g, '');
}

function matchesStartggGoKeyword(candidate: StartggGoTournamentCandidate, keyword: string): boolean {
  const query = normalizeStartggGoSearchText(keyword);
  const compactQuery = compactStartggGoSearchText(keyword);
  const name = normalizeStartggGoSearchText(candidate.tournamentName);
  const slug = normalizeStartggGoSearchText(candidate.tournamentSlug);
  return name.includes(query)
    || slug.includes(query)
    || compactStartggGoSearchText(candidate.tournamentName).includes(compactQuery)
    || compactStartggGoSearchText(candidate.tournamentSlug).includes(compactQuery);
}

export async function runStartggGo(bot: Telegraf | undefined, keyword: string): Promise<StartggGoResult> {
  const syncedPlayers = await syncStartggPresetPlayers();
  const players = listEnabledStartggWatchPlayers();
  if (players.length === 0) {
    throw new Error('固定选手清单为空，无法自动发现赛事。');
  }

  const events = await discoverStartggActiveEventsForPlayers(players);
  if (events.length === 0) {
    throw new Error('没有从固定选手关联或当前活动候选中发现赛事。');
  }
  const candidates = groupDiscoveredEventsByTournament(events);
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    const allowedEvents = await filterDiscoveredEventsByInterest(bot, events, players);
    if (allowedEvents.length === 0) {
      return {
        status: 'interest_pending',
        syncedPlayers,
        pendingEvents: events.length,
      };
    }
    replaceActiveStartggWatchEvents(allowedEvents.map(toWatchEventInput), 'auto');
    await syncFeaturedEntrantsForActiveEvents();
    const watchSummary = await runStartggWatchOnce(bot, {
      eventSlugs: allowedEvents.map((event) => event.eventSlug),
    });
    return {
      status: 'started',
      keyword: trimmedKeyword,
      syncedPlayers,
      tournamentName: '自动发现当前进行中的赛事',
      tournamentSlug: '',
      discoveredEvents: allowedEvents.length,
      checkedPlayers: watchSummary.checkedPlayers,
      checkedEvents: watchSummary.checkedEvents,
      changed: watchSummary.changed,
      activeSetCount: watchSummary.activeSetCount,
      activeEventSlugs: watchSummary.activeEventSlugs,
    };
  }

  const matchedCandidates = candidates.filter((candidate) => matchesStartggGoKeyword(candidate, trimmedKeyword));
  if (matchedCandidates.length === 0) {
    return {
      status: 'candidates',
      reason: 'no_match',
      keyword: trimmedKeyword,
      syncedPlayers,
      candidates,
    };
  }
  if (matchedCandidates.length > 1) {
    return {
      status: 'candidates',
      reason: 'multiple_matches',
      keyword: trimmedKeyword,
      syncedPlayers,
      candidates: matchedCandidates,
    };
  }

  const matchedTournament = matchedCandidates[0]!;
  for (const event of matchedTournament.events) {
    setStartggVideogamePreference(event.videogameId, event.videogameName, 'follow');
  }
  replaceActiveStartggWatchEvents(matchedTournament.events.map(toWatchEventInput), 'manual');
  await syncFeaturedEntrantsForActiveEvents();

  const watchSummary = await runStartggWatchOnce(bot, {
    eventSlugs: matchedTournament.events.map((event) => event.eventSlug),
  });

  return {
    status: 'started',
    keyword: trimmedKeyword,
    syncedPlayers,
    tournamentName: matchedTournament.tournamentName,
    tournamentSlug: matchedTournament.tournamentSlug,
    discoveredEvents: matchedTournament.events.length,
    checkedPlayers: watchSummary.checkedPlayers,
    checkedEvents: watchSummary.checkedEvents,
    changed: watchSummary.changed,
    activeSetCount: watchSummary.activeSetCount,
    activeEventSlugs: watchSummary.activeEventSlugs,
  };
}
