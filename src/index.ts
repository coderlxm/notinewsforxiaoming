import { runMode, parseForcedMode } from './scheduled/runMode';
import type { PushMode } from './scheduled/runMode';

const MINUTES_PER_DAY = 24 * 60;
const TOLERANCE_MINUTES = 10;
const TEST_MODE_ENABLED = process.env.TEST_MODE_ENABLED === '1';
const TEST_FORCE_MODE = (process.env.TEST_FORCE_MODE || '').trim().toLowerCase();

const SPECIAL_SCHEDULE = {
  sleep: 10,           // 00:10
  wakeup: 8 * 60 + 30, // 08:30
  server_health: 9 * 60 + 10, // 09:10
  news: 9 * 60 + 55,   // 09:55
  vitamin_lunch: 12 * 60 + 30, // 12:30
  av_update_midday: 13 * 60, // 13:00
  github: 15 * 60,     // 15:00
  vitamin_dinner: 18 * 60 + 30, // 18:30
  v2ex: 20 * 60,       // 20:00
  av_update_night: 21 * 60, // 21:00
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
  const chinaDayOfWeek = new Date(now.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
  const currentUTCHour = now.getUTCHours();
  const currentUTCMinute = now.getUTCMinutes();
  const chinaMinuteOfDay = ((currentUTCHour * 60 + currentUTCMinute) + 8 * 60) % (24 * 60);
  const chinaHour = Math.floor(chinaMinuteOfDay / 60);
  const chinaMinute = chinaMinuteOfDay % 60;
  const chinaTime = `${String(chinaHour).padStart(2, '0')}:${String(chinaMinute).padStart(2, '0')}`;
  console.log(`Current UTC Time: ${String(currentUTCHour).padStart(2, '0')}:${String(currentUTCMinute).padStart(2, '0')}`);
  console.log(`Current China Time: ${chinaTime} (Day of Week: ${chinaDayOfWeek})`);

  if (TEST_MODE_ENABLED) {
    const forcedMode = parseForcedMode(TEST_FORCE_MODE);
    if (!forcedMode) {
      throw new Error(`Invalid TEST_FORCE_MODE: "${TEST_FORCE_MODE}". Allowed: sleep,wakeup,server_health,news,github,v2ex,fitness,vitamin,english,av_update`);
    }
    console.log(`Test mode enabled. Bypass schedule and force mode: ${forcedMode}`);
    await runMode(forcedMode, chinaDayOfWeek);
  }
  else {
    let selectedMode: PushMode = 'english';
    if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.sleep)) {
      selectedMode = 'sleep';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.wakeup)) {
      selectedMode = 'wakeup';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.server_health)) {
      selectedMode = 'server_health';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.news)) {
      selectedMode = 'news';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.vitamin_lunch)) {
      selectedMode = 'vitamin';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.av_update_midday)) {
      selectedMode = 'av_update';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.github)) {
      selectedMode = 'github';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.vitamin_dinner)) {
      selectedMode = 'vitamin';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.av_update_night)) {
      selectedMode = 'av_update';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.v2ex)) {
      selectedMode = 'v2ex';
    } else if (
      ((chinaDayOfWeek === 1 || chinaDayOfWeek === 3) && isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.fitness_weekday)) ||
      (chinaDayOfWeek === 6 && isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.fitness_weekend))
    ) {
      selectedMode = 'fitness';
    }
    await runMode(selectedMode, chinaDayOfWeek);
  }

  console.log('Task finished.');
}

main().catch(error => {
  console.error('Task encountered an error:', error);
  process.exit(1);
});
