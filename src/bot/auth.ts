import type { Context } from 'telegraf';
import { config } from '../config/index.js';

export function isAuthorized(ctx: Context): boolean {
  return String(ctx.chat?.id) === config.tgChatId;
}
