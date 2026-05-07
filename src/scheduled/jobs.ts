import schedule from 'node-schedule';
import type { Telegraf } from 'telegraf';
import { runMode } from './runMode';

function getChinaDayOfWeek(): number {
  const now = Date.now();
  return new Date(now + 8 * 60 * 60 * 1000).getUTCDay();
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

  // server_health: 09:10
  schedule.scheduleJob({ hour: 9, minute: 10, tz: 'Asia/Shanghai' }, async () => {
    await runMode('server_health', getChinaDayOfWeek(), bot);
  });

  // news: 09:55
  schedule.scheduleJob({ hour: 9, minute: 55, tz: 'Asia/Shanghai' }, async () => {
    await runMode('news', getChinaDayOfWeek(), bot);
  });

  // vitamin: 12:30
  schedule.scheduleJob({ hour: 12, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('vitamin', getChinaDayOfWeek(), bot);
  });

  // github: 15:00
  schedule.scheduleJob({ hour: 15, minute: 0, tz: 'Asia/Shanghai' }, async () => {
    await runMode('github', getChinaDayOfWeek(), bot);
  });

  // vitamin: 18:30
  schedule.scheduleJob({ hour: 18, minute: 30, tz: 'Asia/Shanghai' }, async () => {
    await runMode('vitamin', getChinaDayOfWeek(), bot);
  });

  // v2ex: 20:00
  schedule.scheduleJob({ hour: 20, minute: 0, tz: 'Asia/Shanghai' }, async () => {
    await runMode('v2ex', getChinaDayOfWeek(), bot);
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
