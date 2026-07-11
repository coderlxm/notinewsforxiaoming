import schedule from 'node-schedule';
import type { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import { runMode } from './runMode.js';
import { getChinaDayOfWeek } from '../utils/time.js';
import { isChinaWorkday } from '../calendar/chinaWorkday.js';
import { runStartggWatchNow } from '../services/startggPresetSync.js';
import { runStartggWatchOnce } from '../services/startgg/index.js';
import {
  isStartggPollingPersistedEnabled,
  listActiveStartggWatchEvents,
  resetActiveStartggWatchEventStates,
  setStartggPollingPersistedEnabled,
} from '../services/startggRepository.js';

const VITAMIN_WORKDAY_RANDOM_WINDOW_MS = 15 * 60 * 1000;
const STARTGG_FAST_WATCH_INTERVAL_MS = 2 * 60 * 1000;

let startggFastWatchTimer: ReturnType<typeof setTimeout> | null = null;
let startggFastWatchDueAt: Date | null = null;
let startggPollJob: schedule.Job | null = null;

function scheduleWorkdayVitamin(bot: Telegraf): void {
  const delay = Math.floor(Math.random() * VITAMIN_WORKDAY_RANDOM_WINDOW_MS);
  setTimeout(async () => {
    await runMode('vitamin', getChinaDayOfWeek(), bot);
  }, delay);
}

function clearStartggFastWatch(): void {
  if (startggFastWatchTimer) {
    clearTimeout(startggFastWatchTimer);
  }
  startggFastWatchTimer = null;
  startggFastWatchDueAt = null;
}

export function updateStartggFastWatch(bot: Telegraf, pendingEventSlugs: string[]): void {
  if (pendingEventSlugs.length === 0) {
    clearStartggFastWatch();
    return;
  }

  clearStartggFastWatch();
  startggFastWatchDueAt = new Date(Date.now() + STARTGG_FAST_WATCH_INTERVAL_MS);
  startggFastWatchTimer = setTimeout(async () => {
    startggFastWatchTimer = null;
    startggFastWatchDueAt = null;
    await runScheduledStartggFastWatch(bot, pendingEventSlugs);
  }, STARTGG_FAST_WATCH_INTERVAL_MS);
}

async function runScheduledStartggFastWatch(bot: Telegraf, eventSlugs: string[]): Promise<void> {
  console.log(`Mode: start.gg Fast Watch (${eventSlugs.join(', ')})`);
  const summary = await runStartggWatchOnce(bot, { eventSlugs });
  console.log(`start.gg fast watch finished. events=${summary.checkedEvents} players=${summary.checkedPlayers} changed=${summary.changed} pending=${summary.pendingSetCount}`);
  updateStartggFastWatch(bot, summary.pendingEventSlugs);
}

async function runScheduledStartggWatch(bot: Telegraf): Promise<void> {
  console.log('Mode: start.gg Watch');
  const summary = await runStartggWatchNow(bot);
  console.log(`start.gg watch finished. events=${summary.checkedEvents} players=${summary.checkedPlayers} changed=${summary.changed} pending=${summary.pendingSetCount}`);

  const activeEvents = listActiveStartggWatchEvents();
  const allTournamentsEnded = activeEvents.length === 0 || activeEvents.every((event) => {
    if (!event.tournament_end_at) {
      throw new Error(`start.gg active event missing tournament_end_at: ${event.event_slug}`);
    }
    return new Date(event.tournament_end_at).getTime() <= Date.now();
  });
  if (allTournamentsEnded) {
    disableStartggPolling();
    await bot.telegram.sendMessage(
      config.tgChatId,
      'start.gg 当前订阅赛事已结束，自动轮询已关闭。',
    );
    return;
  }

  updateStartggFastWatch(bot, summary.pendingEventSlugs);
}

export function enableStartggPolling(bot: Telegraf, resetState = true): boolean {
  if (startggPollJob) return false;
  if (resetState) {
    resetActiveStartggWatchEventStates();
  }
  startggPollJob = schedule.scheduleJob({ minute: new schedule.Range(0, 59, 20), tz: 'Asia/Shanghai' }, async () => {
    await runScheduledStartggWatch(bot);
  });
  setStartggPollingPersistedEnabled(true);
  return true;
}

export function disableStartggPolling(): boolean {
  setStartggPollingPersistedEnabled(false);
  clearStartggFastWatch();
  if (!startggPollJob) return false;
  startggPollJob.cancel();
  startggPollJob = null;
  return true;
}

export function restoreStartggPolling(bot: Telegraf): void {
  if (!isStartggPollingPersistedEnabled()) return;
  enableStartggPolling(bot, false);
}

export function isStartggPollingEnabled(): boolean {
  return startggPollJob !== null;
}

export function getStartggPollingRuntimeStatus(): {
  pollingEnabled: boolean;
  nextPollAt: Date | null;
  fastPollingEnabled: boolean;
  nextFastPollAt: Date | null;
} {
  return {
    pollingEnabled: startggPollJob !== null,
    nextPollAt: startggPollJob?.nextInvocation() ?? null,
    fastPollingEnabled: startggFastWatchTimer !== null,
    nextFastPollAt: startggFastWatchDueAt,
  };
}

export function registerFixedJobs(bot: Telegraf): void {
  // sleep: 00:10 Beijing time
  schedule.scheduleJob({ hour: 0, minute: 10, tz: 'Asia/Shanghai' }, async () => {
    await runMode('sleep', getChinaDayOfWeek(), bot);
  });

  // wakeup: 08:30
  schedule.scheduleJob({ hour: 8, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('wakeup', getChinaDayOfWeek(), bot);
  });

  // coffee: 08:58 on China workdays
  schedule.scheduleJob({ hour: 8, minute: 58, tz: 'Asia/Shanghai' }, async () => {
    if (!isChinaWorkday(new Date())) return;
    await runMode('coffee', getChinaDayOfWeek(), bot);
  });

  // v2ex buffered push: 08:41 on workdays
  schedule.scheduleJob({ hour: 8, minute: 41, tz: 'Asia/Shanghai' }, async () => {
    if (!isChinaWorkday(new Date())) return;
    await runMode('v2ex_buffered_push', getChinaDayOfWeek(), bot);
  });

  // server_health: 09:10
  schedule.scheduleJob({ hour: 9, minute: 10, tz: 'Asia/Shanghai' }, async () => {
    await runMode('server_health', getChinaDayOfWeek(), bot);
  });

  // news: 09:55
  schedule.scheduleJob({ hour: 9, minute: 55, tz: 'Asia/Shanghai' }, async () => {
    await runMode('news', getChinaDayOfWeek(), bot);
  });

  // english: 10:30
  schedule.scheduleJob({ hour: 10, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('english', getChinaDayOfWeek(), bot);
  });

  // vitamin lunch: 12:30 on non-workdays
  schedule.scheduleJob({ hour: 12, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    if (isChinaWorkday(new Date())) return;
    await runMode('vitamin', getChinaDayOfWeek(), bot);
  });

  // english: 13:30
  schedule.scheduleJob({ hour: 13, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('english', getChinaDayOfWeek(), bot);
  });

  // github: 15:00
  schedule.scheduleJob({ hour: 15, minute: 0, tz: 'Asia/Shanghai' }, async () => {
    await runMode('github', getChinaDayOfWeek(), bot);
  });

  // vitamin dinner: 18:30 on non-workdays
  schedule.scheduleJob({ hour: 18, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    if (isChinaWorkday(new Date())) return;
    await runMode('vitamin', getChinaDayOfWeek(), bot);
  });

  // vitamin dinner: random between 20:45 and 21:00 on China workdays
  schedule.scheduleJob({ hour: 20, minute: 45, tz: 'Asia/Shanghai' }, () => {
    if (!isChinaWorkday(new Date())) return;
    scheduleWorkdayVitamin(bot);
  });

  // v2ex: 20:00
  schedule.scheduleJob({ hour: 20, minute: 0, tz: 'Asia/Shanghai' }, async () => {
    await runMode('v2ex', getChinaDayOfWeek(), bot);
  });

  // av_update: 07:30 / 15:30 / 23:30
  schedule.scheduleJob({ hour: 7, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('av_update', getChinaDayOfWeek(), bot);
  });
  schedule.scheduleJob({ hour: 15, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('av_update', getChinaDayOfWeek(), bot);
  });
  schedule.scheduleJob({ hour: 23, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('av_update', getChinaDayOfWeek(), bot);
  });

  // english: 21:30
  schedule.scheduleJob({ hour: 21, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('english', getChinaDayOfWeek(), bot);
  });

  // fitness: Mon(1) / Wed(3) 20:30 — 暂时关闭推送
  // schedule.scheduleJob({ dayOfWeek: [1, 3], hour: 20, minute: 30, tz: 'Asia/Shanghai' }, async () => {
  //   await runMode('fitness', getChinaDayOfWeek(), bot);
  // });

  // fitness: Sat(6) 14:00 — 暂时关闭推送
  // schedule.scheduleJob({ dayOfWeek: [6], hour: 14, minute: 0, tz: 'Asia/Shanghai' }, async () => {
  //   await runMode('fitness', getChinaDayOfWeek(), bot);
  // });

  console.log('Fixed jobs registered.');
}
