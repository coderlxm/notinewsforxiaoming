import https from 'https';
import { Telegraf } from 'telegraf';
import { config } from '../config/index.js';

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

const telegramAgent = new https.Agent({
  family: 4,
  keepAlive: false
});

export async function sendTelegramMessage(message: string, bot?: Telegraf): Promise<boolean> {
  await sendTelegramMessageWithId(message, bot);
  return true;
}

export async function sendTelegramMessageWithId(
  message: string,
  bot?: Telegraf,
  replyMarkup?: TelegramInlineKeyboardMarkup,
): Promise<number> {
  if (!config.tgToken || !config.tgChatId) {
    throw new Error('Telegram Token or Chat ID is not set.');
  }

  const sent = bot
    ? await bot.telegram.sendMessage(config.tgChatId, message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
    : await new Telegraf(config.tgToken, {
      telegram: { agent: telegramAgent }
    }).telegram.sendMessage(config.tgChatId, message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });

  console.log('Successfully sent message to Telegram.');
  return sent.message_id;
}
