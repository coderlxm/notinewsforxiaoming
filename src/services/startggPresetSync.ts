import {
  createStartggWatchPlayer,
  findStartggWatchPlayerByPlayerId,
  updateStartggWatchPlayerName,
} from './startggRepository';
import {
  loadStartggPresetPlayersConfig,
  writeStartggPresetPlayersConfig,
} from './startggPresetConfig';
import { resolveUserToPlayer, runStartggWatchOnce } from './startggTracker';
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
