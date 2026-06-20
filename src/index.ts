import { runMode, parseForcedMode } from './scheduled/runMode.js';
import type { PushMode } from './scheduled/runMode.js';
import { isChinaWorkday } from './calendar/chinaWorkday.js';
import { bj } from './utils/time.js';

const MINUTES_PER_DAY = 24 * 60;
const TOLERANCE_MINUTES = 10;
const TEST_MODE_ENABLED = process.env.TEST_MODE_ENABLED === '1';
const TEST_FORCE_MODE = (process.env.TEST_FORCE_MODE || '').trim().toLowerCase();

const SPECIAL_SCHEDULE = {
  sleep: 10,           // 00:10
  wakeup: 8 * 60 + 30, // 08:30
  coffee: 8 * 60 + 58, // 08:58 (China workdays only)
  v2ex_buffered_push: 8 * 60 + 41, // 08:41
  server_health: 9 * 60 + 10, // 09:10
  news: 9 * 60 + 55,   // 09:55
  vitamin_lunch: 12 * 60 + 30, // 12:30
  av_update_morning: 7 * 60 + 30, // 07:30
  av_update_afternoon: 15 * 60 + 30, // 15:30
  av_update_night: 23 * 60 + 30, // 23:30
  startgg_watch_day: 10 * 60 + 20, // 10:20
  startgg_watch_night: 22 * 60 + 20, // 22:20
  github: 15 * 60,     // 15:00
  vitamin_dinner: 18 * 60 + 30, // 18:30
  v2ex: 20 * 60,       // 20:00
  fitness_weekday: 20 * 60 + 30, // 20:30 (周一, 周三)
  fitness_weekend: 14 * 60       // 14:00 (周六)
};

function minuteDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, MINUTES_PER_DAY - diff);
}

function isNearSchedule(currentMinuteOfDay: number, targetMinuteOfDay: number): boolean {
  return minuteDistance(currentMinuteOfDay, targetMinuteOfDay) <= TOLERANCE_MINUTES;
}

async function main() {
  const now = new Date();
  const bjNow = bj();
  const chinaDayOfWeek = bjNow.day();
  const chinaHour = bjNow.hour();
  const chinaMinute = bjNow.minute();
  const chinaMinuteOfDay = chinaHour * 60 + chinaMinute;
  const chinaTime = bjNow.format('HH:mm');
  console.log(`Current UTC Time: ${now.toISOString().slice(11, 16)}`);
  console.log(`Current China Time: ${chinaTime} (Day of Week: ${chinaDayOfWeek})`);

  if (TEST_MODE_ENABLED) {
    const forcedMode = parseForcedMode(TEST_FORCE_MODE);
    if (!forcedMode) {
      throw new Error(`Invalid TEST_FORCE_MODE: "${TEST_FORCE_MODE}". Allowed: sleep,wakeup,server_health,news,github,v2ex,v2ex_buffered_push,fitness,vitamin,english,av_update,startgg_watch,coffee`);
    }
    console.log(`Test mode enabled. Bypass schedule and force mode: ${forcedMode}`);
    await runMode(forcedMode, chinaDayOfWeek);
  }
  else {
    let selectedMode: PushMode | null = 'english';
    if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.sleep)) {
      selectedMode = 'sleep';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.wakeup)) {
      selectedMode = 'wakeup';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.coffee)) {
      selectedMode = isChinaWorkday(now) ? 'coffee' : null;
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.v2ex_buffered_push)) {
      selectedMode = isChinaWorkday(now) ? 'v2ex_buffered_push' : null;
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.server_health)) {
      selectedMode = 'server_health';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.news)) {
      selectedMode = 'news';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.vitamin_lunch)) {
      selectedMode = isChinaWorkday(now) ? null : 'vitamin';
    } else if (
      isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.av_update_morning) ||
      isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.av_update_afternoon) ||
      isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.av_update_night)
    ) {
      selectedMode = 'av_update';
    } else if (
      isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.startgg_watch_day) ||
      isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.startgg_watch_night)
    ) {
      selectedMode = 'startgg_watch';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.github)) {
      selectedMode = 'github';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.vitamin_dinner)) {
      selectedMode = 'vitamin';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.v2ex)) {
      selectedMode = 'v2ex';
    // fitness: 暂时关闭推送
    // } else if (
    //   ((chinaDayOfWeek === 1 || chinaDayOfWeek === 3) && isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.fitness_weekday)) ||
    //   (chinaDayOfWeek === 6 && isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.fitness_weekend))
    // ) {
    //   selectedMode = 'fitness';
    // }
    if (selectedMode) {
      await runMode(selectedMode, chinaDayOfWeek);
    }
  }

  console.log('Task finished.');
}

main().catch(error => {
  console.error('Task encountered an error:', error);
  process.exit(1);
});
