import { fetchWeather } from './fetchers/weather';
import { fetchGameNews } from './fetchers/games';
import { fetchGithubTrending } from './fetchers/github';
import { fetchEnglishContent } from './fetchers/english';
import { fetchV2exHot } from './fetchers/v2ex';
import { summarizeNewsWithAI, summarizeGithubWithAI, generateLifeTipWithAI, generateMorningQuoteWithAI, teachEnglishWithAI, generateEnglishFallbackWithAI, summarizeV2exWithAI } from './ai/deepseek';
import { formatTelegramMessage, formatGithubMessage, formatSleepMessage, formatWakeupMessage, formatEnglishMessage, formatV2exMessage } from './formatters';
import { sendTelegramMessage } from './publishers/telegram';

const MINUTES_PER_DAY = 24 * 60;
const TOLERANCE_MINUTES = 10;

const SPECIAL_SCHEDULE = {
  sleep: 10,           // 00:10
  wakeup: 8 * 60 + 30, // 08:30
  news: 9 * 60 + 55,   // 09:55
  github: 15 * 60,     // 15:00
  v2ex: 20 * 60        // 20:00
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
  const currentUTCHour = now.getUTCHours();
  const currentUTCMinute = now.getUTCMinutes();
  const chinaMinuteOfDay = ((currentUTCHour * 60 + currentUTCMinute) + 8 * 60) % (24 * 60);
  const chinaHour = Math.floor(chinaMinuteOfDay / 60);
  const chinaMinute = chinaMinuteOfDay % 60;
  const chinaTime = `${String(chinaHour).padStart(2, '0')}:${String(chinaMinute).padStart(2, '0')}`;
  console.log(`Current UTC Time: ${String(currentUTCHour).padStart(2, '0')}:${String(currentUTCMinute).padStart(2, '0')}`);
  console.log(`Current China Time: ${chinaTime}`);

  // --- 1. 固定触发点模式（10 分钟容差） ---
  if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.sleep)) {
    console.log('Mode: Midnight Sleep Reminder');
    const tip = await generateLifeTipWithAI();
    const message = formatSleepMessage(tip);
    await sendTelegramMessage(message);
  }
  else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.wakeup)) {
    console.log('Mode: Morning Wake-up');
    const [weather, quote] = await Promise.all([
      fetchWeather(),
      generateMorningQuoteWithAI()
    ]);
    const message = formatWakeupMessage(weather, quote);
    await sendTelegramMessage(message);
  }
  else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.news)) {
    console.log('Mode: Morning News');
    const [weather, rawNews] = await Promise.all([
      fetchWeather(),
      fetchGameNews()
    ]);
    const aiProcessedNews = await summarizeNewsWithAI(rawNews);
    const message = formatTelegramMessage(weather, aiProcessedNews);
    await sendTelegramMessage(message);
  }
  else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.github)) {
    console.log('Mode: Afternoon Github Trending');
    const repos = await fetchGithubTrending();
    const summary = await summarizeGithubWithAI(repos);
    const message = formatGithubMessage(summary);
    await sendTelegramMessage(message);
  }
  else if (isNearSchedule(chinaMinuteOfDay, SPECIAL_SCHEDULE.v2ex)) {
    console.log('Mode: Evening V2EX Hot Topics');
    const topics = await fetchV2exHot();
    const summary = await summarizeV2exWithAI(topics);
    const message = formatV2exMessage(summary);
    await sendTelegramMessage(message);
  }
  // --- 2. 其他所有时段：英语学习模式（含手动执行） ---
  else {
    console.log('Mode: Daily English Teacher');
    const article = await fetchEnglishContent();
    const summary = article
      ? await teachEnglishWithAI(article)
      : await generateEnglishFallbackWithAI();
    const message = formatEnglishMessage(summary);
    await sendTelegramMessage(message);
  }

  
  console.log('Task finished.');
}

main().catch(error => {
  console.error('Task encountered an error:', error);
  process.exit(1);
});
