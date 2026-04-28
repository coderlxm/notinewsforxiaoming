import { Telegraf } from 'telegraf';
import { config } from '../config';

export async function sendTelegramMessage(message: string): Promise<void> {
  if (!config.tgToken || !config.tgChatId) {
    console.warn('Telegram Token or Chat ID is not set. Skipping message push.');
    console.log('=== Console Fallback Output ===');
    console.log(message);
    console.log('===============================');
    return;
  }

  const bot = new Telegraf(config.tgToken);
  try {
    await bot.telegram.sendMessage(config.tgChatId, message, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true }
    });
    console.log('Successfully sent message to Telegram.');
  } catch (error) {
    console.error('Failed to send message to Telegram:', error);
  }
}
