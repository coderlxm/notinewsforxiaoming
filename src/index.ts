import { fetchWeather } from './fetchers/weather';
import { fetchGameNews } from './fetchers/games';
import { summarizeNewsWithAI } from './ai/deepseek';
import { formatTelegramMessage } from './formatters';
import { sendTelegramMessage } from './publishers/telegram';

async function main() {
  console.log('Starting daily task...');
  
  const [weather, rawNews] = await Promise.all([
    fetchWeather(),
    fetchGameNews()
  ]);

  const aiProcessedNews = await summarizeNewsWithAI(rawNews);

  const message = formatTelegramMessage(weather, aiProcessedNews);
  await sendTelegramMessage(message);
  
  console.log('Task finished.');
}

main().catch(error => {
  console.error('Task encountered an error:', error);
  process.exit(1);
});
