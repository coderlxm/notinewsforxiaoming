import {
  createStartggWatchPlayer,
  findStartggWatchPlayerByPlayerId,
  listEnabledStartggWatchPlayers,
  replaceActiveStartggWatchEvents,
  updateStartggWatchPlayerName,
} from './startggRepository.js';
import {
  loadStartggPresetPlayersConfig,
  writeStartggPresetPlayersConfig,
} from './startggPresetConfig.js';
import { discoverStartggActiveEventsForPlayers } from './startggDiscovery.js';
import { resolveUserToPlayer, runStartggWatchOnce } from './startgg/index.js';
import type { Telegraf } from 'telegraf';

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
  const watchSummary = await runStartggWatchOnce(bot);
  return {
    checkedPlayers: watchSummary.checkedPlayers,
    checkedEvents: watchSummary.checkedEvents,
    changed: watchSummary.changed,
    pendingSetCount: watchSummary.pendingSetCount,
  };
}

export async function runStartggGo(bot?: Telegraf): Promise<{
  syncedPlayers: number;
  discoveredEvents: number;
  checkedPlayers: number;
  checkedEvents: number;
  changed: number;
  pendingSetCount: number;
}> {
  const syncedPlayers = await syncStartggPresetPlayers();
  const players = listEnabledStartggWatchPlayers();
  if (players.length === 0) {
    throw new Error('固定选手清单为空，无法自动发现赛事。');
  }

  const events = await discoverStartggActiveEventsForPlayers(players);
  if (events.length === 0) {
    throw new Error('没有从固定选手近期 set 中发现当前赛事。');
  }

  replaceActiveStartggWatchEvents(events.map((event) => ({
    event_slug: event.eventSlug,
    event_name: event.eventName,
    event_id: event.eventId,
  })));

  const watchSummary = await runStartggWatchOnce(bot, {
    eventSlugs: events.map((event) => event.eventSlug),
  });

  return {
    syncedPlayers,
    discoveredEvents: events.length,
    checkedPlayers: watchSummary.checkedPlayers,
    checkedEvents: watchSummary.checkedEvents,
    changed: watchSummary.changed,
    pendingSetCount: watchSummary.pendingSetCount,
  };
}
