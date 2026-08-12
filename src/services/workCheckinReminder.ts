import type { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import {
  buildWorkCheckinButtons,
  formatWorkCheckinFollowUpMessage,
} from '../formatters/index.js';
import { getDb } from '../reminders/db.js';
import { sendTelegramMessage, sendTelegramMessageWithId } from '../publishers/telegram.js';
import { bj, bjDate } from '../utils/time.js';

interface WorkCheckinState {
  completed: number;
}

function findWorkCheckin(dateKey: string): WorkCheckinState | undefined {
  return getDb().prepare(`
    SELECT completed
    FROM work_checkins
    WHERE date_key = ?
  `).get(dateKey) as WorkCheckinState | undefined;
}

export function beginWorkCheckin(dateKey = bjDate()): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO work_checkins (date_key, completed, completed_at)
    VALUES (?, 0, NULL)
  `).run(dateKey);
}

function recordWorkCheckinMessage(dateKey: string, messageId: number): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO work_checkins (date_key, completed, completed_at)
      VALUES (?, 0, NULL)
    `).run(dateKey);
    db.prepare(`
      INSERT OR IGNORE INTO work_checkin_messages (date_key, message_id)
      VALUES (?, ?)
    `).run(dateKey, messageId);
  })();
}

function listWorkCheckinMessageIds(dateKey: string): number[] {
  const rows = getDb().prepare(`
    SELECT message_id
    FROM work_checkin_messages
    WHERE date_key = ?
  `).all(dateKey) as Array<{ message_id: number }>;
  return rows.map(row => row.message_id);
}

async function clearWorkCheckinButtons(bot: Telegraf, dateKey: string): Promise<void> {
  const messageIds = listWorkCheckinMessageIds(dateKey);
  await Promise.all(messageIds.map(messageId =>
    bot.telegram.editMessageReplyMarkup(
      config.tgChatId,
      messageId,
      undefined,
      { inline_keyboard: [] },
    )
  ));
  getDb().prepare('DELETE FROM work_checkin_messages WHERE date_key = ?').run(dateKey);
}

export async function sendMorningNewsWithWorkCheckin(
  message: string,
  bot?: Telegraf,
): Promise<void> {
  const dateKey = bjDate();
  const state = findWorkCheckin(dateKey);
  if (!state || state.completed === 1) {
    await sendTelegramMessage(message, bot);
    return;
  }
  const sentMessageId = await sendTelegramMessageWithId(
    message,
    bot,
    buildWorkCheckinButtons(dateKey).reply_markup,
  );
  recordWorkCheckinMessage(dateKey, sentMessageId);
}

export async function sendWorkCheckinFollowUpIfPending(bot: Telegraf): Promise<void> {
  const dateKey = bjDate();
  const state = findWorkCheckin(dateKey);
  if (!state || state.completed === 1) return;

  const sent = await bot.telegram.sendMessage(
    config.tgChatId,
    formatWorkCheckinFollowUpMessage(),
    {
      parse_mode: 'HTML',
      ...buildWorkCheckinButtons(dateKey),
    },
  );
  recordWorkCheckinMessage(dateKey, sent.message_id);
}

export async function completeWorkCheckin(
  bot: Telegraf,
  dateKey = bjDate(),
): Promise<boolean> {
  const result = getDb().prepare(`
    UPDATE work_checkins
    SET completed = 1, completed_at = ?
    WHERE date_key = ? AND completed = 0
  `).run(new Date().toISOString(), dateKey);
  if (result.changes === 0) return false;

  await clearWorkCheckinButtons(bot, dateKey);
  return true;
}

export async function closeExpiredWorkCheckin(bot: Telegraf): Promise<void> {
  const now = bj();
  if (now.hour() < 10) return;
  await completeWorkCheckin(bot, now.format('YYYY-MM-DD'));
}
