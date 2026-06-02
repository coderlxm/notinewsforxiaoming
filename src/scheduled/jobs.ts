import schedule from 'node-schedule';
import type { Telegraf } from 'telegraf';
import { runMode } from './runMode';
import { getChinaDayOfWeek } from '../utils/time';
import { isChinaWorkday } from '../calendar/chinaWorkday';

const VITAMIN_WORKDAY_RANDOM_WINDOW_MS = 15 * 60 * 1000;

function scheduleWorkdayVitamin(bot: Telegraf): void {
  const delay = Math.floor(Math.random() * VITAMIN_WORKDAY_RANDOM_WINDOW_MS);
  setTimeout(async () => {
    await runMode('vitamin', getChinaDayOfWeek(), bot);
  }, delay);
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

  // startgg_watch: every 20 minutes
  schedule.scheduleJob({ minute: new schedule.Range(0, 59, 20), tz: 'Asia/Shanghai' }, async () => {
    await runMode('startgg_watch', getChinaDayOfWeek(), bot);
  });

  // english: 21:30
  schedule.scheduleJob({ hour: 21, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('english', getChinaDayOfWeek(), bot);
  });

  // fitness: Mon(1) / Wed(3) 20:30
  schedule.scheduleJob({ dayOfWeek: [1, 3], hour: 20, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('fitness', getChinaDayOfWeek(), bot);
  });

  // fitness: Sat(6) 14:00
  schedule.scheduleJob({ dayOfWeek: [6], hour: 14, minute: 0, tz: 'Asia/Shanghai' }, async () => {
    await runMode('fitness', getChinaDayOfWeek(), bot);
  });

  console.log('Fixed jobs registered.');
}
