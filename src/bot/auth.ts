import type { Context } from 'telegraf';
import { config } from '../config/index';

export function isAuthorized(ctx: Context): boolean {
  return String(ctx.chat?.id) === config.tgChatId;
}
