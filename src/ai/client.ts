import OpenAI from 'openai';
import { config } from '../config';

let client: OpenAI | null = null;

export function getDeepSeekClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: config.deepseekApiKey,
    });
  }
  return client;
}

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';
