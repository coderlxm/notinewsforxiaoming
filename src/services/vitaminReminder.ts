import type { Telegraf } from 'telegraf';
import { getDb } from '../reminders/db';
import { config } from '../config';
import { formatVitaminMessage, buildVitaminButtons } from '../formatters/index';

const MAX_DAILY = 3;

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function canSendVitaminReminder(): boolean {
  const db = getDb();
  const key = todayKey();
  const row = db.prepare('SELECT count FROM vitamin_reminders WHERE date_key = ?').get(key) as { count: number } | undefined;
  return !row || row.count < MAX_DAILY;
}

export function incrementVitaminCount(): void {
  const db = getDb();
  const key = todayKey();
  const row = db.prepare('SELECT count FROM vitamin_reminders WHERE date_key = ?').get(key) as { count: number } | undefined;
  if (!row) {
    db.prepare('INSERT INTO vitamin_reminders (date_key, count) VALUES (?, 1)').run(key);
  } else {
    db.prepare('UPDATE vitamin_reminders SET count = ? WHERE date_key = ?').run(row.count + 1, key);
  }
}

export function getVitaminCountToday(): number {
  const db = getDb();
  const key = todayKey();
  const row = db.prepare('SELECT count FROM vitamin_reminders WHERE date_key = ?').get(key) as { count: number } | undefined;
  return row?.count ?? 0;
}

export async function sendVitaminWithButtons(bot: Telegraf): Promise<void> {
  const message = formatVitaminMessage();
  await bot.telegram.sendMessage(config.tgChatId, message, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...buildVitaminButtons(),
  });
}

export function scheduleVitaminSnooze(bot: Telegraf): void {
  setTimeout(async () => {
    if (!canSendVitaminReminder()) return;
    await sendVitaminWithButtons(bot);
    incrementVitaminCount();
  }, 30 * 60 * 1000);
}
