import type { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { isAuthorized } from './auth.js';
import { config } from '../config/index.js';
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
  parseWorkCheckinCallbackData,
  parseStartggWatchCallbackData,
  parseMasturbationCallbackData,
  parseStartggSeedsCallbackData,
  parseStartggInterestCallbackData,
} from './callbacks.js';
import * as avRepo from '../services/avRepository.js';
import type { TrackedTarget } from '../services/avRepository.js';
import { resolveAvSubscription } from '../services/avSubscriptionService.js';
import { runAvFetchOnce } from '../services/avTracker.js';
import { buildAvTargetUrl, getAvTargetTypeLabel } from '../services/avTargets.js';
import { markVitaminEatenToday, scheduleVitaminSnooze, getAndClearVitaminSentMessages } from '../services/vitaminReminder.js';
import { completeWorkCheckin } from '../services/workCheckinReminder.js';
import { findPresetByText, STARTGG_GO_SHORTCUT } from '../reminders/presets.js';
import {
  buildStartggWatchCandidateButtons,
  formatStartggGoTournamentCandidates,
  formatStartggGuide,
  formatStartggRuntimeStatus,
  formatStartggWatchCandidates,
  formatStartggWatchList,
  formatStartggGoStartedCard,
  buildStartggSeedsButtons,
  formatStartggSeedsList,
  buildStartggSeedsListButtons,
} from '../formatters/startggFormatter.js';
import {
  fetchEventMeta,
  listEventEntrantPlayers,
  resolveUserToPlayer,
  runStartggWatchOnce,
} from '../services/startgg/index.js';
import {
  createStartggWatchPlayer,
  findStartggWatchEventById,
  findStartggWatchPlayerByPlayerId,
  listStartggWatchEvents,
  listStartggWatchPlayers,
  listStartggWatchStatusViews,
  listStartggSentMessageIds,
  replaceActiveStartggWatchEvent,
  clearStartggWatchState,
  updateStartggWatchPlayerIdentity,
  getFeaturedSeedCount,
  setFeaturedSeedCount,
  listEventFeaturedEntrants,
  listActiveStartggWatchEvents,
  type StartggFeaturedSeedCount,
} from '../services/startggRepository.js';
import { runStartggGo, runStartggWatchNow, syncStartggPresetPlayers, resyncFeaturedEntrantsForActiveEvents } from '../services/startggPresetSync.js';
import {
  addStartggEventInterestOverride,
  deactivateStartggWatchEventsByVideogame,
  deleteStartggPendingEvent,
  deleteStartggPendingEventsByVideogame,
  findStartggPendingEventById,
  setStartggVideogamePreference,
} from '../services/startggInterestRepository.js';
import { escapeHtml } from '../utils/html.js';
import { bjFormat } from '../utils/time.js';
import {
  formatXLikedVideoSyncResult,
  isXLikedVideoSyncRunning,
  runXLikedVideoSync,
} from '../services/xLikedVideoSync.js';
import {
  isVideoDownloadRunning,
  runVideoDownload,
} from '../services/videoDownload.js';
import {
  disableStartggPolling,
  enableStartggPolling,
  getStartggPollingRuntimeStatus,
  isStartggPollingEnabled,
  updateStartggFastWatch,
} from '../scheduled/jobs.js';
import {
  parseTargetPrice,
  createSteamPriceWatch,
  runSteamPriceWatchOnce,
} from '../services/steamPriceTracker.js';
import * as steamRepo from '../services/steamPriceRepository.js';
import {
  formatSteamPriceAddSuccess,
  formatSteamPriceWatchList,
  formatSteamPriceSetTargetSuccess,
  formatSteamPriceRemoveSuccess,
  formatSteamPriceHelp,
  formatSteamPriceCheckSummary,
} from '../formatters/steamPriceFormatter.js';
import * as masturbationRepo from '../services/masturbationRepository.js';
import { buildSummary } from '../services/masturbationTracker.js';
import {
  formatMasturbationStatusCard,
  formatMasturbationConfirmCard,
  formatMasturbationUndoCard,
  formatMasturbationUndoCommand,
  formatMasturbationStatsCard,
  buildMasturbationStatusButtons,
  buildMasturbationConfirmButtons,
  buildMasturbationStatsButtons,
} from '../formatters/masturbationFormatter.js';

interface StartggWatchCandidate {
  eventRowId: number;
  eventName: string;
  playerId: number;
  playerName: string;
  userId: number | null;
  gamerTag: string;
}

function formatVideoDownloadBytes(bytes: number): string {
  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  return bytes >= gib
    ? `${(bytes / gib).toFixed(2)} GiB`
    : `${(bytes / mib).toFixed(1)} MiB`;
}

function formatVideoDownloadDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(1, Math.round(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

function formatVideoDownloadSpeed(bytes: number, elapsedMs: number): string {
  const bytesPerSecond = bytes / (elapsedMs / 1000);
  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  const kib = 1024;
  if (bytesPerSecond >= gib) return `${(bytesPerSecond / gib).toFixed(2)} GiB/s`;
  if (bytesPerSecond >= mib) return `${(bytesPerSecond / mib).toFixed(1)} MiB/s`;
  return `${(bytesPerSecond / kib).toFixed(1)} KiB/s`;
}

const STARTGG_GO_NATURAL_ALIASES = new Set([
  '比赛了',
  '街霸',
  '街霸6',
  '饿狼传说',
  '拳皇',
  `${STARTGG_GO_SHORTCUT.emoji}${STARTGG_GO_SHORTCUT.label}`,
]);

function isStartggGoNaturalAlias(text: string): boolean {
  return STARTGG_GO_NATURAL_ALIASES.has(text.trim().replace(/\s+/g, ''));
}

function getStartggSeedCardInput(playerCount: number, seedCount: StartggFeaturedSeedCount): {
  tournamentName: string;
  eventName: string;
  playerCount: number;
  seedCount: StartggFeaturedSeedCount;
  syncedCount: number;
} {
  const activeEvents = listActiveStartggWatchEvents();
  const tournamentNames = [...new Set(
    activeEvents
      .map((event) => event.tournament_name)
      .filter((name): name is string => Boolean(name)),
  )];
  const eventNames = activeEvents.map((event) => event.event_display_name ?? event.event_name);
  return {
    tournamentName: tournamentNames.join(' / ') || '-',
    eventName: eventNames.join(' / ') || '-',
    playerCount,
    seedCount,
    syncedCount: activeEvents.reduce(
      (total, event) => total + listEventFeaturedEntrants(event.id).length,
      0,
    ),
  };
}

function getStartggSeedListInput(seedCount: StartggFeaturedSeedCount): {
  eventName: string;
  seedCount: StartggFeaturedSeedCount;
  entrants: Array<{ seedNum: number; entrantName: string }>;
  syncedAt: string;
} | null {
  const activeEvents = listActiveStartggWatchEvents();
  if (activeEvents.length === 0) return null;

  const multipleEvents = activeEvents.length > 1;
  const syncedAt: string[] = [];
  const entrants = activeEvents.flatMap((event) => {
    const eventName = event.event_display_name ?? event.event_name;
    return listEventFeaturedEntrants(event.id).map((entrant) => {
      syncedAt.push(entrant.updated_at);
      return {
        seedNum: entrant.seed_num,
        entrantName: multipleEvents
          ? `${eventName} · ${entrant.entrant_name}`
          : entrant.entrant_name,
      };
    });
  });

  return {
    eventName: activeEvents
      .map((event) => event.event_display_name ?? event.event_name)
      .join(' / '),
    seedCount,
    entrants,
    syncedAt: syncedAt.length > 0
      ? bjFormat(syncedAt.sort().at(-1)!)
      : '-',
  };
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

function formatAvSubscriptionHelp(): string {
  return [
    'AV 订阅管理',
    '• <code>/avsub add https://www.javbus.com/star/vwq</code>',
    '• <code>/avsub add https://www.javbus.com/series/12f9</code>',
    '• <code>/avsub add https://www.javbus.com/studio/ne</code>',
    '• <code>/avsub add https://www.javbus.com/label/7l</code>',
    '• <code>/avsub list</code>',
    '• <code>/avsub remove 3</code>',
  ].join('\n');
}

function formatAvSubscriptionList(targets: TrackedTarget[]): string {
  if (targets.length === 0) {
    return '当前没有 AV 订阅。';
  }

  const lines = ['AV 订阅列表'];
  targets.forEach((target) => {
    const typeLabel = getAvTargetTypeLabel(target.target_type);
    lines.push(`${target.id}. ${escapeHtml(target.name)} [${typeLabel}]`);
    lines.push(buildAvTargetUrl(target.target_type, target.target_id));
  });
  return lines.join('\n');
}

export function registerInteractiveHandlers(bot: Telegraf): void {
  async function applyFeaturedSeedCount(count: StartggFeaturedSeedCount): Promise<void> {
    await resyncFeaturedEntrantsForActiveEvents(count);
    setFeaturedSeedCount(count);
    const summary = await runStartggWatchOnce(bot);
    updateStartggFastWatch(bot, summary.activeEventSlugs);
  }

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

  bot.command('syncx', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    if (isXLikedVideoSyncRunning()) {
      await ctx.reply('X 点赞视频同步正在运行中。');
      return;
    }

    await ctx.reply('开始检查 X 点赞视频...');
    try {
      const summary = await runXLikedVideoSync();
      if (summary.discovered === 0 && summary.downloaded === 0 && summary.uploaded === 0) {
        await ctx.reply('同步完成：没有发现新的点赞视频。');
        return;
      }
      await ctx.reply(formatXLikedVideoSyncResult(summary), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`X 点赞视频同步失败：${e.message}`);
        return;
      }
      throw e;
    }
  });

  bot.command('dld', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const url = text.replace(/^\/dld(?:@\S+)?\s*/i, '').trim();
    if (!url) {
      await ctx.reply('用法：/dld <视频链接>');
      return;
    }
    if (isVideoDownloadRunning()) {
      await ctx.reply('已有视频下载任务正在运行。');
      return;
    }

    const statusMessage = await ctx.reply('正在解析并下载视频…');
    const chatId = String(ctx.chat.id);
    try {
      const result = await runVideoDownload(url, async (stage) => {
        if (stage !== 'uploading') return;
        await ctx.telegram.editMessageText(
          chatId,
          statusMessage.message_id,
          undefined,
          '视频已下载，正在上传到 Google Drive…',
        );
      });
      await ctx.telegram.editMessageText(
        chatId,
        statusMessage.message_id,
        undefined,
        [
          '✅ 视频已上传到 Google Drive',
          `文件：${result.fileName}`,
          `大小：${formatVideoDownloadBytes(result.byteSize)}`,
          `总耗时：${formatVideoDownloadDuration(result.elapsedMs)}`,
          `全程平均速度：${formatVideoDownloadSpeed(result.byteSize, result.elapsedMs)}`,
          `路径：${result.drivePath}`,
        ].join('\n'),
      );
    } catch (e) {
      if (e instanceof Error) {
        await ctx.telegram.editMessageText(
          chatId,
          statusMessage.message_id,
          undefined,
          `视频下载失败：${e.message.slice(0, 3000)}`,
        );
        return;
      }
      throw e;
    }
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

  bot.command('avsub', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = text.replace(/^\/avsub\s*/i, '').trim();
    if (!args) {
      await ctx.reply(formatAvSubscriptionHelp(), { parse_mode: 'HTML' });
      return;
    }

    const [actionRaw, ...rest] = args.split(/\s+/);
    const action = actionRaw?.trim().toLowerCase() || '';
    const payload = rest.join(' ').trim();

    try {
      if (action === 'list') {
        await ctx.reply(formatAvSubscriptionList(avRepo.findTrackedTargets()), { parse_mode: 'HTML' });
        return;
      }

      if (action === 'add') {
        if (!payload) {
          await ctx.reply('用法：/avsub add <javbus_url>', { parse_mode: 'HTML' });
          return;
        }

        const resolved = await resolveAvSubscription(payload);
        const existing = avRepo.findTrackedTargetByKey('javbus', resolved.targetType, resolved.targetId);
        if (existing) {
          throw new Error(`该 AV 订阅已存在：${existing.name} (#${existing.id})`);
        }

        const created = avRepo.createTrackedTarget({
          name: resolved.name,
          target_type: resolved.targetType,
          target_id: resolved.targetId,
        });
        const typeLabel = getAvTargetTypeLabel(created.target_type);
        await ctx.reply(
          `已添加 AV 订阅：${escapeHtml(created.name)} [${typeLabel}]\n${resolved.url}\n开始立即检查这个订阅...`,
          { parse_mode: 'HTML' }
        );
        try {
          const summary = await runAvFetchOnce(bot, {
            healthNotify: false,
            targets: [created],
            skipBatchTargetDelay: true,
          });
          await ctx.reply(
            `立即检查完成：新增 ${summary.pushed} 条，已跳过 ${summary.skipped} 条。`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          if (e instanceof Error) {
            await ctx.reply(`立即检查失败：${e.message}`, { parse_mode: 'HTML' });
            return;
          }
          throw e;
        }
        return;
      }

      if (action === 'remove') {
        if (!payload) {
          await ctx.reply('用法：/avsub remove <id>', { parse_mode: 'HTML' });
          return;
        }

        const id = Number(payload);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error('删除 AV 订阅时请提供有效的数字 ID。');
        }

        const deleted = avRepo.deleteTrackedTargetById(id);
        if (!deleted) {
          throw new Error(`未找到 id=${id} 的 AV 订阅。`);
        }

        const typeLabel = getAvTargetTypeLabel(deleted.target_type);
        await ctx.reply(
          `已删除 AV 订阅：${escapeHtml(deleted.name)} [${typeLabel}]`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      await ctx.reply(formatAvSubscriptionHelp(), { parse_mode: 'HTML' });
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`AV 订阅操作失败：${e.message}`, { parse_mode: 'HTML' });
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
      updateStartggFastWatch(bot, summary.activeEventSlugs);
      await ctx.reply(
        `检查完成：本次检查项目 ${summary.checkedEvents} 个，选手 ${summary.checkedPlayers} 个，状态变化 ${summary.changed} 条，进行中 ${summary.activeSetCount} 条。`,
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

  async function handleStartggGo(ctx: Context, keyword: string): Promise<void> {
    const startMessage = keyword
      ? '开始 start.gg go：同步固定选手、按赛事关键词自动发现项目并启动监控...'
      : '开始 start.gg 自动监控：同步固定选手并自动发现当前进行中的赛事...';
    const startMessageResult = await ctx.reply(startMessage, { parse_mode: 'HTML' });

    try {
      const summary = await runStartggGo(bot, keyword);
      if (summary.status === 'candidates') {
        await ctx.telegram.editMessageText(
          String(ctx.chat!.id),
          startMessageResult.message_id,
          undefined,
          formatStartggGoTournamentCandidates(summary),
          { parse_mode: 'HTML' },
        );
        return;
      }
      if (summary.status === 'interest_pending') {
        await ctx.telegram.editMessageText(
          String(ctx.chat!.id),
          startMessageResult.message_id,
          undefined,
          `发现 ${summary.pendingEvents} 个尚未确认兴趣的赛事。请先在项目确认卡中选择，选择前不会启动赛事推送。`,
          { parse_mode: 'HTML' },
        );
        return;
      }
      updateStartggFastWatch(bot, summary.activeEventSlugs);
      enableStartggPolling(bot, false);

      const seedCount = getFeaturedSeedCount();
      await ctx.telegram.editMessageText(
        String(ctx.chat!.id),
        startMessageResult.message_id,
        undefined,
        formatStartggGoStartedCard(getStartggSeedCardInput(summary.syncedPlayers, seedCount)),
        {
          parse_mode: 'HTML',
          ...buildStartggSeedsButtons(seedCount),
          link_preview_options: { is_disabled: true },
        },
      );
    } catch (e) {
      if (e instanceof Error) {
        await ctx.telegram.editMessageText(
          String(ctx.chat!.id),
          startMessageResult.message_id,
          undefined,
          `start.gg go 失败：${escapeHtml(e.message)}`,
          { parse_mode: 'HTML' },
        );
        return;
      }
      throw e;
    }
  }

  bot.command('startgg', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const arg = text.replace(/^\/startgg\s*/, '').trim().toLowerCase();
    try {
      if (arg === 'deleteall') {
        disableStartggPolling();
        updateStartggFastWatch(bot, []);
        const messageIds = listStartggSentMessageIds();
        for (const messageId of messageIds) {
          await bot.telegram.deleteMessage(config.tgChatId, messageId);
        }
        clearStartggWatchState();
        await ctx.reply(
          `已删除 ${messageIds.length} 条已记录的 start.gg 推送消息，并清空本地赛事、快照和去重状态。此前未记录 message_id 的历史消息无法定位删除。`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (arg === 'go' || arg.startsWith('go ')) {
        const keyword = text.replace(/^\/startgg\s*/i, '').trim().replace(/^go\b/i, '').trim();
        await handleStartggGo(ctx, keyword);
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

      if (arg === 'seeds' || arg.startsWith('seeds ')) {
        const seedArg = arg.replace(/^seeds\s*/, '').trim();

        if (seedArg === '16' || seedArg === '32') {
          const count: StartggFeaturedSeedCount = seedArg === '16' ? 16 : 32;
          await applyFeaturedSeedCount(count);
          if (listActiveStartggWatchEvents().length === 0) {
            await ctx.reply(`种子关注已设置为 Top ${count}，下次点击「比赛了」时自动应用。`);
            return;
          }
          const players = listStartggWatchPlayers().filter((row) => row.enabled === 1);

          await ctx.reply(
            formatStartggGoStartedCard(getStartggSeedCardInput(players.length, count)),
            {
              parse_mode: 'HTML',
              ...buildStartggSeedsButtons(count),
              link_preview_options: { is_disabled: true },
            },
          );
          return;
        }

        if (seedArg === 'off') {
          await applyFeaturedSeedCount(0);
          if (listActiveStartggWatchEvents().length === 0) {
            await ctx.reply('种子关注已关闭，下次点击「比赛了」时继续保持关闭。');
            return;
          }
          const players = listStartggWatchPlayers().filter((row) => row.enabled === 1);

          await ctx.reply(
            formatStartggGoStartedCard(getStartggSeedCardInput(players.length, 0)),
            {
              parse_mode: 'HTML',
              ...buildStartggSeedsButtons(0),
              link_preview_options: { is_disabled: true },
            },
          );
          return;
        }

        if (seedArg === '') {
          const seedCount = getFeaturedSeedCount();
          const listInput = getStartggSeedListInput(seedCount);
          if (!listInput) {
            await ctx.reply('当前无活动赛事。种子关注设置：' + (seedCount === 0 ? '关闭' : `Top ${seedCount}`), { parse_mode: 'HTML' });
            return;
          }

          await ctx.reply(
            formatStartggSeedsList(listInput),
            {
              parse_mode: 'HTML',
              ...buildStartggSeedsListButtons(),
              link_preview_options: { is_disabled: true },
            },
          );
          return;
        }

        await ctx.reply('用法：/startgg seeds [16|32|off]', { parse_mode: 'HTML' });
        return;
      }
      await syncStartggPresetPlayers();
      const players = listStartggWatchPlayers().filter((row) => row.enabled === 1);
      const events = listStartggWatchEvents().filter((row) => row.active === 1);
      const pollingText = isStartggPollingEnabled() ? '已开启' : '未开启';
      await ctx.reply(`${formatStartggGuide(players.length, events.length)}\n\n当前监控项目：${events.length} 个\n自动轮询：${pollingText}`, { parse_mode: 'HTML' });
    } catch (e) {
      if (e instanceof Error) {
        const errorPrefix = arg === 'deleteall'
          ? 'start.gg 消息清理失败'
          : arg === 'go' || arg.startsWith('go ')
            ? 'start.gg go 失败'
            : arg === 'seeds' || arg.startsWith('seeds ')
              ? 'start.gg 种子关注操作失败'
            : 'start.gg 状态读取失败';
        await ctx.reply(`${errorPrefix}：${e.message}`, { parse_mode: 'HTML' });
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
      await ctx.reply(enabled ? 'start.gg 自动轮询已开启：每 15 分钟检查一次。' : 'start.gg 自动轮询已经开启。', { parse_mode: 'HTML' });
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
        if (
          !event.tournamentName
          || event.tournamentEndAt === null
          || event.videogameId === null
          || !event.videogameName
        ) {
          throw new Error(`start.gg 项目缺少 tournament 元数据：${event.slug}`);
        }
        setStartggVideogamePreference(
          event.videogameId,
          event.videogameName,
          'follow',
        );
        replaceActiveStartggWatchEvent(
          event.slug,
          eventName,
          event.tournamentName,
          event.name,
          new Date(event.tournamentEndAt * 1000).toISOString(),
          event.videogameId,
          event.videogameName,
        );
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
          updateStartggWatchPlayerIdentity(
            existingPlayer.id,
            resolved.playerName,
            resolved.userId,
            resolved.gamerTag,
          );
          await ctx.reply(
            `该选手已在监控中：${resolved.playerName} (player_id=${resolved.playerId})`,
            { parse_mode: 'HTML' },
          );
          return;
        }

        createStartggWatchPlayer(
          resolved.playerId,
          resolved.playerName,
          resolved.userId,
          resolved.gamerTag,
        );
        const activeEvents = listStartggWatchEvents().filter((row) => row.active === 1).length;
        const nextStep = activeEvents === 0
          ? '下一步：发送 /startgg go 自动发现当前赛事。'
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
            userId: entrant.userId,
            gamerTag: entrant.gamerTag,
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
          updateStartggWatchPlayerIdentity(
            existingPlayer.id,
            candidate.playerName,
            candidate.userId ?? existingPlayer.user_id,
            candidate.gamerTag,
          );
          await ctx.reply(
            `该选手已在监控中：${candidate.playerName} (player_id=${candidate.playerId})`,
            { parse_mode: 'HTML' },
          );
          return;
        }
        createStartggWatchPlayer(
          candidate.playerId,
          candidate.playerName,
          candidate.userId,
          candidate.gamerTag,
        );
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

  bot.command('steam', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = text.replace(/^\/steam\s*/i, '').trim();
    if (!args) {
      await ctx.reply(formatSteamPriceHelp(), { parse_mode: 'HTML' });
      return;
    }

    const [actionRaw, ...rest] = args.split(/\s+/);
    const action = actionRaw?.trim().toLowerCase() || '';
    const payload = rest.join(' ').trim();

    try {
      if (action === 'list') {
        await ctx.reply(formatSteamPriceWatchList(steamRepo.listSteamPriceWatches()), { parse_mode: 'HTML' });
        return;
      }

      if (action === 'check') {
        const summary = await runSteamPriceWatchOnce(bot);
        await ctx.reply(formatSteamPriceCheckSummary(summary.checked, summary.notified), { parse_mode: 'HTML' });
        return;
      }

      if (action === 'add') {
        const subArgs = payload.split(/\s+/);
        if (subArgs.length < 2) {
          await ctx.reply('用法：/steam add <Steam App URL | AppID> <目标价>', { parse_mode: 'HTML' });
          return;
        }
        const appRef = subArgs.slice(0, -1).join(' ');
        const targetPriceRaw = subArgs[subArgs.length - 1]!;
        const result = await createSteamPriceWatch(appRef, targetPriceRaw);
        await ctx.reply(
          formatSteamPriceAddSuccess(result.watch, result.atTarget),
          { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
        );
        return;
      }

      if (action === 'set') {
        const subArgs = payload.split(/\s+/);
        if (subArgs.length < 2) {
          await ctx.reply('用法：/steam set <订阅ID> <新目标价>', { parse_mode: 'HTML' });
          return;
        }
        const id = Number(subArgs[0]);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error('订阅 ID 无效。');
        }
        const watch = steamRepo.findSteamPriceWatchById(id);
        if (!watch) {
          throw new Error(`未找到 id=${id} 的 Steam 订阅。`);
        }
        const newTargetMinor = parseTargetPrice(subArgs[1]!);
        steamRepo.updateSteamPriceTarget(id, newTargetMinor);
        await ctx.reply(formatSteamPriceSetTargetSuccess(id, newTargetMinor), { parse_mode: 'HTML' });
        return;
      }

      if (action === 'remove') {
        if (!payload) {
          await ctx.reply('用法：/steam remove <订阅ID>', { parse_mode: 'HTML' });
          return;
        }
        const id = Number(payload);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error('删除 Steam 订阅时请提供有效的数字 ID。');
        }
        const deleted = steamRepo.deleteSteamPriceWatch(id);
        if (!deleted) {
          throw new Error(`未找到 id=${id} 的 Steam 订阅。`);
        }
        await ctx.reply(formatSteamPriceRemoveSuccess(deleted), { parse_mode: 'HTML' });
        return;
      }

      await ctx.reply(formatSteamPriceHelp(), { parse_mode: 'HTML' });
    } catch (e) {
      if (e instanceof Error) {
        await ctx.reply(`Steam 操作失败：${escapeHtml(e.message)}`, { parse_mode: 'HTML' });
        return;
      }
      throw e;
    }
  });

  bot.command('lu', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const arg = text.replace(/^\/lu\s*/, '').trim().toLowerCase();

    if (arg === 'undo') {
      const latest = masturbationRepo.deleteLatestRecord();
      if (!latest) {
        await ctx.reply('当前没有可撤销内容。', { parse_mode: 'HTML' });
        return;
      }
      await ctx.reply(formatMasturbationUndoCommand(latest), { parse_mode: 'HTML' });
      return;
    }

    if (arg === 'stats') {
      const summary = buildSummary();
      await ctx.reply(formatMasturbationStatsCard(summary), {
        parse_mode: 'HTML',
        ...buildMasturbationStatsButtons(),
      });
      return;
    }

    const summary = buildSummary();
    await ctx.reply(formatMasturbationStatusCard(summary), {
      parse_mode: 'HTML',
      ...buildMasturbationStatusButtons(),
    });
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
        const rruleText = buildRRuleText(recurringResult.spec, now);
        const nextTrigger = getNextTrigger(rruleText, recurringResult.spec.timezone, now, true, recurringResult.spec.calendarFilter);
        const rule = repo.createRecurringRule({
          chat_id: String(ctx.chat!.id),
          text: recurringResult.text,
          timezone: recurringResult.spec.timezone,
          rrule_text: rruleText,
          calendar_filter: recurringResult.spec.calendarFilter,
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

    if (text === '📝 撸了吗' || text === '撸了吗') {
      const summary = buildSummary();
      await ctx.reply(formatMasturbationStatusCard(summary), {
        parse_mode: 'HTML',
        ...buildMasturbationStatusButtons(),
      });
      return;
    }

    if (isStartggGoNaturalAlias(text)) {
      await handleStartggGo(ctx, '');
      return;
    }

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
      const nextTrigger = getNextTrigger(rruleText, result.spec.timezone, receivedAt, true, result.spec.calendarFilter);
      const rule = repo.createRecurringRule({
        chat_id: String(ctx.chat!.id),
        text: result.text,
        timezone: result.spec.timezone,
        rrule_text: rruleText,
        calendar_filter: result.spec.calendarFilter,
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

    const workCheckinDate = parseWorkCheckinCallbackData(cbData);
    if (workCheckinDate) {
      const completed = await completeWorkCheckin(bot, workCheckinDate);
      await ctx.answerCbQuery(completed ? '已记录打卡' : '这次打卡已经处理');
      return;
    }

    const masturbationAction = parseMasturbationCallbackData(cbData);
    if (masturbationAction) {
      await ctx.answerCbQuery();

      if (masturbationAction.type === 'add') {
        const record = masturbationRepo.createRecord(new Date());
        const summary = buildSummary();
        await ctx.editMessageText(formatMasturbationConfirmCard(record, summary.todayCount), {
          parse_mode: 'HTML',
          ...buildMasturbationConfirmButtons(record.id),
        });
        return;
      }

      if (masturbationAction.type === 'stats') {
        const summary = buildSummary();
        await ctx.editMessageText(formatMasturbationStatsCard(summary), {
          parse_mode: 'HTML',
          ...buildMasturbationStatsButtons(),
        });
        return;
      }

      const deleted = masturbationRepo.deleteRecordById(masturbationAction.recordId);
      const summary = buildSummary();
      if (!deleted) {
        await ctx.editMessageText('该记录已不存在。', { parse_mode: 'HTML' });
        return;
      }
      await ctx.editMessageText(formatMasturbationUndoCard(summary.todayCount), { parse_mode: 'HTML' });
      return;
    }

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
        updateStartggWatchPlayerIdentity(
          existingPlayer.id,
          selected.playerName,
          selected.userId ?? existingPlayer.user_id,
          selected.gamerTag,
        );
        await ctx.reply(
          `该选手已在监控中：${selected.playerName} (player_id=${selected.playerId})`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      createStartggWatchPlayer(
        selected.playerId,
        selected.playerName,
        selected.userId,
        selected.gamerTag,
      );
      await ctx.reply(
        `已添加选手：${selected.playerName} (player_id=${selected.playerId})\n来源项目：${eventRow.event_name}`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const seedsAction = parseStartggSeedsCallbackData(cbData);
    if (seedsAction) {
      if (seedsAction.type === 'seeds_set') {
        const currentCount = getFeaturedSeedCount();
        if (currentCount === seedsAction.count) {
          await ctx.answerCbQuery(
            currentCount === 0 ? '种子关注已经关闭' : `当前已经是 Top ${currentCount}`,
          );
          return;
        }
        await ctx.answerCbQuery();
        await applyFeaturedSeedCount(seedsAction.count);
        if (listActiveStartggWatchEvents().length === 0) {
          await ctx.editMessageText(
            seedsAction.count === 0
              ? '种子关注已关闭，下次点击「比赛了」时继续保持关闭。'
              : `种子关注已设置为 Top ${seedsAction.count}，下次点击「比赛了」时自动应用。`,
            buildStartggSeedsButtons(seedsAction.count),
          );
          return;
        }
        const players = listStartggWatchPlayers().filter((row) => row.enabled === 1);

        await ctx.editMessageText(
          formatStartggGoStartedCard(getStartggSeedCardInput(players.length, seedsAction.count)),
          {
            parse_mode: 'HTML',
            ...buildStartggSeedsButtons(seedsAction.count),
            link_preview_options: { is_disabled: true },
          },
        );
        return;
      }

      if (seedsAction.type === 'seeds_list') {
        await ctx.answerCbQuery();
        const seedCount = getFeaturedSeedCount();
        const listInput = getStartggSeedListInput(seedCount);
        if (!listInput) {
          await ctx.editMessageText('当前无活动赛事。', { parse_mode: 'HTML' });
          return;
        }

        await ctx.editMessageText(
          formatStartggSeedsList(listInput),
          {
            parse_mode: 'HTML',
            ...buildStartggSeedsListButtons(),
            link_preview_options: { is_disabled: true },
          },
        );
        return;
      }

      if (seedsAction.type === 'seeds_status') {
        await ctx.answerCbQuery();
        const activeEvents = listActiveStartggWatchEvents();
        const activeEvent = activeEvents[0] ?? null;
        if (!activeEvent) {
          await ctx.editMessageText('当前无活动赛事。', { parse_mode: 'HTML' });
          return;
        }
        const seedCount = getFeaturedSeedCount();
        const players = listStartggWatchPlayers().filter((row) => row.enabled === 1);

        await ctx.editMessageText(
          formatStartggGoStartedCard(getStartggSeedCardInput(players.length, seedCount)),
          {
            parse_mode: 'HTML',
            ...buildStartggSeedsButtons(seedCount),
            link_preview_options: { is_disabled: true },
          },
        );
        return;
      }
    }

    const interestAction = parseStartggInterestCallbackData(cbData);
    if (interestAction) {
      const pending = findStartggPendingEventById(interestAction.pendingEventId);
      if (!pending) {
        await ctx.answerCbQuery('该赛事确认项已失效');
        return;
      }

      await ctx.answerCbQuery();
      if (interestAction.action === 'follow') {
        setStartggVideogamePreference(
          pending.videogame_id,
          pending.videogame_name,
          'follow',
        );
        deleteStartggPendingEventsByVideogame(pending.videogame_id);
        await ctx.editMessageText(
          `已关注项目：${escapeHtml(pending.videogame_name)}\n本届赛事已开始监控。`,
          { parse_mode: 'HTML' },
        );
      } else if (interestAction.action === 'event') {
        addStartggEventInterestOverride(pending.event_slug, pending.tournament_end_at);
        deleteStartggPendingEvent(pending.id);
        await ctx.editMessageText(
          `仅关注本届赛事：${escapeHtml(pending.tournament_name)}`,
          { parse_mode: 'HTML' },
        );
      } else {
        setStartggVideogamePreference(
          pending.videogame_id,
          pending.videogame_name,
          'ignore',
        );
        deactivateStartggWatchEventsByVideogame(pending.videogame_id);
        deleteStartggPendingEventsByVideogame(pending.videogame_id);
        await ctx.editMessageText(
          `已忽略项目：${escapeHtml(pending.videogame_name)}\n以后不再询问或推送该项目赛事。`,
          { parse_mode: 'HTML' },
        );
      }

      const summary = await runStartggWatchNow(bot);
      updateStartggFastWatch(bot, summary.activeEventSlugs);
      if (interestAction.action !== 'ignore') {
        enableStartggPolling(bot, false);
      }
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
