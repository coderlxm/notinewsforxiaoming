import { fetchWeather } from './fetchers/weather';
import { fetchGameNews } from './fetchers/games';
import { fetchWeiboHot } from './fetchers/weibo';
import { summarizeNewsWithAI, summarizeWeiboWithAI } from './ai/deepseek';
import { formatTelegramMessage, formatWeiboMessage } from './formatters';
import { sendTelegramMessage } from './publishers/telegram';

async function main() {
  const currentUTCHour = new Date().getUTCHours();
  console.log(`Current UTC Hour: ${currentUTCHour}`);

  // 北京时间 00:00 - 13:00 (UTC 16:00 - 05:00) 运行早报逻辑
  // 简单起见，如果 UTC 小时在 0 到 4 之间（北京时间 8点到 12点），发送早报
  if (currentUTCHour >= 0 && currentUTCHour <= 4) {
    console.log('Running morning news task...');
    const [weather, rawNews] = await Promise.all([
      fetchWeather(),
      fetchGameNews()
    ]);
    const aiProcessedNews = await summarizeNewsWithAI(rawNews);
    const message = formatTelegramMessage(weather, aiProcessedNews);
    await sendTelegramMessage(message);
  } 
  // 北京时间 13:00 - 24:00 (UTC 05:00 - 16:00) 运行微博热搜逻辑
  else {
    console.log('Running afternoon Weibo task...');
    const hotList = await fetchWeiboHot();
    const summary = await summarizeWeiboWithAI(hotList);
    const message = formatWeiboMessage(summary);
    await sendTelegramMessage(message);
  }
  
  console.log('Task finished.');
}

main().catch(error => {
  console.error('Task encountered an error:', error);
  process.exit(1);
});
