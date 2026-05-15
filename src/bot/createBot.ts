import https from 'node:https';
import { Telegraf } from 'telegraf';
import { config } from '../config/index';

const telegramAgent = new https.Agent({
  family: 4,
  keepAlive: false
});

export function createBot(): Telegraf {
  if (!config.tgToken) {
    throw new Error('TG_TOKEN is not set.');
  }

  return new Telegraf(config.tgToken, {
    handlerTimeout: Infinity,
    telegram: {
      agent: telegramAgent
    }
  });
}
