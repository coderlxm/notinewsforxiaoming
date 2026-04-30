import { Telegraf } from 'telegraf';
import { config } from '../config';

function isEntityParseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const response = (error as { response?: { description?: unknown } }).response;
  if (!response || typeof response.description !== 'string') return false;
  return response.description.includes("can't parse entities");
}

function toPlainText(message: string): string {
  return message
    .replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|strong|i|em|code|u|s)>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
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
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
    console.log('Successfully sent message to Telegram.');
  } catch (error) {
    if (isEntityParseError(error)) {
      console.warn('Parse failed. Retrying as plain text...');
      try {
        await bot.telegram.sendMessage(config.tgChatId, toPlainText(message), {
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
