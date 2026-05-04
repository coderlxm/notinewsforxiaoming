import https from 'https';
import { Telegraf } from 'telegraf';
import { config } from '../config';

const telegramAgent = new https.Agent({
  family: 4,
  keepAlive: false
});

export async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!config.tgToken || !config.tgChatId) {
    throw new Error('Telegram Token or Chat ID is not set.');
  }

  const bot = new Telegraf(config.tgToken, {
    telegram: {
      agent: telegramAgent
    }
  });

  await bot.telegram.sendMessage(config.tgChatId, message, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true }
  });

  console.log('Successfully sent message to Telegram.');
  return true;
}
