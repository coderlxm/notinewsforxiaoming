import {
  createStartggWatchEvent,
  createStartggWatchPlayer,
  findStartggWatchEventBySlug,
  findStartggWatchPlayerByPlayerId,
  updateStartggWatchEventResolved,
  updateStartggWatchPlayerName,
} from './startggRepository';
import {
  getActiveTournamentWindows,
  loadStartggPresetPlayersConfig,
  loadStartggTournamentWindowsConfig,
  type StartggTournamentWindow,
} from './startggPresetConfig';
import { fetchEventMeta, resolveUserToPlayer, runStartggWatchOnce } from './startggTracker';
import type { Telegraf } from 'telegraf';

export interface StartggPresetSyncSummary {
  playersSynced: number;
  activeWindowCount: number;
  activeWindows: StartggTournamentWindow[];
}

function dedupeEventsBySlug(windows: StartggTournamentWindow[]): Array<{ event_slug: string; event_name: string }> {
  const slugMap = new Map<string, { event_slug: string; event_name: string }>();
  for (const window of windows) {
    for (const event of window.events) {
      if (slugMap.has(event.event_slug)) continue;
      slugMap.set(event.event_slug, event);
    }
  }
  return Array.from(slugMap.values());
}

export async function syncStartggPresetPlayers(): Promise<number> {
  const config = loadStartggPresetPlayersConfig();
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
  return synced;
}

export async function syncStartggActiveWindowEvents(now: Date): Promise<StartggPresetSyncSummary> {
  const windowsConfig = loadStartggTournamentWindowsConfig();
  const activeWindows = getActiveTournamentWindows(windowsConfig, now);
  const playersSynced = await syncStartggPresetPlayers();
  if (activeWindows.length === 0) {
    return {
      playersSynced,
      activeWindowCount: 0,
      activeWindows,
    };
  }

  const events = dedupeEventsBySlug(activeWindows);
  for (const event of events) {
    const meta = await fetchEventMeta(event.event_slug);
    const existing = findStartggWatchEventBySlug(meta.slug);
    const eventName = meta.tournamentName ? `${meta.tournamentName} / ${meta.name}` : meta.name;
    if (!existing) {
      createStartggWatchEvent(meta.slug, eventName);
    } else {
      updateStartggWatchEventResolved(existing.id, meta.id, eventName);
    }
  }

  return {
    playersSynced,
    activeWindowCount: activeWindows.length,
    activeWindows,
  };
}

export async function runStartggWatchByTournamentWindow(bot?: Telegraf): Promise<{
  inWindow: boolean;
  windowNames: string[];
  checkedPlayers: number;
  checkedEvents: number;
  changed: number;
}> {
  const now = new Date();
  const syncSummary = await syncStartggActiveWindowEvents(now);
  const watchSummary = await runStartggWatchOnce(bot);
  return {
    inWindow: syncSummary.activeWindowCount > 0,
    windowNames: syncSummary.activeWindows.map((window) => window.name),
    checkedPlayers: watchSummary.checkedPlayers,
    checkedEvents: watchSummary.checkedEvents,
    changed: watchSummary.changed,
  };
}
