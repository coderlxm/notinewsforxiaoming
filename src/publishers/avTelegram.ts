import type { Telegraf } from 'telegraf';
import { config } from '../config';
import { sendTelegramMessage } from './telegram';
import { createBot } from '../bot/createBot';

interface SendAvUpdateInput {
  message: string;
  coverUrl: string | null;
}

export async function sendAvUpdate(input: SendAvUpdateInput, bot?: Telegraf): Promise<boolean> {
  if (!input.coverUrl) {
    await sendTelegramMessage(input.message, bot);
    return false;
  }

  if (!config.tgToken || !config.tgChatId) {
    throw new Error('Telegram Token or Chat ID is not set.');
  }

  try {
    const sender = bot ?? createBot();
    await sender.telegram.sendPhoto(config.tgChatId, input.coverUrl, {
      caption: input.message,
      parse_mode: 'HTML',
    });
    return true;
  } catch (error) {
    console.error('Failed to send AV cover, fallback to text:', error);
    await sendTelegramMessage(input.message, bot);
    return false;
  }
}
