import type { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import {
  buildBusReminderButtons,
  formatBusReminderMessage,
} from '../formatters/index.js';
import { getDb } from '../reminders/db.js';
import { bjDate } from '../utils/time.js';

const REPEAT_INTERVAL_MS = 2 * 60 * 1000;
const MAX_REMIND_TIMES = 3;
let busLoopTimer: ReturnType<typeof setTimeout> | null = null;

interface BusReminderState {
  date_key: string;
  completed: number;
  count: number;
  loop_active: number;
  next_trigger_at: string | null;
}

function ensureTodayRow(): void {
  const db = getDb();
  const key = bjDate();
  const row = db.prepare('SELECT date_key FROM bus_reminders WHERE date_key = ?').get(key) as { date_key: string } | undefined;
  if (!row) {
    db.prepare(`
      INSERT INTO bus_reminders (date_key, completed, count, loop_active, next_trigger_at)
      VALUES (?, 0, 0, 0, NULL)
    `).run(key);
  }
}

function getTodayState(): BusReminderState {
  ensureTodayRow();
  const db = getDb();
  const key = bjDate();
  return db.prepare(`
    SELECT date_key, completed, count, loop_active, next_trigger_at
    FROM bus_reminders
    WHERE date_key = ?
  `).get(key) as BusReminderState;
}

function setTodayState(count: number, nextTriggerAt: Date): void {
  ensureTodayRow();
  const db = getDb();
  const key = bjDate();
  db.prepare(`
    UPDATE bus_reminders
    SET count = ?, loop_active = 1, next_trigger_at = ?
    WHERE date_key = ?
  `).run(count, nextTriggerAt.toISOString(), key);
}

function clearLoopTimer(): void {
  if (!busLoopTimer) return;
  clearTimeout(busLoopTimer);
  busLoopTimer = null;
}

function scheduleLoopAt(bot: Telegraf, nextTriggerAt: Date): void {
  clearLoopTimer();
  const delay = Math.max(nextTriggerAt.getTime() - Date.now(), 0);
  busLoopTimer = setTimeout(() => {
    void runBusLoopTick(bot);
  }, delay);
}

function listBusReminderMessageIds(dateKey: string): number[] {
  const rows = getDb().prepare(`
    SELECT message_id
    FROM bus_reminder_messages
    WHERE date_key = ?
  `).all(dateKey) as Array<{ message_id: number }>;
  return rows.map(row => row.message_id);
}

async function clearBusReminderButtons(bot: Telegraf, dateKey: string): Promise<void> {
  const messageIds = listBusReminderMessageIds(dateKey);
  await Promise.all(messageIds.map(messageId =>
    bot.telegram.editMessageReplyMarkup(
      config.tgChatId,
      messageId,
      undefined,
      { inline_keyboard: [] },
    )
  ));
  getDb().prepare('DELETE FROM bus_reminder_messages WHERE date_key = ?').run(dateKey);
}

async function sendBusReminderWithButton(bot: Telegraf): Promise<void> {
  const sent = await bot.telegram.sendMessage(
    config.tgChatId,
    formatBusReminderMessage(),
    {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...buildBusReminderButtons(bjDate()),
    },
  );
  getDb().prepare(`
    INSERT OR IGNORE INTO bus_reminder_messages (date_key, message_id)
    VALUES (?, ?)
  `).run(bjDate(), sent.message_id);
}

async function runBusLoopTick(bot: Telegraf): Promise<void> {
  const state = getTodayState();
  if (state.completed === 1 || state.loop_active !== 1) {
    clearLoopTimer();
    return;
  }
  if (state.count >= MAX_REMIND_TIMES) {
    await completeBusReminder(bot, state.date_key);
    return;
  }
  await sendBusReminderWithButton(bot);
  const nextTriggerAt = new Date(Date.now() + REPEAT_INTERVAL_MS);
  setTodayState(state.count + 1, nextTriggerAt);
  scheduleLoopAt(bot, nextTriggerAt);
}

export async function triggerBusReminder(bot: Telegraf): Promise<void> {
  const state = getTodayState();
  if (state.completed === 1 || state.count >= MAX_REMIND_TIMES) return;

  await sendBusReminderWithButton(bot);
  const nextTriggerAt = new Date(Date.now() + REPEAT_INTERVAL_MS);
  setTodayState(1, nextTriggerAt);
  scheduleLoopAt(bot, nextTriggerAt);
}

export async function completeBusReminder(
  bot: Telegraf,
  dateKey = bjDate(),
): Promise<boolean> {
  const result = getDb().prepare(`
    UPDATE bus_reminders
    SET completed = 1, loop_active = 0, next_trigger_at = NULL
    WHERE date_key = ? AND completed = 0
  `).run(dateKey);
  if (result.changes === 0) return false;

  clearLoopTimer();
  await clearBusReminderButtons(bot, dateKey);
  return true;
}

export function restoreBusReminderLoop(bot: Telegraf): void {
  clearLoopTimer();
  const state = getTodayState();
  if (state.completed === 1 || state.loop_active !== 1) return;

  const nextTriggerAt = state.next_trigger_at ? new Date(state.next_trigger_at) : new Date();
  scheduleLoopAt(bot, nextTriggerAt);
}