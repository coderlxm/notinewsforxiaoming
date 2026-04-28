import { fetchWeather } from './fetchers/weather';
import { fetchGameNews } from './fetchers/games';
import { fetchGithubTrending } from './fetchers/github';
import { summarizeNewsWithAI, summarizeGithubWithAI, generateLifeTipWithAI, generateMorningQuoteWithAI } from './ai/deepseek';
import { formatTelegramMessage, formatGithubMessage, formatSleepMessage, formatWakeupMessage } from './formatters';
import { sendTelegramMessage } from './publishers/telegram';

async function main() {
  const currentUTCHour = new Date().getUTCHours();
  console.log(`Current UTC Hour: ${currentUTCHour}`);

  // --- 1. 深夜睡眠模式 (北京时间 00:00 - 08:00 | UTC 16:00 - 00:00) ---
  if (currentUTCHour >= 16 || currentUTCHour < 0) {
    console.log('Mode: Midnight Sleep Reminder');
    const tip = await generateLifeTipWithAI();
    const message = formatSleepMessage(tip);
    await sendTelegramMessage(message);
  }
  // --- 2. 起床提醒模式 (北京时间 08:00 - 09:00 | UTC 00:00 - 01:00) ---
  else if (currentUTCHour >= 0 && currentUTCHour < 1) {
    console.log('Mode: Morning Wake-up');
    const [weather, quote] = await Promise.all([
      fetchWeather(),
      generateMorningQuoteWithAI()
    ]);
    const message = formatWakeupMessage(weather, quote);
    await sendTelegramMessage(message);
  }
  // --- 3. 游戏早报模式 (北京时间 09:00 - 13:00 | UTC 01:00 - 05:00) ---
  else if (currentUTCHour >= 1 && currentUTCHour < 5) {
    console.log('Mode: Morning News');
    const [weather, rawNews] = await Promise.all([
      fetchWeather(),
      fetchGameNews()
    ]);
    const aiProcessedNews = await summarizeNewsWithAI(rawNews);
    const message = formatTelegramMessage(weather, aiProcessedNews);
    await sendTelegramMessage(message);
  } 
  // --- 4. GitHub 趋势模式 (北京时间 13:00 - 24:00 | UTC 05:00 - 16:00) ---
  else {
    console.log('Mode: Afternoon Github Trending');
    const repos = await fetchGithubTrending();
    const summary = await summarizeGithubWithAI(repos);
    const message = formatGithubMessage(summary);
    await sendTelegramMessage(message);
  }
  
  console.log('Task finished.');
}

main().catch(error => {
  console.error('Task encountered an error:', error);
  process.exit(1);
});
