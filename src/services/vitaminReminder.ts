import type { Telegraf } from 'telegraf';
import { getDb } from '../reminders/db';
import { config } from '../config';
import { formatVitaminMessage, buildVitaminButtons } from '../formatters/index';

const LOOP_INTERVAL_MS = 30 * 60 * 1000;
let vitaminLoopTimer: ReturnType<typeof setTimeout> | null = null;

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

interface VitaminState {
  date_key: string;
  eaten: number;
  loop_active: number;
  next_trigger_at: string | null;
}

function ensureVitaminColumns(): void {
  const db = getDb();
  const columns = db.prepare('PRAGMA table_info(vitamin_reminders)').all() as Array<{ name: string }>;
  const hasEaten = columns.some(c => c.name === 'eaten');
  const hasLoopActive = columns.some(c => c.name === 'loop_active');
  const hasNextTriggerAt = columns.some(c => c.name === 'next_trigger_at');

  if (!hasEaten) {
    db.exec('ALTER TABLE vitamin_reminders ADD COLUMN eaten INTEGER NOT NULL DEFAULT 0;');
  }
  if (!hasLoopActive) {
    db.exec('ALTER TABLE vitamin_reminders ADD COLUMN loop_active INTEGER NOT NULL DEFAULT 0;');
  }
  if (!hasNextTriggerAt) {
    db.exec('ALTER TABLE vitamin_reminders ADD COLUMN next_trigger_at TEXT;');
  }
}

function ensureTodayRow(): void {
  ensureVitaminColumns();
  const db = getDb();
  const key = todayKey();
  const row = db.prepare('SELECT date_key FROM vitamin_reminders WHERE date_key = ?').get(key) as { date_key: string } | undefined;
  if (!row) {
    db.prepare('INSERT INTO vitamin_reminders (date_key, count, eaten, loop_active, next_trigger_at) VALUES (?, 0, 0, 0, NULL)').run(key);
  }
}

function getTodayState(): VitaminState {
  ensureTodayRow();
  const db = getDb();
  const key = todayKey();
  return db.prepare(`
    SELECT date_key, eaten, loop_active, next_trigger_at
    FROM vitamin_reminders
    WHERE date_key = ?
  `).get(key) as VitaminState;
}

function setTodayLoop(nextTriggerAt: Date): void {
  ensureTodayRow();
  const db = getDb();
  const key = todayKey();
  db.prepare(`
    UPDATE vitamin_reminders
    SET eaten = 0, loop_active = 1, next_trigger_at = ?
    WHERE date_key = ?
  `).run(nextTriggerAt.toISOString(), key);
}

function stopTodayLoop(): void {
  ensureTodayRow();
  const db = getDb();
  const key = todayKey();
  db.prepare(`
    UPDATE vitamin_reminders
    SET loop_active = 0, next_trigger_at = NULL
    WHERE date_key = ?
  `).run(key);
}

function clearLoopTimer(): void {
  if (!vitaminLoopTimer) return;
  clearTimeout(vitaminLoopTimer);
  vitaminLoopTimer = null;
}

function scheduleLoopAt(bot: Telegraf, nextTriggerAt: Date): void {
  clearLoopTimer();
  const delay = Math.max(nextTriggerAt.getTime() - Date.now(), 0);
  vitaminLoopTimer = setTimeout(() => {
    void runVitaminLoopTick(bot);
  }, delay);
}

export async function sendVitaminWithButtons(bot: Telegraf): Promise<void> {
  const message = formatVitaminMessage();
  await bot.telegram.sendMessage(config.tgChatId, message, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...buildVitaminButtons(),
  });
}

async function runVitaminLoopTick(bot: Telegraf): Promise<void> {
  const state = getTodayState();
  if (state.eaten === 1) {
    stopTodayLoop();
    clearLoopTimer();
    return;
  }

  if (state.loop_active !== 1) {
    clearLoopTimer();
    return;
  }

  await sendVitaminWithButtons(bot);
  const nextTriggerAt = new Date(Date.now() + LOOP_INTERVAL_MS);
  setTodayLoop(nextTriggerAt);
  scheduleLoopAt(bot, nextTriggerAt);
}

export function markVitaminEatenToday(): void {
  ensureTodayRow();
  const db = getDb();
  const key = todayKey();
  db.prepare(`
    UPDATE vitamin_reminders
    SET eaten = 1, loop_active = 0, next_trigger_at = NULL
    WHERE date_key = ?
  `).run(key);
  clearLoopTimer();
}

export function isVitaminEatenToday(): boolean {
  const state = getTodayState();
  return state.eaten === 1;
}

export async function triggerVitaminReminder(bot: Telegraf): Promise<void> {
  if (isVitaminEatenToday()) return;
  await sendVitaminWithButtons(bot);
  const nextTriggerAt = new Date(Date.now() + LOOP_INTERVAL_MS);
  setTodayLoop(nextTriggerAt);
  scheduleLoopAt(bot, nextTriggerAt);
}

export function scheduleVitaminSnooze(bot: Telegraf): void {
  if (isVitaminEatenToday()) return;
  const nextTriggerAt = new Date(Date.now() + LOOP_INTERVAL_MS);
  setTodayLoop(nextTriggerAt);
  scheduleLoopAt(bot, nextTriggerAt);
}

export function restoreVitaminLoop(bot: Telegraf): void {
  clearLoopTimer();
  const state = getTodayState();
  if (state.eaten === 1 || state.loop_active !== 1) return;

  const nextTriggerAt = state.next_trigger_at ? new Date(state.next_trigger_at) : new Date();
  scheduleLoopAt(bot, nextTriggerAt);
}
