import schedule from 'node-schedule';
import type { Telegraf } from 'telegraf';
import type { Reminder } from './repository';
import * as repo from './repository';
import { formatReminderMessage, buildReminderButtons } from './formatter';

const jobs = new Map<number, schedule.Job>();

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
      throw new Error(
        `Found expired pending reminder id=${reminder.id} trigger_at=${reminder.trigger_at}. ` +
        `Process may have been down. Please investigate.`
      );
    }
    scheduleReminder(bot, reminder);
  }

  if (reminders.length > 0) {
    console.log(`Scheduled ${reminders.length} pending reminder(s).`);
  }
}
