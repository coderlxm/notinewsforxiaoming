import {
  createStartggWatchPlayer,
  findStartggWatchPlayerByPlayerId,
  listEnabledStartggWatchPlayers,
  replaceActiveStartggWatchEvents,
  syncAutoDiscoveredStartggWatchEvents,
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
      pendingSetCount: number;
    };

function toWatchEventInput(event: StartggDiscoveredEvent): {
  event_slug: string;
  event_name: string;
  event_id: number;
  tournament_end_at: string;
} {
  return {
    event_slug: event.eventSlug,
    event_name: event.eventName,
    event_id: event.eventId,
    tournament_end_at: new Date(event.tournamentEndAt * 1000).toISOString(),
  };
}

export async function syncStartggPresetPlayers(): Promise<number> {
  const config = loadStartggPresetPlayersConfig();
  let updatedConfig = false;
  let synced = 0;
  for (const player of config.players) {
    let playerId: number;
    let playerName: string;

    if (player.player_id) {
      playerId = player.player_id;
      playerName = player.player_name || player.alias;
    } else if (player.user_url) {
      const resolved = await resolveUserToPlayer(player.user_url);
      playerId = resolved.playerId;
      playerName = resolved.playerName;
      player.player_id = resolved.playerId;
      player.player_name = resolved.playerName;
      updatedConfig = true;
    } else {
      throw new Error(`无效选手配置：${player.alias}`);
    }

    const existing = findStartggWatchPlayerByPlayerId(playerId);
    if (!existing) {
      createStartggWatchPlayer(playerId, playerName);
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
  pendingSetCount: number;
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
    pendingSetCount: watchSummary.pendingSetCount,
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
    throw new Error('没有从固定选手近期 set 中发现当前赛事。');
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
      pendingSetCount: watchSummary.pendingSetCount,
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
    pendingSetCount: watchSummary.pendingSetCount,
  };
}
