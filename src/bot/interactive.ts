import type { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { isAuthorized } from './auth.js';
import {
  parseReminderCommand,
  parseNaturalReminder,
  parseRecurringCommand,
  type ParsedListReminders,
  type ParsedCancelReminder,
} from '../reminders/parser.js';
import * as repo from '../reminders/repository.js';
import { scheduleReminder, cancelScheduledReminder, scheduleRecurringRule, cancelRecurringJob } from '../reminders/scheduler.js';
import { buildRRuleText, getNextTrigger, describeRecurrence, getOccurrencesInRange } from '../reminders/recurring.js';
import {
  formatStartMessage,
  formatHelpMessage,
  formatReminderCreated,
  formatEmptyReminderList,
  formatReminderList,
  formatReminderSnoozed,
  formatReminderCancelled,
  buildCancelButton,
  buildReminderListButtons,
  formatRecurringCreated,
  formatRecurringCancelled,
  formatRecurringPaused,
  formatRecurringRunSkipped,
  buildRecurringRuleButtons,
  formatReminderRangeList,
  formatCancelCandidates,
  buildCancelCandidateButtons,
  buildPresetKeyboard,
  type ReminderListItem,
  type CancelCandidate,
} from '../reminders/formatter.js';
import {
  parseCallbackData,
  parseRecurringCallbackData,
  parseNaturalCancelCallbackData,
  parseVitaminCallbackData,
  parseStartggWatchCallbackData,
} from './callbacks.js';
import { runAvFetchOnce } from '../services/avTracker.js';
import { markVitaminEatenToday, scheduleVitaminSnooze, getAndClearVitaminSentMessages } from '../services/vitaminReminder.js';
import { findPresetByText } from '../reminders/presets.js';
import {
  buildStartggWatchCandidateButtons,
  formatStartggGoTournamentCandidates,
  formatStartggGuide,
  formatStartggRuntimeStatus,
  formatStartggWatchCandidates,
  formatStartggWatchList,
} from '../formatters/startggFormatter.js';
import {
  fetchEventMeta,
  listEventEntrantPlayers,
  resolveUserToPlayer,
} from '../services/startgg/index.js';
import {
  createStartggWatchPlayer,
  findStartggWatchEventById,
  findStartggWatchPlayerByPlayerId,
  listStartggWatchEvents,
  listStartggWatchPlayers,
  listStartggWatchStatusViews,
  replaceActiveStartggWatchEvent,
  updateStartggWatchPlayerName,
} from '../services/startggRepository.js';
import { runStartggGo, runStartggWatchNow, syncStartggPresetPlayers } from '../services/startggPresetSync.js';
import { escapeHtml } from '../utils/html.js';
import {
  disableStartggPolling,
  enableStartggPolling,
  getStartggPollingRuntimeStatus,
  isStartggPollingEnabled,
  updateStartggFastWatch,
} from '../scheduled/jobs.js';

interface StartggWatchCandidate {
  eventRowId: number;
  eventName: string;
  playerId: number;
  playerName: string;
}

function isStartggUrl(raw: string): boolean {
  return raw.startsWith('http://') || raw.startsWith('https://');
}

function isStartggUserReference(raw: string): boolean {
  if (!isStartggUrl(raw)) {
    return raw.startsWith('user/');
  }
  const url = new URL(raw);
  const parts = url.pathname.split('/').filter(Boolean);
  return parts.includes('user');
}

function isStartggEventReference(raw: string): boolean {
  if (!isStartggUrl(raw)) {
    return raw.startsWith('tournament/');
  }
  const url = new URL(raw);
  const parts = url.pathname.split('/').filter(Boolean);
  return parts.includes('tournament') && parts.includes('event');
}

export function registerInteractiveHandlers(bot: Telegraf): void {
  bot.command('start', (ctx) => {
    if (!isAuthorized(ctx)) return;
    ctx.reply(formatStartMessage(), {
      parse_mode: 'HTML',
      ...buildPresetKeyboard(),
    });
  });

  bot.command('help', (ctx) => {
    if (!isAuthorized(ctx)) return;
    ctx.reply(formatHelpMessage(), { parse_mode: 'HTML' });
  });

  bot.command('fetchav', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const forceResend = /\b(force|all)\b/i.test(text);
    await ctx.reply(
      forceResend ? '开始手动检查 AV 更新（强制重发模式）...' : '开始手动检查 AV 更新...',
      { parse_mode: 'HTML' }
    );

    try {
      const summary = await runAvFetchOnce(bot, { forceResend, healthNotify: false });
      await ctx.reply(
        `检查完成：新增 ${summary.pushed} 条，已跳过 ${summary.skipped} 条。`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`AV 检查失败：${e.message}`, { parse_mode: 'HTML' });
        return;
      }
      throw e;
    }
  });

  bot.command('fetchstartgg', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    await ctx.reply('开始手动检查 start.gg 选手状态...', { parse_mode: 'HTML' });
    try {
      const summary = await runStartggWatchNow(bot);
      updateStartggFastWatch(bot, summary.pendingSetCount);
      await ctx.reply(
        `检查完成：本次检查项目 ${summary.checkedEvents} 个，选手 ${summary.checkedPlayers} 个，状态变化 ${summary.changed} 条，进行中 ${summary.pendingSetCount} 条。`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`start.gg 检查失败：${e.message}`, { parse_mode: 'HTML' });
        return;
      }
      throw e;
    }
  });

  bot.command('startgg', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const arg = text.replace(/^\/startgg\s*/, '').trim().toLowerCase();
    try {
      if (arg === 'go' || arg.startsWith('go ')) {
        const keyword = text.replace(/^\/startgg\s*/i, '').trim().replace(/^go\b/i, '').trim();
        if (keyword) {
          await ctx.reply('开始 start.gg go：同步固定选手、按赛事关键词自动发现项目并启动监控...', { parse_mode: 'HTML' });
        }
        const summary = await runStartggGo(bot, keyword);
        if (summary.status === 'candidates') {
          await ctx.reply(formatStartggGoTournamentCandidates(summary), { parse_mode: 'HTML' });
          return;
        }
        updateStartggFastWatch(bot, summary.pendingSetCount);
        const enabled = enableStartggPolling(bot);
        await ctx.reply(
          [
            'start.gg go 已启动',
            `固定选手：${summary.syncedPlayers} 位`,
            `赛事：${summary.tournamentName}`,
            `自动订阅项目：${summary.discoveredEvents} 个`,
            `立即检查：项目 ${summary.checkedEvents} 个，选手 ${summary.checkedPlayers} 位，状态变化 ${summary.changed} 条，进行中 ${summary.pendingSetCount} 条`,
            `自动轮询：${enabled ? '已开启' : '已经开启'}`,
          ].join('\n'),
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (arg === 'status') {
        const players = listStartggWatchPlayers();
        const events = listStartggWatchEvents().filter((row) => row.active === 1);
        const statuses = listStartggWatchStatusViews();
        await ctx.reply(
          formatStartggRuntimeStatus({
            ...getStartggPollingRuntimeStatus(),
            players,
            events,
            statuses,
          }),
          { parse_mode: 'HTML' },
        );
        return;
      }
      await syncStartggPresetPlayers();
      const players = listStartggWatchPlayers().filter((row) => row.enabled === 1);
      const events = listStartggWatchEvents().filter((row) => row.active === 1);
      const pollingText = isStartggPollingEnabled() ? '已开启' : '未开启';
      await ctx.reply(`${formatStartggGuide(players.length, events.length)}\n\n当前监控项目：${events.length} 个\n自动轮询：${pollingText}`, { parse_mode: 'HTML' });
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`${arg === 'go' || arg.startsWith('go ') ? 'start.gg go 失败' : 'start.gg 状态读取失败'}：${e.message}`, { parse_mode: 'HTML' });
        return;
      }
      throw e;
    }
  });

  bot.command('startggpoll', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const arg = text.replace(/^\/startggpoll\s*/, '').trim().toLowerCase();
    if (arg === 'on') {
      const enabled = enableStartggPolling(bot);
      await ctx.reply(enabled ? 'start.gg 自动轮询已开启：每 20 分钟检查一次。' : 'start.gg 自动轮询已经开启。', { parse_mode: 'HTML' });
      return;
    }
    if (arg === 'off') {
      const disabled = disableStartggPolling();
      await ctx.reply(disabled ? 'start.gg 自动轮询已关闭。' : 'start.gg 自动轮询本来就是关闭的。', { parse_mode: 'HTML' });
      return;
    }
    const pollingText = isStartggPollingEnabled() ? '已开启' : '未开启';
    await ctx.reply(`用法：/startggpoll on 或 /startggpoll off\n当前状态：${pollingText}`, { parse_mode: 'HTML' });
  });

  bot.command('watch', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const raw = text.replace(/^\/watch\s*/, '').trim();
    if (!raw) {
      await ctx.reply(
        '用法：/watch <选手名 | 用户链接 | 项目链接>\n示例：/watch Tokido',
        { parse_mode: 'HTML' },
      );
      return;
    }

    try {
      if (isStartggEventReference(raw)) {
        const event = await fetchEventMeta(raw);
        const eventName = event.tournamentName ? `${event.tournamentName} / ${event.name}` : event.name;
        replaceActiveStartggWatchEvent(event.slug, eventName);
        const enabledPlayers = listStartggWatchPlayers().filter((row) => row.enabled === 1).length;
        const nextStep = enabledPlayers === 0
          ? '下一步：发送 /watch <选手名> 或 /watch <user_url> 添加选手。'
          : '下一步：发送 /watchlist 查看当前监控状态。';
        await ctx.reply(
          `已切换监控项目：${eventName}\n当前配置：${enabledPlayers} 位选手，1 个项目。\n${nextStep}`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (isStartggUserReference(raw)) {
        const resolved = await resolveUserToPlayer(raw);
        const existingPlayer = findStartggWatchPlayerByPlayerId(resolved.playerId);
        if (existingPlayer) {
          if (existingPlayer.player_name !== resolved.playerName) {
            updateStartggWatchPlayerName(existingPlayer.id, resolved.playerName);
          }
          await ctx.reply(
            `该选手已在监控中：${resolved.playerName} (player_id=${resolved.playerId})`,
            { parse_mode: 'HTML' },
          );
          return;
        }

        createStartggWatchPlayer(resolved.playerId, resolved.playerName);
        const activeEvents = listStartggWatchEvents().filter((row) => row.active === 1).length;
        const nextStep = activeEvents === 0
          ? '下一步：发送 /watch <event_url> 添加项目链接。'
          : '下一步：发送 /watchlist 查看当前监控状态。';
        await ctx.reply(
          `已添加选手：${resolved.playerName} (player_id=${resolved.playerId})\n${nextStep}`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      const activeEvents = listStartggWatchEvents().filter((row) => row.active === 1);
      if (activeEvents.length === 0) {
        await ctx.reply(
          '请先添加项目链接：/watch https://www.start.gg/tournament/xxx/event/yyy',
          { parse_mode: 'HTML' },
        );
        return;
      }

      const nameQuery = raw.toLowerCase();
      const candidateMap = new Map<number, StartggWatchCandidate>();
      for (const eventRow of activeEvents) {
        const entrants = await listEventEntrantPlayers(eventRow.event_slug);
        for (const entrant of entrants) {
          const playerName = entrant.playerName.toLowerCase();
          const entrantName = entrant.entrantName.toLowerCase();
          if (!playerName.includes(nameQuery) && !entrantName.includes(nameQuery)) continue;
          if (candidateMap.has(entrant.playerId)) continue;
          candidateMap.set(entrant.playerId, {
            eventRowId: eventRow.id,
            eventName: eventRow.event_name,
            playerId: entrant.playerId,
            playerName: entrant.playerName,
          });
        }
      }

      const candidates = Array.from(candidateMap.values());
      if (candidates.length === 0) {
        await ctx.reply(
          `在已添加项目里未找到「${raw}」。\n建议改用选手用户链接：/watch https://www.start.gg/user/xxxx`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (candidates.length === 1) {
        const candidate = candidates[0]!;
        const existingPlayer = findStartggWatchPlayerByPlayerId(candidate.playerId);
        if (existingPlayer) {
          if (existingPlayer.player_name !== candidate.playerName) {
            updateStartggWatchPlayerName(existingPlayer.id, candidate.playerName);
          }
          await ctx.reply(
            `该选手已在监控中：${candidate.playerName} (player_id=${candidate.playerId})`,
            { parse_mode: 'HTML' },
          );
          return;
        }
        createStartggWatchPlayer(candidate.playerId, candidate.playerName);
        await ctx.reply(
          `已添加选手：${candidate.playerName} (player_id=${candidate.playerId})\n来源项目：${candidate.eventName}`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      const topCandidates = candidates.slice(0, 10);
      await ctx.reply(
        formatStartggWatchCandidates(
          raw,
          topCandidates.map((item) => ({
            playerName: item.playerName,
            eventName: item.eventName,
            playerId: item.playerId,
          })),
        ),
        {
          parse_mode: 'HTML',
          ...buildStartggWatchCandidateButtons(topCandidates.map((item) => ({
            eventRowId: item.eventRowId,
            playerId: item.playerId,
            playerName: item.playerName,
          }))),
        },
      );
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`添加监控失败：${e.message}`, { parse_mode: 'HTML' });
        return;
      }
      throw e;
    }
  });

  async function handleWatchList(ctx: Context): Promise<void> {
    if (!isAuthorized(ctx)) return;
    try {
      await syncStartggPresetPlayers();
      const players = listStartggWatchPlayers();
      const events = listStartggWatchEvents().filter((row) => row.active === 1);
      const statuses = listStartggWatchStatusViews();
      await ctx.reply(formatStartggWatchList(players, events, statuses), { parse_mode: 'HTML' });
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`读取监控列表失败：${e.message}`, { parse_mode: 'HTML' });
        return;
      }
      throw e;
    }
  }

  bot.command('startggwatchlist', handleWatchList);
  bot.command('watchlist', handleWatchList);

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
        const rruleText = buildRRuleText(recurringResult.spec, now);
        const nextTrigger = getNextTrigger(rruleText, recurringResult.spec.timezone, now, true);
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

    const preset = findPresetByText(text);
    if (preset) {
      const receivedAt = new Date();
      const triggerAt = new Date(receivedAt.getTime() + preset.minutes * 60 * 1000);
      const reminder = repo.createReminder({
        chat_id: String(ctx.chat!.id),
        text: preset.reminderText,
        trigger_at: triggerAt,
      });
      scheduleReminder(bot, reminder);
      const createdMessage = await ctx.reply(
        formatReminderCreated(reminder, 'preset'),
        { parse_mode: 'HTML', ...buildCancelButton(reminder.id) }
      );
      repo.setSourceMessageId(reminder.id, createdMessage.message_id);
      return;
    }

    const receivedAt = new Date();
    const result = await parseNaturalReminder(text, receivedAt);

    if ('error' in result) {
      ctx.reply(result.error, { parse_mode: 'HTML' });
      return;
    }

    if ('intent' in result && result.intent === 'list_reminders') {
      await handleListIntent(ctx, result);
      return;
    }

    if ('intent' in result && result.intent === 'cancel_reminder') {
      await handleCancelIntent(ctx, result);
      return;
    }

    if ('spec' in result) {
      const rruleText = buildRRuleText(result.spec, receivedAt);
      const nextTrigger = getNextTrigger(rruleText, result.spec.timezone, receivedAt, true);
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

  async function deleteSourceMessage(reminder: repo.Reminder, currentMessageId?: number): Promise<void> {
    if (!reminder.source_message_id || reminder.source_message_id === currentMessageId) return;
    await bot.telegram.deleteMessage(reminder.chat_id, reminder.source_message_id);
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

    const startggWatchData = parseStartggWatchCallbackData(cbData);
    if (startggWatchData) {
      await ctx.answerCbQuery();
      const eventRow = findStartggWatchEventById(startggWatchData.eventRowId);
      if (!eventRow || eventRow.active !== 1) {
        await ctx.reply('候选项已失效，请重新执行 /watch <选手名>。', { parse_mode: 'HTML' });
        return;
      }

      const entrants = await listEventEntrantPlayers(eventRow.event_slug);
      const selected = entrants.find((item) => item.playerId === startggWatchData.playerId);
      if (!selected) {
        await ctx.reply('未找到该候选选手，请重新执行 /watch <选手名>。', { parse_mode: 'HTML' });
        return;
      }

      const existingPlayer = findStartggWatchPlayerByPlayerId(selected.playerId);
      if (existingPlayer) {
        if (existingPlayer.player_name !== selected.playerName) {
          updateStartggWatchPlayerName(existingPlayer.id, selected.playerName);
        }
        await ctx.reply(
          `该选手已在监控中：${selected.playerName} (player_id=${selected.playerId})`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      createStartggWatchPlayer(selected.playerId, selected.playerName);
      await ctx.reply(
        `已添加选手：${selected.playerName} (player_id=${selected.playerId})\n来源项目：${eventRow.event_name}`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const vitaminAction = parseVitaminCallbackData(cbData);
    if (vitaminAction) {
      await ctx.answerCbQuery();

      if (vitaminAction === 'eaten') {
        markVitaminEatenToday();
        const chatId = String(ctx.chat!.id);
        const messageIds = getAndClearVitaminSentMessages();
        for (const messageId of messageIds) {
          try {
            await bot.telegram.deleteMessage(chatId, messageId);
          } catch {
            // message may already be deleted or not deletable
          }
        }
        return;
      }

      if (vitaminAction === 'snooze') {
        try {
          await ctx.editMessageText('💊 好的，30分钟后再提醒你。', { parse_mode: 'HTML' });
        } catch {
          await ctx.reply('💊 好的，30分钟后再提醒你。', { parse_mode: 'HTML' });
        }
        scheduleVitaminSnooze(bot);
        return;
      }
    }

    const nlCancelData = parseNaturalCancelCallbackData(cbData);
    if (nlCancelData) {
      await ctx.answerCbQuery();
      const chatId = String(ctx.chat!.id);

      if (nlCancelData.kind === 'once') {
        const reminder = repo.findReminderById(nlCancelData.id);
        if (!reminder || reminder.status !== 'pending' || reminder.chat_id !== chatId) {
          try {
            await ctx.editMessageText('该提醒已不存在或已处理。', { parse_mode: 'HTML' });
          } catch {
            await ctx.reply('该提醒已不存在或已处理。', { parse_mode: 'HTML' });
          }
          return;
        }
        repo.cancelReminder(nlCancelData.id);
        cancelScheduledReminder(nlCancelData.id);
        await clearSourceButtons(reminder);
        try {
          await ctx.editMessageText(`已取消一次性提醒「<b>${escapeHtml(reminder.text)}</b>」。`, { parse_mode: 'HTML' });
        } catch {
          await ctx.reply(`已取消一次性提醒「<b>${escapeHtml(reminder.text)}</b>」。`, { parse_mode: 'HTML' });
        }
        return;
      }

      const rule = repo.findRecurringRuleById(nlCancelData.id);
      if (!rule || rule.status !== 'active' || rule.chat_id !== chatId) {
        try {
          await ctx.editMessageText('该提醒已不存在或已处理。', { parse_mode: 'HTML' });
        } catch {
          await ctx.reply('该提醒已不存在或已处理。', { parse_mode: 'HTML' });
        }
        return;
      }
      repo.updateRecurringStatus(nlCancelData.id, 'cancelled');
      cancelRecurringJob(nlCancelData.id);
      await clearRecurringSourceButtons(rule);
      try {
        await ctx.editMessageText(`已取消循环提醒「<b>${escapeHtml(rule.text)}</b>」。`, { parse_mode: 'HTML' });
      } catch {
        await ctx.reply(`已取消循环提醒「<b>${escapeHtml(rule.text)}</b>》。`, { parse_mode: 'HTML' });
      }
      return;
    }

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
          await ctx.deleteMessage();
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
        await deleteSourceMessage(reminder, ctx.callbackQuery.message?.message_id);
        await ctx.deleteMessage();
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

  async function handleListIntent(
    ctx: Context,
    intent: ParsedListReminders,
  ): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const onceReminders = repo.findPendingRemindersInRange(chatId, intent.rangeStart, intent.rangeEnd);
    const activeRules = repo.findActiveRecurringByChatId(chatId);

    const items: ReminderListItem[] = [...onceReminders.map((r: repo.Reminder) => ({
      kind: 'once' as const,
      text: r.text,
      triggerAt: new Date(r.trigger_at),
    }))];

    for (const rule of activeRules) {
      try {
        const occurrences = getOccurrencesInRange(rule, intent.rangeStart, intent.rangeEnd);
        for (const occ of occurrences) {
          items.push({
            kind: 'recurring' as const,
            text: rule.text,
            triggerAt: occ.triggerAt,
          });
        }
      } catch (e) {
        await ctx.reply(
          e instanceof Error ? e.message : '循环提醒展开失败，请缩小查询范围。',
          { parse_mode: 'HTML' },
        );
        return;
      }
    }

    items.sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());

    await ctx.reply(
      formatReminderRangeList(intent.title, items),
      { parse_mode: 'HTML' },
    );
  }

  async function handleCancelIntent(
    ctx: Context,
    intent: ParsedCancelReminder,
  ): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const candidates: CancelCandidate[] = [];

    if (intent.target === 'once' || intent.target === 'any') {
      const onceResults = repo.searchPendingReminders(chatId, intent.query);
      for (const r of onceResults) {
        candidates.push({
          kind: 'once',
          id: r.id,
          text: r.text,
          triggerAt: new Date(r.trigger_at),
        });
      }
    }

    if (intent.target === 'recurring' || intent.target === 'any') {
      const recurringResults = repo.searchActiveRecurringRules(chatId, intent.query);
      for (const rule of recurringResults) {
        candidates.push({
          kind: 'recurring',
          id: rule.id,
          text: rule.text,
          triggerAt: new Date(rule.next_trigger_at),
        });
      }
    }

    candidates.sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());

    if (candidates.length === 0) {
      await ctx.reply(
        formatCancelCandidates(intent.query, []),
        { parse_mode: 'HTML' },
      );
      return;
    }

    if (candidates.length === 1) {
      const c = candidates[0]!;
      if (c.kind === 'once') {
        const reminder = repo.findReminderById(c.id)!;
        repo.cancelReminder(c.id);
        cancelScheduledReminder(c.id);
        await clearSourceButtons(reminder);
      } else {
        const rule = repo.findRecurringRuleById(c.id)!;
        repo.updateRecurringStatus(c.id, 'cancelled');
        cancelRecurringJob(c.id);
        await clearRecurringSourceButtons(rule);
      }
      await ctx.reply(
        formatCancelCandidates(intent.query, candidates),
        { parse_mode: 'HTML' },
      );
      return;
    }

    await ctx.reply(
      formatCancelCandidates(intent.query, candidates),
      { parse_mode: 'HTML', ...buildCancelCandidateButtons(candidates) },
    );
  }
}
