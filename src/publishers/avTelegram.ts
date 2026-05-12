import type { Telegraf } from 'telegraf';
import axios from 'axios';
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

  const imageResponse = await axios.get<ArrayBuffer>(input.coverUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.javbus.com/'
    }
  });

  const imageBuffer = Buffer.from(imageResponse.data);
  const sender = bot ?? createBot();
  await sender.telegram.sendPhoto(
    config.tgChatId,
    { source: imageBuffer, filename: 'cover.jpg' },
    {
      caption: input.message,
      parse_mode: 'HTML',
    }
  );
  return true;
}
