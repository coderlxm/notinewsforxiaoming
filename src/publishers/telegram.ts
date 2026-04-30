import { Telegraf } from 'telegraf';
import { config } from '../config';

function isMarkdownParseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const response = (error as { response?: { description?: unknown } }).response;
  if (!response || typeof response.description !== 'string') return false;
  return response.description.includes("can't parse entities");
}

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
    if (isMarkdownParseError(error)) {
      console.warn('Markdown parse failed. Retrying as plain text...');
      try {
        await bot.telegram.sendMessage(config.tgChatId, message, {
          link_preview_options: { is_disabled: true }
        });
        console.log('Successfully sent message to Telegram (plain text fallback).');
        return;
      } catch (fallbackError) {
        console.error('Failed to send message to Telegram (fallback):', fallbackError);
        return;
      }
    }
    console.error('Failed to send message to Telegram:', error);
  }
}
