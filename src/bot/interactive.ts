import type { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { isAuthorized } from './auth';
import { parseReminderCommand, parseNaturalReminder, parseRecurringCommand } from '../reminders/parser';
import * as repo from '../reminders/repository';
import { scheduleReminder, cancelScheduledReminder, scheduleRecurringRule, cancelRecurringJob } from '../reminders/scheduler';
import { buildRRuleText, getNextTrigger, describeRecurrence } from '../reminders/recurring';
import {
  formatStartMessage,
  formatHelpMessage,
  formatReminderCreated,
  formatEmptyReminderList,
  formatReminderList,
  formatReminderDone,
  formatReminderSnoozed,
  formatReminderCancelled,
  buildCancelButton,
  buildReminderListButtons,
  formatRecurringCreated,
  formatRecurringCancelled,
  formatRecurringPaused,
  formatRecurringRunDone,
  formatRecurringRunSkipped,
  buildRecurringRuleButtons,
} from '../reminders/formatter';
import { parseCallbackData, parseRecurringCallbackData } from './callbacks';

export function registerInteractiveHandlers(bot: Telegraf): void {
  bot.command('start', (ctx) => {
    if (!isAuthorized(ctx)) return;
    ctx.reply(formatStartMessage(), { parse_mode: 'HTML' });
  });

  bot.command('help', (ctx) => {
    if (!isAuthorized(ctx)) return;
    ctx.reply(formatHelpMessage(), { parse_mode: 'HTML' });
  });

  bot.command('remind', async (ctx) => {
    if (!isAuthorized(ctx)) return;

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = text.replace(/^\/remind\s*/, '').trim();

    if (!args) {
      const reminders = repo.findPendingByChatId(String(ctx.chat!.id));
      if (reminders.length === 0) {
        await ctx.reply(formatEmptyReminderList(), { parse_mode: 'HTML' });
        return;
      }
      await ctx.reply(
        formatReminderList(reminders),
        { parse_mode: 'HTML', ...buildReminderListButtons(reminders) }
      );
      return;
    }

    const now = new Date();

    try {
      const recurringResult = parseRecurringCommand(args, now);
      if (recurringResult && !('error' in recurringResult)) {
        const rruleText = buildRRuleText(recurringResult.spec);
        const nextTrigger = getNextTrigger(rruleText, now, true);
        const rule = repo.createRecurringRule({
          chat_id: String(ctx.chat!.id),
          text: recurringResult.text,
          timezone: recurringResult.spec.timezone,
          rrule_text: rruleText,
          next_trigger_at: nextTrigger,
          source: recurringResult.source,
        });
        scheduleRecurringRule(bot, rule);
        const description = describeRecurrence(recurringResult.spec);
        const createdMessage = await ctx.reply(
          formatRecurringCreated(rule, description),
          { parse_mode: 'HTML', ...buildRecurringRuleButtons(rule.id) }
        );
        repo.setRecurringSourceMessageId(rule.id, createdMessage.message_id);
        return;
      }
      if (recurringResult && 'error' in recurringResult) {
        await ctx.reply(recurringResult.error, { parse_mode: 'HTML' });
        return;
      }
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(e.message, { parse_mode: 'HTML' });
        return;
      }
      throw e;
    }

    const result = parseReminderCommand(text, now);

    if ('error' in result) {
      await ctx.reply(result.error, { parse_mode: 'HTML' });
      return;
    }

    const reminder = repo.createReminder({
      chat_id: String(ctx.chat!.id),
      text: result.text,
      trigger_at: result.triggerAt
    });

    scheduleReminder(bot, reminder);

    const createdMessage = await ctx.reply(
      formatReminderCreated(reminder, result.source),
      { parse_mode: 'HTML', ...buildCancelButton(reminder.id) }
    );
    repo.setSourceMessageId(reminder.id, createdMessage.message_id);
  });

  bot.on(message('text'), async (ctx) => {
    if (!isAuthorized(ctx)) return;

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    if (!text || text.startsWith('/')) return;

    const receivedAt = new Date();
    const result = await parseNaturalReminder(text, receivedAt);

    if ('error' in result) {
      ctx.reply(result.error, { parse_mode: 'HTML' });
      return;
    }

    if ('spec' in result) {
      const rruleText = buildRRuleText(result.spec);
      const nextTrigger = getNextTrigger(rruleText, receivedAt, true);
      const rule = repo.createRecurringRule({
        chat_id: String(ctx.chat!.id),
        text: result.text,
        timezone: result.spec.timezone,
        rrule_text: rruleText,
        next_trigger_at: nextTrigger,
        source: result.source,
      });
      scheduleRecurringRule(bot, rule);
      const description = describeRecurrence(result.spec);
      const createdMessage = await ctx.reply(
        formatRecurringCreated(rule, description),
        { parse_mode: 'HTML', ...buildRecurringRuleButtons(rule.id) }
      );
      repo.setRecurringSourceMessageId(rule.id, createdMessage.message_id);
      return;
    }

    const reminder = repo.createReminder({
      chat_id: String(ctx.chat!.id),
      text: result.text,
      trigger_at: result.triggerAt
    });

    scheduleReminder(bot, reminder);

    const createdMessage = await ctx.reply(
      formatReminderCreated(reminder, result.source),
      { parse_mode: 'HTML', ...buildCancelButton(reminder.id) }
    );
    repo.setSourceMessageId(reminder.id, createdMessage.message_id);
  });

  async function clearSourceButtons(reminder: repo.Reminder): Promise<void> {
    if (!reminder.source_message_id) return;
    await bot.telegram.editMessageReplyMarkup(
      reminder.chat_id,
      reminder.source_message_id,
      undefined,
      { inline_keyboard: [] }
    );
  }

  async function clearRecurringSourceButtons(rule: repo.RecurringRule): Promise<void> {
    if (!rule.source_message_id) return;
    await bot.telegram.editMessageReplyMarkup(
      rule.chat_id,
      rule.source_message_id,
      undefined,
      { inline_keyboard: [] }
    );
  }

  bot.on('callback_query', async (ctx) => {
    if (!isAuthorized(ctx)) return;

    const cbData = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

    const recurringData = parseRecurringCallbackData(cbData);
    if (recurringData) {
      await ctx.answerCbQuery();

      const rule = repo.findRecurringRuleById(recurringData.ruleId);
      if (!rule) return;

      switch (recurringData.type) {
        case 'pause': {
          repo.updateRecurringStatus(recurringData.ruleId, 'paused');
          cancelRecurringJob(recurringData.ruleId);
          await clearRecurringSourceButtons(rule);
          try {
            await ctx.editMessageText(formatRecurringPaused(rule), { parse_mode: 'HTML' });
          } catch {
            await ctx.reply(formatRecurringPaused(rule), { parse_mode: 'HTML' });
          }
          break;
        }
        case 'cancel': {
          repo.updateRecurringStatus(recurringData.ruleId, 'cancelled');
          cancelRecurringJob(recurringData.ruleId);
          await clearRecurringSourceButtons(rule);
          try {
            await ctx.editMessageText(formatRecurringCancelled(rule), { parse_mode: 'HTML' });
          } catch {
            await ctx.reply(formatRecurringCancelled(rule), { parse_mode: 'HTML' });
          }
          break;
        }
        case 'done': {
          if (recurringData.runId) {
            repo.updateRecurringRunAction(recurringData.runId, 'done');
          }
          try {
            await ctx.editMessageText(formatRecurringRunDone(), { parse_mode: 'HTML' });
          } catch {
            await ctx.reply(formatRecurringRunDone(), { parse_mode: 'HTML' });
          }
          break;
        }
        case 'skip': {
          if (recurringData.runId) {
            repo.updateRecurringRunAction(recurringData.runId, 'skip');
          }
          try {
            await ctx.editMessageText(formatRecurringRunSkipped(), { parse_mode: 'HTML' });
          } catch {
            await ctx.reply(formatRecurringRunSkipped(), { parse_mode: 'HTML' });
          }
          break;
        }
      }
      return;
    }

    const data = parseCallbackData(cbData);
    if (!data) return;

    await ctx.answerCbQuery();

    const reminder = repo.findReminderById(data.id);
    if (!reminder) return;

    switch (data.type) {
      case 'cancel': {
        repo.cancelReminder(data.id);
        cancelScheduledReminder(data.id);
        await clearSourceButtons(reminder);
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
        await clearSourceButtons(reminder);
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

        await clearSourceButtons(reminder);

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
