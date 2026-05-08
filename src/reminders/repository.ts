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

export function setSourceMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE reminders SET source_message_id = ? WHERE id = ?');
  stmt.run(messageId, id);
}

export interface RecurringRule {
  id: number;
  chat_id: string;
  text: string;
  timezone: string;
  rrule_text: string;
  next_trigger_at: string;
  status: 'active' | 'paused' | 'cancelled';
  source: 'deterministic' | 'ai';
  source_message_id: number | null;
  created_at: string;
  updated_at: string;
  last_triggered_at: string | null;
}

export interface RecurringRun {
  id: number;
  rule_id: number;
  trigger_at: string;
  sent_message_id: number | null;
  action: 'done' | 'skip' | 'none';
  acted_at: string | null;
  created_at: string;
}

export interface CreateRecurringRuleInput {
  chat_id: string;
  text: string;
  timezone: string;
  rrule_text: string;
  next_trigger_at: Date;
  source: 'deterministic' | 'ai';
  source_message_id?: number;
}

export function createRecurringRule(input: CreateRecurringRuleInput): RecurringRule {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO recurring_reminder_rules
      (chat_id, text, timezone, rrule_text, next_trigger_at, status, source, source_message_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.chat_id, input.text, input.timezone, input.rrule_text,
    input.next_trigger_at.toISOString(), input.source,
    input.source_message_id ?? null, now, now
  );
  return findRecurringRuleById(Number(result.lastInsertRowid))!;
}

export function findRecurringRuleById(id: number): RecurringRule | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM recurring_reminder_rules WHERE id = ?');
  return (stmt.get(id) as RecurringRule) ?? null;
}

export function setRecurringSourceMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE recurring_reminder_rules SET source_message_id = ? WHERE id = ?');
  stmt.run(messageId, id);
}

export function findActiveRecurringRules(): RecurringRule[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recurring_reminder_rules
    WHERE status = 'active'
    ORDER BY next_trigger_at ASC
  `);
  return stmt.all() as RecurringRule[];
}

export function findActiveRecurringByChatId(chatId: string): RecurringRule[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recurring_reminder_rules
    WHERE chat_id = ? AND status = 'active'
    ORDER BY next_trigger_at ASC
  `);
  return stmt.all(chatId) as RecurringRule[];
}

export function updateRecurringNextTrigger(id: number, nextTriggerAt: Date, lastTriggeredAt?: Date): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE recurring_reminder_rules
    SET next_trigger_at = ?, updated_at = ?, last_triggered_at = COALESCE(?, last_triggered_at)
    WHERE id = ?
  `);
  stmt.run(nextTriggerAt.toISOString(), now, lastTriggeredAt ? lastTriggeredAt.toISOString() : null, id);
}

export function updateRecurringStatus(id: number, status: 'active' | 'paused' | 'cancelled'): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE recurring_reminder_rules SET status = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(status, now, id);
}

export function createRecurringRun(input: { rule_id: number; trigger_at: Date; sent_message_id?: number }): RecurringRun {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO recurring_reminder_runs (rule_id, trigger_at, sent_message_id, action, created_at)
    VALUES (?, ?, ?, 'none', ?)
  `);
  const result = stmt.run(
    input.rule_id, input.trigger_at.toISOString(),
    input.sent_message_id ?? null, now
  );
  return findRecurringRunById(Number(result.lastInsertRowid))!;
}

export function findRecurringRunById(id: number): RecurringRun | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM recurring_reminder_runs WHERE id = ?');
  return (stmt.get(id) as RecurringRun) ?? null;
}

export function updateRecurringRunAction(id: number, action: 'done' | 'skip'): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE recurring_reminder_runs SET action = ?, acted_at = ? WHERE id = ?
  `);
  stmt.run(action, now, id);
}

export function setRecurringRunSentMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE recurring_reminder_runs SET sent_message_id = ? WHERE id = ?');
  stmt.run(messageId, id);
}
