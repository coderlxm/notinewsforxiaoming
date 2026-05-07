import type { Telegraf } from 'telegraf';
import { isAuthorized } from './auth';
import { parseReminderCommand, parseNaturalReminder } from '../reminders/parser';
import * as repo from '../reminders/repository';
import { scheduleReminder, cancelScheduledReminder } from '../reminders/scheduler';
import {
  formatStartMessage,
  formatHelpMessage,
  formatReminderCreated,
  formatReminderDone,
  formatReminderSnoozed,
  formatReminderCancelled,
  buildCancelButton,
} from '../reminders/formatter';
import { parseCallbackData } from './callbacks';

export function registerInteractiveHandlers(bot: Telegraf): void {
  bot.command('start', (ctx) => {
    if (!isAuthorized(ctx)) return;
    ctx.reply(formatStartMessage(), { parse_mode: 'HTML' });
  });

  bot.command('help', (ctx) => {
    if (!isAuthorized(ctx)) return;
    ctx.reply(formatHelpMessage(), { parse_mode: 'HTML' });
  });

  bot.command('remind', (ctx) => {
    if (!isAuthorized(ctx)) return;

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const result = parseReminderCommand(text, new Date());

    if ('error' in result) {
      ctx.reply(result.error, { parse_mode: 'HTML' });
      return;
    }

    const reminder = repo.createReminder({
      chat_id: String(ctx.chat!.id),
      text: result.text,
      trigger_at: result.triggerAt,
      source_message_id: ctx.message?.message_id
    });

    scheduleReminder(bot, reminder);

    ctx.reply(
      formatReminderCreated(reminder),
      { parse_mode: 'HTML', ...buildCancelButton(reminder.id) }
    );
  });

  bot.on('text', async (ctx) => {
    if (!isAuthorized(ctx)) return;

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    if (!text || text.startsWith('/')) return;

    const result = await parseNaturalReminder(text, new Date());

    if ('error' in result) {
      ctx.reply(result.error, { parse_mode: 'HTML' });
      return;
    }

    const reminder = repo.createReminder({
      chat_id: String(ctx.chat!.id),
      text: result.text,
      trigger_at: result.triggerAt,
      source_message_id: ctx.message?.message_id
    });

    scheduleReminder(bot, reminder);

    ctx.reply(
      formatReminderCreated(reminder),
      { parse_mode: 'HTML', ...buildCancelButton(reminder.id) }
    );
  });

  bot.on('callback_query', async (ctx) => {
    if (!isAuthorized(ctx)) return;

    const data = parseCallbackData(
      ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined
    );
    if (!data) return;

    await ctx.answerCbQuery();

    const reminder = repo.findReminderById(data.id);
    if (!reminder) return;

    switch (data.type) {
      case 'cancel': {
        repo.cancelReminder(data.id);
        cancelScheduledReminder(data.id);
        try {
          await ctx.editMessageText(formatReminderCancelled(reminder), { parse_mode: 'HTML' });
        } catch {
          await ctx.reply(formatReminderCancelled(reminder), { parse_mode: 'HTML' });
        }
        break;
      }
      case 'done': {
        repo.markReminderDone(data.id);
        cancelScheduledReminder(data.id);
        try {
          await ctx.editMessageText(formatReminderDone(reminder), { parse_mode: 'HTML' });
        } catch {
          await ctx.reply(formatReminderDone(reminder), { parse_mode: 'HTML' });
        }
        break;
      }
      case 'snooze5': {
        const newTriggerAt = new Date(Date.now() + 5 * 60 * 1000);
        repo.updateReminderTriggerAt(data.id, newTriggerAt);
        cancelScheduledReminder(data.id);

        const updated = repo.findReminderById(data.id);
        if (updated) {
          scheduleReminder(bot, updated);
        }

        const replyText = updated
          ? formatReminderSnoozed(updated)
          : '提醒已推迟 5 分钟。';
        try {
          await ctx.editMessageText(replyText, { parse_mode: 'HTML' });
        } catch {
          await ctx.reply(replyText, { parse_mode: 'HTML' });
        }
        break;
      }
    }
  });
}
