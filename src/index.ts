import { fetchWeather } from './fetchers/weather';
import { fetchGameNews } from './fetchers/games';
import { fetchGithubTrending } from './fetchers/github';
import { fetchEnglishContent } from './fetchers/english';
import { fetchV2exHot } from './fetchers/v2ex';
import { summarizeNewsWithAI, summarizeGithubWithAI, generateLifeTipWithAI, generateMorningQuoteWithAI, teachEnglishWithAI, generateEnglishFallbackWithAI, summarizeV2exWithAI, generateFitnessPlanWithAI } from './ai/deepseek';
import { formatTelegramMessage, formatGithubMessage, formatSleepMessage, formatWakeupMessage, formatEnglishMessage, formatV2exMessage, formatFitnessMessage, formatVitaminMessage, formatServerHealthMessage } from './formatters';
import { sendTelegramMessage } from './publishers/telegram';
import { getFitnessContext, markFitnessWorkoutGenerated } from './services/fitness';
import { checkServerHealth } from './services/serverHealth';

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

type PushMode = 'sleep' | 'wakeup' | 'server_health' | 'news' | 'github' | 'v2ex' | 'fitness' | 'vitamin' | 'english';

function parseForcedMode(rawMode: string): PushMode | null {
  const modeMap: Record<string, PushMode> = {
    sleep: 'sleep',
    wakeup: 'wakeup',
    server_health: 'server_health',
    news: 'news',
    github: 'github',
    v2ex: 'v2ex',
    fitness: 'fitness',
    vitamin: 'vitamin',
    english: 'english'
  };
  return modeMap[rawMode] ?? null;
}

async function runMode(mode: PushMode, chinaDayOfWeek: number): Promise<void> {
  if (mode === 'sleep') {
    console.log('Mode: Midnight Sleep Reminder');
    const tip = await generateLifeTipWithAI();
    const message = formatSleepMessage(tip);
    await sendTelegramMessage(message);
    return;
  }

  if (mode === 'wakeup') {
    console.log('Mode: Morning Wake-up');
    const [weather, quote] = await Promise.all([
      fetchWeather(),
      generateMorningQuoteWithAI()
    ]);
    const message = formatWakeupMessage(weather, quote);
    await sendTelegramMessage(message);
    return;
  }

  if (mode === 'news') {
    console.log('Mode: Morning News');
    const [weather, rawNews] = await Promise.all([
      fetchWeather(),
      fetchGameNews()
    ]);
    const aiProcessedNews = await summarizeNewsWithAI(rawNews);
    const message = formatTelegramMessage(weather, aiProcessedNews);
    await sendTelegramMessage(message);
    return;
  }

  if (mode === 'server_health') {
    console.log('Mode: Server Health Check');
    const results = await checkServerHealth();
    const message = formatServerHealthMessage(results);
    await sendTelegramMessage(message);
    return;
  }

  if (mode === 'github') {
    console.log('Mode: Afternoon Github Trending');
    const repos = await fetchGithubTrending();
    const summary = await summarizeGithubWithAI(repos);
    const message = formatGithubMessage(summary);
    await sendTelegramMessage(message);
    return;
  }

  if (mode === 'v2ex') {
    console.log('Mode: Evening V2EX Hot Topics');
    const topics = await fetchV2exHot();
    const summary = await summarizeV2exWithAI(topics);
    const message = formatV2exMessage(summary);
    await sendTelegramMessage(message);
    return;
  }

  if (mode === 'fitness') {
    console.log('Mode: Fitness Coach');
    const weather = await fetchWeather();
    const weatherText = weather ? weather.text : '未知天气';
    const fitnessContext = getFitnessContext(chinaDayOfWeek);
    const plan = await generateFitnessPlanWithAI(chinaDayOfWeek, weatherText, fitnessContext);
    const message = formatFitnessMessage(plan);
    const sent = await sendTelegramMessage(message);
    if (sent) {
      const nextStatus = markFitnessWorkoutGenerated(fitnessContext.status, fitnessContext.focusArea);
      console.log(`Fitness status updated. Level: ${nextStatus.training_state.current_level}, Total: ${nextStatus.training_state.total_completed}`);
    }
    return;
  }

  if (mode === 'vitamin') {
    console.log('Mode: Vitamin Reminder');
    const message = formatVitaminMessage();
    await sendTelegramMessage(message);
    return;
  }

  console.log('Mode: Daily English Teacher');
  const article = await fetchEnglishContent();
  const summary = article
    ? await teachEnglishWithAI(article)
    : await generateEnglishFallbackWithAI();
  const message = formatEnglishMessage(summary);
  await sendTelegramMessage(message);
}

async function main() {
  const now = new Date();
  // 统一按北京时间计算周几，避免服务器本地时区导致误判。
  const chinaDayOfWeek = new Date(now.getTime() + 8 * 60 * 60 * 1000).getUTCDay(); // 0 是周日, 1-6 是周一到周六
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
      throw new Error(`Invalid TEST_FORCE_MODE: "${TEST_FORCE_MODE}". Allowed: sleep,wakeup,server_health,news,github,v2ex,fitness,vitamin,english`);
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
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.github)) {
      selectedMode = 'github';
    } else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.vitamin_dinner)) {
      selectedMode = 'vitamin';
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
