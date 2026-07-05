import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import { Input, type Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import { sendTelegramMessage } from './telegram.js';

interface SendAvUpdateInput {
  message: string;
  coverUrl: string | null;
  sampleUrls: string[];
  mode: 'cover' | 'gallery';
}

const JAVBUS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.javbus.com/'
};

const javbusHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,
});

const javbusHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
});

const javbusImageClient = axios.create({
  timeout: 15000,
  headers: JAVBUS_HEADERS,
  httpAgent: javbusHttpAgent,
  httpsAgent: javbusHttpsAgent,
});

type TelegramInputFile = ReturnType<typeof Input.fromReadableStream>;

async function fetchImageInput(url: string, filename: string): Promise<TelegramInputFile> {
  const response = await javbusImageClient.get<NodeJS.ReadableStream>(url, {
    responseType: 'stream',
  });
  return Input.fromReadableStream(response.data, filename);
}

function normalizeSampleUrls(sampleUrls: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawUrl of sampleUrls) {
    const url = rawUrl.trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    normalized.push(url);
  }

  return normalized;
}

export async function sendAvUpdate(input: SendAvUpdateInput, sender: Telegraf): Promise<boolean> {
  if (!input.coverUrl) {
    await sendTelegramMessage(input.message, sender);
    return false;
  }

  if (!config.tgToken || !config.tgChatId) {
    throw new Error('Telegram Token or Chat ID is not set.');
  }

  const sampleUrls = normalizeSampleUrls(input.sampleUrls).slice(0, 9);
  if (input.mode === 'cover' || sampleUrls.length === 0) {
    const coverInput = await fetchImageInput(input.coverUrl, 'cover.jpg');
    await sender.telegram.sendPhoto(config.tgChatId, coverInput, {
      caption: input.message,
      parse_mode: 'HTML',
    });
    return true;
  }

  const coverInput = await fetchImageInput(input.coverUrl, 'cover.jpg');
  const sampleInputs = await Promise.all(
    sampleUrls.map((url, index) => fetchImageInput(url, `sample-${index + 1}.jpg`))
  );
  const media = [
    {
      type: 'photo' as const,
      media: coverInput,
      caption: input.message,
      parse_mode: 'HTML' as const,
    },
    ...sampleInputs.map((mediaInput) => ({
      type: 'photo' as const,
      media: mediaInput,
    })),
  ];
  await sender.telegram.sendMediaGroup(config.tgChatId, media);
  return true;
}
