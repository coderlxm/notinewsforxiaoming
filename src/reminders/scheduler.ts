import schedule from 'node-schedule';
import type { Telegraf } from 'telegraf';
import type { Reminder, RecurringRule } from './repository';
import * as repo from './repository';
import { formatReminderMessage, buildReminderButtons, formatRecurringReminderMessage, buildRecurringReminderButtons } from './formatter';
import { getNextTrigger } from './recurring';

const jobs = new Map<number, schedule.Job>();
const recurJobs = new Map<number, schedule.Job>();

export function scheduleReminder(bot: Telegraf, reminder: Reminder): void {
  const triggerAt = new Date(reminder.trigger_at);

  const job = schedule.scheduleJob(triggerAt, async () => {
    const current = repo.findReminderById(reminder.id);
    if (!current || current.status !== 'pending') return;

    try {
      const msg = await bot.telegram.sendMessage(
        reminder.chat_id,
        formatReminderMessage(current),
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...buildReminderButtons(current.id)
        }
      );
      repo.setSentMessageId(current.id, msg.message_id);
    } catch (err) {
      console.error(`Failed to send reminder id=${reminder.id}:`, err);
      throw err;
    }
  });

  jobs.set(reminder.id, job);
}

export function cancelScheduledReminder(id: number): void {
  const job = jobs.get(id);
  if (job) {
    job.cancel();
    jobs.delete(id);
  }
}

export function schedulePendingReminders(bot: Telegraf): void {
  const reminders = repo.findPendingReminders();
  const now = new Date();

  for (const reminder of reminders) {
    const triggerAt = new Date(reminder.trigger_at);
    if (triggerAt <= now) {
      console.warn(
        `Expired pending reminder id=${reminder.id} trigger_at=${reminder.trigger_at}. Cancelling.`
      );
      repo.cancelReminder(reminder.id);
      continue;
    }
    scheduleReminder(bot, reminder);
  }

  if (reminders.length > 0) {
    console.log(`Scheduled ${reminders.length} pending reminder(s).`);
  }
}

function scheduleRecurringRule(bot: Telegraf, rule: RecurringRule): void {
  const triggerAt = new Date(rule.next_trigger_at);

  const job = schedule.scheduleJob(triggerAt, async () => {
    const current = repo.findRecurringRuleById(rule.id);
    if (!current || current.status !== 'active') return;

    try {
      const run = repo.createRecurringRun({
        rule_id: rule.id,
        trigger_at: new Date(current.next_trigger_at),
      });

      const msg = await bot.telegram.sendMessage(
        rule.chat_id,
        formatRecurringReminderMessage(current),
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...buildRecurringReminderButtons(current.id, run.id),
        }
      );
      repo.setRecurringRunSentMessageId(run.id, msg.message_id);

      const currentTriggerAt = new Date(current.next_trigger_at);
      const nextTrigger = getNextTrigger(current.rrule_text, current.timezone, currentTriggerAt, false);
      repo.updateRecurringNextTrigger(rule.id, nextTrigger, currentTriggerAt);
      scheduleRecurringRule(bot, { ...current, next_trigger_at: nextTrigger.toISOString() });
    } catch (err) {
      console.error(`Failed to send recurring reminder rule_id=${rule.id}:`, err);
      throw err;
    }
  });

  recurJobs.set(rule.id, job);
}

export function cancelRecurringJob(id: number): void {
  const job = recurJobs.get(id);
  if (job) {
    job.cancel();
    recurJobs.delete(id);
  }
}

export function schedulePendingRecurringRules(bot: Telegraf): void {
  const rules = repo.findActiveRecurringRules();

  for (const rule of rules) {
    try {
      scheduleRecurringRule(bot, rule);
    } catch (err) {
      console.error(`Failed to schedule recurring rule id=${rule.id}:`, err);
      throw err;
    }
  }

  if (rules.length > 0) {
    console.log(`Scheduled ${rules.length} recurring rule(s).`);
  }
}

export { scheduleRecurringRule };
