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

const JAVBUS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.javbus.com/'
};

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: JAVBUS_HEADERS,
  });
  return Buffer.from(response.data);
}

export async function sendAvUpdate(input: SendAvUpdateInput, bot?: Telegraf): Promise<boolean> {
  if (!input.coverUrl) {
    await sendTelegramMessage(input.message, bot);
    return false;
  }

  if (!config.tgToken || !config.tgChatId) {
    throw new Error('Telegram Token or Chat ID is not set.');
  }

  const imageBuffer = await fetchImageBuffer(input.coverUrl);
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

  // Build media group: cover (with caption) + up to 9 samples, all as binary upload
  const coverBuffer = await fetchImageBuffer(input.coverUrl);
  const sampleLimit = input.sampleUrls.slice(0, 9);
  const sampleBuffers = await Promise.all(sampleLimit.map((url) => fetchImageBuffer(url)));
  const media = [
    {
      type: 'photo' as const,
      media: { source: coverBuffer, filename: 'cover.jpg' },
      caption: input.message,
      parse_mode: 'HTML' as const,
    },
    ...sampleBuffers.map((buffer, index) => ({
      type: 'photo' as const,
      media: { source: buffer, filename: `sample-${index + 1}.jpg` },
    })),
  ];
  await sender.telegram.sendMediaGroup(config.tgChatId, media);
  return true;
}
