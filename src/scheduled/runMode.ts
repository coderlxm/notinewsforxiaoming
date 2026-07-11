import type { Telegraf } from 'telegraf';
import { fetchWeather } from '../fetchers/weather.js';
import { fetchGameNews } from '../fetchers/games.js';
import { fetchGithubTrending } from '../fetchers/github.js';
import { fetchEnglishContent } from '../fetchers/english.js';
import { fetchV2exHot } from '../fetchers/v2ex.js';
import { isChinaWorkday } from '../calendar/chinaWorkday.js';
import {
  summarizeNewsWithAI,
  summarizeGithubWithAI,
  generateLifeTipWithAI,
  teachEnglishWithAI,
  generateEnglishFallbackWithAI,
  summarizeV2exWithAI,
  generateFitnessPlanWithAI,
} from '../ai/deepseek.js';
import {
  formatTelegramMessage,
  formatGithubMessage,
  formatSleepMessage,
  formatWakeupMessage,
  formatEnglishMessage,
  formatV2exMessage,
  formatFitnessMessage,
  formatVitaminMessage,
  formatServerHealthMessage,
  formatCoffeeMessage,
} from '../formatters/index.js';
import { sendTelegramMessage } from '../publishers/telegram.js';
import { getFitnessContext, markFitnessWorkoutGenerated } from '../services/fitness.js';
import { checkServerHealth } from '../services/serverHealth.js';
import { runAvFetchOnce } from '../services/avTracker.js';
import { bufferHolidayV2exTopics, pushBufferedV2exIfNeeded } from '../services/v2exBufferedPush.js';
import { isVitaminEatenToday, triggerVitaminReminder } from '../services/vitaminReminder.js';
import { runStartggWatchNow } from '../services/startggPresetSync.js';

export type PushMode = 'sleep' | 'wakeup' | 'server_health' | 'news' | 'github' | 'v2ex' | 'v2ex_buffered_push' | 'fitness' | 'vitamin' | 'english' | 'av_update' | 'startgg_watch' | 'coffee';

export function parseForcedMode(rawMode: string): PushMode | null {
  const modeMap: Record<string, PushMode> = {
    sleep: 'sleep',
    wakeup: 'wakeup',
    server_health: 'server_health',
    news: 'news',
    github: 'github',
    v2ex: 'v2ex',
    v2ex_buffered_push: 'v2ex_buffered_push',
    fitness: 'fitness',
    vitamin: 'vitamin',
    english: 'english',
    av_update: 'av_update',
    startgg_watch: 'startgg_watch',
    coffee: 'coffee',
  };
  return modeMap[rawMode] ?? null;
}

export async function runMode(mode: PushMode, chinaDayOfWeek: number, bot?: Telegraf): Promise<void> {
  if (mode === 'sleep') {
    console.log('Mode: Midnight Sleep Reminder');
    const tip = await generateLifeTipWithAI();
    const message = formatSleepMessage(tip);
    await sendTelegramMessage(message, bot);
    return;
  }

  if (mode === 'wakeup') {
    console.log('Mode: Morning Wake-up');
    const weather = await fetchWeather();
    const message = formatWakeupMessage(weather);
    await sendTelegramMessage(message, bot);
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
    await sendTelegramMessage(message, bot);
    return;
  }

  if (mode === 'server_health') {
    console.log('Mode: Server Health Check');
    const results = await checkServerHealth();
    const message = formatServerHealthMessage(results);
    await sendTelegramMessage(message, bot);
    return;
  }

  if (mode === 'github') {
    console.log('Mode: Afternoon Github Trending');
    const repos = await fetchGithubTrending();
    const summary = await summarizeGithubWithAI(repos);
    const message = formatGithubMessage(summary);
    await sendTelegramMessage(message, bot);
    return;
  }

  if (mode === 'v2ex') {
    console.log('Mode: Evening V2EX Hot Topics');
    const topics = await fetchV2exHot();
    if (isChinaWorkday(new Date())) {
      const summary = await summarizeV2exWithAI(topics);
      const message = formatV2exMessage(summary);
      await sendTelegramMessage(message, bot);
      return;
    }
    bufferHolidayV2exTopics(topics, new Date());
    console.log(`V2EX holiday buffer stored. count=${topics.length}`);
    return;
  }

  if (mode === 'v2ex_buffered_push') {
    console.log('Mode: V2EX Buffered Push');
    if (!isChinaWorkday(new Date())) {
      console.log('Skip buffered V2EX push on non-workday.');
      return;
    }
    const result = await pushBufferedV2exIfNeeded(bot);
    console.log(`V2EX buffered push finished. pushed=${result.pushed} topics=${result.topicCount}`);
    return;
  }

  if (mode === 'fitness') {
    console.log('Mode: Fitness Coach');
    const weather = await fetchWeather();
    const weatherText = weather ? weather.text : '未知天气';
    const fitnessContext = getFitnessContext(chinaDayOfWeek);
    const plan = await generateFitnessPlanWithAI(chinaDayOfWeek, weatherText, fitnessContext);
    const message = formatFitnessMessage(plan);
    const sent = await sendTelegramMessage(message, bot);
    if (sent) {
      const nextStatus = markFitnessWorkoutGenerated(fitnessContext.status, fitnessContext.focusArea);
      console.log(`Fitness status updated. Level: ${nextStatus.training_state.current_level}, Total: ${nextStatus.training_state.total_completed}`);
    }
    return;
  }

  if (mode === 'vitamin') {
    console.log('Mode: Vitamin Reminder');
    if (isVitaminEatenToday()) {
      console.log('Vitamin already eaten today. Skip reminder.');
      return;
    }
    if (bot) {
      await triggerVitaminReminder(bot);
    } else {
      const message = formatVitaminMessage();
      await sendTelegramMessage(message);
    }
    return;
  }

  if (mode === 'av_update') {
    console.log('Mode: AV Update Tracker');
    const summary = await runAvFetchOnce(bot, { healthNotify: true });
    console.log(`AV update finished. Checked: ${summary.checkedTargets}, New: ${summary.pushed}, Skipped: ${summary.skipped}`);
    return;
  }

  if (mode === 'startgg_watch') {
    console.log('Mode: start.gg Watch');
    const summary = await runStartggWatchNow(bot);
    console.log(`start.gg watch finished. events=${summary.checkedEvents} players=${summary.checkedPlayers} changed=${summary.changed} pending=${summary.pendingSetCount}`);
    return;
  }

  if (mode === 'coffee') {
    console.log('Mode: Coffee Reminder');
    const message = formatCoffeeMessage();
    await sendTelegramMessage(message, bot);
    return;
  }

  console.log('Mode: Daily English Teacher');
  const article = await fetchEnglishContent();
  const summary = article
    ? await teachEnglishWithAI(article)
    : await generateEnglishFallbackWithAI();
  const message = formatEnglishMessage(summary);
  await sendTelegramMessage(message, bot);
}
