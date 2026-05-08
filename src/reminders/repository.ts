import { getDb } from './db';

export interface Reminder {
  id: number;
  chat_id: string;
  text: string;
  trigger_at: string;
  status: 'pending' | 'done' | 'cancelled';
  created_at: string;
  done_at: string | null;
  cancelled_at: string | null;
  source_message_id: number | null;
  sent_message_id: number | null;
}

export interface CreateReminderInput {
  chat_id: string;
  text: string;
  trigger_at: Date;
  source_message_id?: number;
}

export function createReminder(input: CreateReminderInput): Reminder {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO reminders (chat_id, text, trigger_at, status, created_at, source_message_id)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `);
  const result = stmt.run(
    input.chat_id,
    input.text,
    input.trigger_at.toISOString(),
    now,
    input.source_message_id ?? null
  );
  return findReminderById(Number(result.lastInsertRowid))!;
}

export function findPendingReminders(): Reminder[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE status = 'pending'
    ORDER BY trigger_at ASC
  `);
  return stmt.all() as Reminder[];
}

export function findPendingByChatId(chatId: string): Reminder[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE chat_id = ? AND status = 'pending'
    ORDER BY trigger_at ASC
  `);
  return stmt.all(chatId) as Reminder[];
}

export function findReminderById(id: number): Reminder | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
  return (stmt.get(id) as Reminder) ?? null;
}

export function markReminderDone(id: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE reminders SET status = 'done', done_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  stmt.run(now, id);
}

export function cancelReminder(id: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE reminders SET status = 'cancelled', cancelled_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  stmt.run(now, id);
}

export function updateReminderTriggerAt(id: number, triggerAt: Date): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE reminders SET trigger_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  stmt.run(triggerAt.toISOString(), id);
}

export function setSentMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE reminders SET sent_message_id = ? WHERE id = ?');
  stmt.run(messageId, id);
}
