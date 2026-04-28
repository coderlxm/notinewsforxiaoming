import { fetchWeather } from './fetchers/weather';
import { fetchGameNews } from './fetchers/games';
import { fetchGithubTrending } from './fetchers/github';
import { summarizeNewsWithAI, summarizeGithubWithAI, generateLifeTipWithAI, generateMorningQuoteWithAI } from './ai/deepseek';
import { formatTelegramMessage, formatGithubMessage, formatSleepMessage, formatWakeupMessage } from './formatters';
import { sendTelegramMessage } from './publishers/telegram';

async function main() {
  const currentUTCHour = new Date().getUTCHours();
  console.log(`Current UTC Hour: ${currentUTCHour}`);

  // 北京时间 08:30 (UTC 00:30) 运行起床提醒逻辑
  if (currentUTCHour === 0) {
    console.log('Running morning wake-up task...');
    const [weather, quote] = await Promise.all([
      fetchWeather(),
      generateMorningQuoteWithAI()
    ]);
    const message = formatWakeupMessage(weather, quote);
    await sendTelegramMessage(message);
  }
  // 北京时间 00:10 (UTC 16:10) 运行睡眠提醒逻辑
  else if (currentUTCHour === 16) {
    console.log('Running midnight sleep task...');
    const tip = await generateLifeTipWithAI();
    const message = formatSleepMessage(tip);
    await sendTelegramMessage(message);
  }
  // 北京时间 00:00 - 13:00 (UTC 16:00 - 05:00) 运行早报逻辑
  else if (currentUTCHour >= 0 && currentUTCHour <= 4) {
    console.log('Running morning news task...');
    const [weather, rawNews] = await Promise.all([
      fetchWeather(),
      fetchGameNews()
    ]);
    const aiProcessedNews = await summarizeNewsWithAI(rawNews);
    const message = formatTelegramMessage(weather, aiProcessedNews);
    await sendTelegramMessage(message);
  } 
  // 北京时间 13:00 - 24:00 (UTC 05:00 - 16:00) 运行 GitHub Trending 逻辑
  else {
    console.log('Running afternoon Github task...');
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
