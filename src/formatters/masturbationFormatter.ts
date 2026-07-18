import type { MasturbationRecord } from '../services/masturbationRepository.js';
import { type MasturbationSummary, formatSinceLatest } from '../services/masturbationTracker.js';
import { bj, bjFormat } from '../utils/time.js';

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

function formatLatestDisplay(latest: MasturbationRecord | undefined, now: Date): string {
  if (!latest) return '还没有记录';
  const occurredAt = bj(latest.occurred_at);
  const today = bj(now);
  const occurredDate = occurredAt.format('YYYY-MM-DD');
  if (occurredDate === today.format('YYYY-MM-DD')) {
    return `今天 ${occurredAt.format('HH:mm')}`;
  }
  if (occurredDate === today.subtract(1, 'day').format('YYYY-MM-DD')) {
    return `昨天 ${occurredAt.format('HH:mm')}`;
  }
  return occurredAt.format('MM-DD HH:mm');
}

export function formatMasturbationStatusCard(summary: MasturbationSummary, now: Date = new Date()): string {
  return [
    '📝 撸了吗',
    '',
    `今天：${summary.todayCount} 次`,
    `本周最近 7 天：${summary.sevenDayCount} 次 / ${summary.sevenDayActiveDays} 天`,
    `上一次：${formatLatestDisplay(summary.latest, now)}`,
  ].join('\n');
}

export function formatMasturbationConfirmCard(record: MasturbationRecord, todayCount: number): string {
  return [
    '✅ 已记录',
    '',
    `本次：${bjFormat(record.occurred_at)}`,
    `今天：${todayCount} 次`,
  ].join('\n');
}

export function formatMasturbationUndoCard(todayCount: number): string {
  return [
    '↩️ 已撤销本次记录',
    `今天：${todayCount} 次`,
  ].join('\n');
}

export function formatMasturbationUndoCommand(record: MasturbationRecord): string {
  return [
    '↩️ 已撤销最新一次记录',
    `发生时间：${bjFormat(record.occurred_at)}`,
  ].join('\n');
}

export function formatMasturbationStatsCard(summary: MasturbationSummary, now: Date = new Date()): string {
  const lines: string[] = [
    '📊 撸了吗统计',
    '',
    `今天：${summary.todayCount} 次`,
    `最近 7 天：${summary.sevenDayCount} 次 / ${summary.sevenDayActiveDays} 天`,
    `最近 30 天：${summary.thirtyDayCount} 次 / ${summary.thirtyDayActiveDays} 天`,
  ];

  if (summary.latest) {
    lines.push(`距上一次：${formatSinceLatest(summary.latest, now)}`);
  } else {
    lines.push('还没有记录');
  }

  lines.push('', '最近 7 天');
  for (const day of summary.dailyCounts) {
    lines.push(`${day.date}  ${day.count}`);
  }
  return lines.join('\n');
}

export function buildMasturbationStatusButtons(): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '记一次', callback_data: 'masturbation:add' },
        { text: '查看统计', callback_data: 'masturbation:stats' },
      ]],
    },
  };
}

export function buildMasturbationConfirmButtons(recordId: number): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '撤销本次', callback_data: `masturbation:undo:${recordId}` },
        { text: '查看统计', callback_data: 'masturbation:stats' },
      ]],
    },
  };
}

export function buildMasturbationStatsButtons(): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '记一次', callback_data: 'masturbation:add' },
        { text: '刷新', callback_data: 'masturbation:refresh' },
      ]],
    },
  };
}
