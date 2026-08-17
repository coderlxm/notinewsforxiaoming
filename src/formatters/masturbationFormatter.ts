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
  let timeText: string;
  if (occurredDate === today.format('YYYY-MM-DD')) {
    timeText = `今天 ${occurredAt.format('HH:mm')}`;
  } else if (occurredDate === today.subtract(1, 'day').format('YYYY-MM-DD')) {
    timeText = `昨天 ${occurredAt.format('HH:mm')}`;
  } else {
    timeText = occurredAt.format('MM-DD HH:mm');
  }
  return latest.note ? `${timeText} · ${latest.note}` : timeText;
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

export function formatMasturbationReminderCard(): string {
  return [
    '📝 撸了吗',
    '',
    '今天还没有记录。',
    '如果只是忘了，点下方“记一次”，填写实际时间和备注；不需要记录可忽略。',
  ].join('\n');
}

export function formatMasturbationCapturePromptCard(): string {
  return [
    '📝 撸了吗 · 记录',
    '',
    '请输入本次实际撸的时间和备注，例如：',
    '20:30 在卧室',
    '',
    '也可用自然语言，例如：晚上8点多在沙发上看片撸了一次',
    '请在 10 分钟内回复，回复 /cancel 可取消。',
  ].join('\n');
}

export function formatMasturbationCaptureCancelledCard(): string {
  return '↩️ 已取消本次记录。';
}

export function formatMasturbationConfirmCard(record: MasturbationRecord, todayCount: number): string {
  const lines = [
    '✅ 已记录',
    '',
    `本次：${bjFormat(record.occurred_at)}`,
    `今天：${todayCount} 次`,
  ];
  if (record.note) {
    lines.push(`备注：${record.note}`);
  }
  return lines.join('\n');
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

export function buildMasturbationStatusButtons(referenceDate?: string): { reply_markup: InlineKeyboardMarkup } {
  const addCallbackData = referenceDate
    ? `masturbation:add:${referenceDate}`
    : 'masturbation:add';
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '记一次', callback_data: addCallbackData },
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
      ]],
    },
  };
}
