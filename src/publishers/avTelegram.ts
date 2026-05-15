import type { Telegraf } from 'telegraf';
import axios from 'axios';
import { config } from '../config';
import { sendTelegramMessage } from './telegram';
import { createBot } from '../bot/createBot';

interface SendAvUpdateInput {
  message: string;
  coverUrl: string | null;
}

interface SendAvUpdateWithGalleryInput {
  message: string;
  coverUrl: string | null;
  sampleUrls: string[];
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

export async function sendAvUpdateWithGallery(
  input: SendAvUpdateWithGalleryInput,
  bot?: Telegraf
): Promise<boolean> {
  if (!config.tgToken || !config.tgChatId) {
    throw new Error('Telegram Token or Chat ID is not set.');
  }

  const sender = bot ?? createBot();

  // No cover: text-only fallback
  if (!input.coverUrl) {
    await sendTelegramMessage(input.message, bot);
    return false;
  }

  // No samples: use simple sendPhoto path
  if (input.sampleUrls.length === 0) {
    return sendAvUpdate({ message: input.message, coverUrl: input.coverUrl }, bot);
  }

  // Build media group: cover (with caption) + up to 9 samples
  const sampleLimit = input.sampleUrls.slice(0, 9);
  const media = [
    {
      type: 'photo' as const,
      media: input.coverUrl,
      caption: input.message,
      parse_mode: 'HTML' as const,
    },
    ...sampleLimit.map((url) => ({
      type: 'photo' as const,
      media: url,
    })),
  ];

  try {
    await sender.telegram.sendMediaGroup(config.tgChatId, media);
    return true;
  } catch (error) {
    console.error('sendMediaGroup failed, falling back to cover-only:', error);
    return sendAvUpdate({ message: input.message, coverUrl: input.coverUrl }, bot);
  }
}
