import {
  createStartggWatchPlayer,
  findStartggWatchPlayerByPlayerId,
  listActiveStartggWatchEvents,
  updateStartggWatchEventResolved,
  updateStartggWatchPlayerName,
} from './startggRepository';
import {
  loadStartggPresetPlayersConfig,
  writeStartggPresetPlayersConfig,
} from './startggPresetConfig';
import { fetchEventMeta, resolveUserToPlayer, runStartggWatchOnce } from './startggTracker';
import type { Telegraf } from 'telegraf';

export interface StartggPresetSyncSummary {
  playersSynced: number;
  activeEventCount: number;
  activeEventSlugs: string[];
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

export async function syncStartggApiActiveEvents(now: Date): Promise<StartggPresetSyncSummary> {
  const playersSynced = await syncStartggPresetPlayers();
  const activeEventSlugs: string[] = [];
  const nowUnix = Math.floor(now.getTime() / 1000);
  const events = listActiveStartggWatchEvents();
  for (const event of events) {
    const meta = await fetchEventMeta(event.event_slug);
    const eventName = meta.tournamentName ? `${meta.tournamentName} / ${meta.name}` : meta.name;
    updateStartggWatchEventResolved(event.id, meta.id, eventName);
    if (meta.tournamentStartAt === null || meta.tournamentEndAt === null) {
      throw new Error(`start.gg 赛事缺少时间字段：${meta.slug}`);
    }
    if (meta.tournamentStartAt <= nowUnix && nowUnix <= meta.tournamentEndAt) {
      activeEventSlugs.push(meta.slug);
    }
  }

  return {
    playersSynced,
    activeEventCount: activeEventSlugs.length,
    activeEventSlugs,
  };
}

export async function runStartggWatchByApiWindow(bot?: Telegraf): Promise<{
  inWindow: boolean;
  activeEventCount: number;
  checkedPlayers: number;
  checkedEvents: number;
  changed: number;
  pendingSetCount: number;
}> {
  const now = new Date();
  const syncSummary = await syncStartggApiActiveEvents(now);
  if (syncSummary.activeEventCount === 0) {
    return {
      inWindow: false,
      activeEventCount: 0,
      checkedPlayers: 0,
      checkedEvents: 0,
      changed: 0,
      pendingSetCount: 0,
    };
  }

  const watchSummary = await runStartggWatchOnce(bot, { eventSlugs: syncSummary.activeEventSlugs });
  return {
    inWindow: true,
    activeEventCount: syncSummary.activeEventCount,
    checkedPlayers: watchSummary.checkedPlayers,
    checkedEvents: watchSummary.checkedEvents,
    changed: watchSummary.changed,
    pendingSetCount: watchSummary.pendingSetCount,
  };
}
