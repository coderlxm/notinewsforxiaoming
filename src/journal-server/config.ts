import path from 'node:path';
import { z } from 'zod';
import type { JournalServerConfig } from './types.js';

const environmentSchema = z.object({
  TG_TOKEN: z.string().min(1),
  TG_CHAT_ID: z.string().min(1),
  JOURNAL_INGEST_TOKEN: z.string().min(32),
  JOURNAL_ADMIN_PASSWORD: z.string().min(1),
  JOURNAL_COOKIE_SECRET: z.string().min(32),
  JOURNAL_PUBLIC_BASE_URL: z.url(),
  DEEPSEEK_API_KEY: z.string().min(1),
  QWEATHER_API_KEY: z.string().min(1),
  QWEATHER_CITY_ID: z.string().min(1),
  JOURNAL_WEB_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  JOURNAL_WEB_HOST: z.string().min(1).default('0.0.0.0'),
  JOURNAL_DATA_DIR: z.string().min(1).default('/data'),
  JOURNAL_WEB_ROOT: z.string().min(1).default(path.resolve(process.cwd(), 'web/dist')),
});

export function loadJournalServerConfig(environment = process.env): JournalServerConfig {
  const parsed = environmentSchema.parse(environment);
  return {
    telegramToken: parsed.TG_TOKEN,
    allowedChatId: parsed.TG_CHAT_ID,
    ingestToken: parsed.JOURNAL_INGEST_TOKEN,
    adminPassword: parsed.JOURNAL_ADMIN_PASSWORD,
    cookieSecret: parsed.JOURNAL_COOKIE_SECRET,
    publicBaseUrl: parsed.JOURNAL_PUBLIC_BASE_URL.replace(/\/$/, ''),
    deepseekApiKey: parsed.DEEPSEEK_API_KEY,
    qweatherApiKey: parsed.QWEATHER_API_KEY,
    qweatherCityId: parsed.QWEATHER_CITY_ID,
    port: parsed.JOURNAL_WEB_PORT,
    host: parsed.JOURNAL_WEB_HOST,
    dataDir: path.resolve(parsed.JOURNAL_DATA_DIR),
    webRoot: path.resolve(parsed.JOURNAL_WEB_ROOT),
  };
}
