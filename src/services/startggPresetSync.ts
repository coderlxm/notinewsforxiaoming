import {
  createStartggWatchPlayer,
  findStartggWatchPlayerByPlayerId,
  listEnabledStartggWatchPlayers,
  replaceActiveStartggWatchEvents,
  syncAutoDiscoveredStartggWatchEvents,
  type StartggWatchEventInput,
  updateStartggWatchPlayerIdentity,
  updateStartggWatchPlayerName,
} from './startggRepository.js';
import {
  loadStartggPresetPlayersConfig,
  writeStartggPresetPlayersConfig,
} from './startggPresetConfig.js';
import {
  discoverStartggActiveEventsForPlayers,
  type StartggDiscoveredEvent,
} from './startggDiscovery.js';
import { resolveUserToPlayer, runStartggWatchOnce } from './startgg/index.js';
import type { Telegraf } from 'telegraf';

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

function toWatchEventInput(event: StartggDiscoveredEvent): StartggWatchEventInput {
  return {
    event_slug: event.eventSlug,
    event_name: event.eventName,
    event_id: event.eventId,
    tournament_end_at: new Date(event.tournamentEndAt * 1000).toISOString(),
    tournament_name: event.tournamentName,
    event_display_name: event.eventDisplayName,
    entrant_mappings: event.entrantMappings.map((mapping) => ({
      watch_player_id: mapping.watchPlayerId,
      entrant_id: mapping.entrantId,
      entrant_name: mapping.entrantName,
    })),
  };
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
  syncAutoDiscoveredStartggWatchEvents(discoveredEvents.map(toWatchEventInput));
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
    replaceActiveStartggWatchEvents(events.map(toWatchEventInput), 'auto');
    const watchSummary = await runStartggWatchOnce(bot, {
      eventSlugs: events.map((event) => event.eventSlug),
    });
    return {
      status: 'started',
      keyword: trimmedKeyword,
      syncedPlayers,
      tournamentName: '自动发现当前进行中的赛事',
      tournamentSlug: '',
      discoveredEvents: events.length,
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
  replaceActiveStartggWatchEvents(matchedTournament.events.map(toWatchEventInput), 'manual');

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
