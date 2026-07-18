import type { Reminder, RecurringRule } from './repository.js';
import { bjFormat, formatShortDisplay } from '../utils/time.js';
import { describeRecurrence } from './recurring.js';
import { PRESET_REMINDERS, STARTGG_GO_SHORTCUT } from './presets.js';
import { escapeHtml } from '../utils/html.js';

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

export function formatStartMessage(): string {
  return '👋 你好！我是 <b>NotiNews Bot</b>。\n\n我是一个智能个人助手，可以帮你记录提醒、汇总新闻和管理日常。\n\n使用 /help 查看可用命令。';
}

export function formatHelpMessage(): string {
  return [
    '🛠️ <b>可用命令指南</b>',
    '──────────────────',
    '🔔 <b>提醒相关：</b>',
    '/remind - 查看清单',
    '/remind <code>[时间] [内容]</code> - 创建提醒',
    '',
    '💡 <b>命令示例：</b>',
    '• <code>/remind 15:30 开会</code>',
    '• <code>/remind 10m 拿快递</code>',
    '• <code>/remind 明天 10:00 健身</code>',
    '• <code>/fetchav</code> - 手动检查一次 AV 更新（<code>/fetchav force</code> 强制重发）',
    '• <code>/avsub</code> - 管理 AV 订阅（<code>add/list/remove</code>）',
    '• <code>/syncx</code> - 手动同步 X 点赞视频到 Google Drive',
    '• <code>/startgg</code> - 打开 start.gg 配置引导',
    '• <code>/watch Tokido</code> - 按选手名添加监控',
    '• <code>/watch https://www.start.gg/user/xxxx</code> - 按用户页添加监控',
    '• <code>/watch https://www.start.gg/tournament/xxx/event/yyy</code> - 按项目页添加监控',
    '• <code>/watchlist</code> - 查看监控列表与最近状态',
    '• <code>/steam</code> - Steam 价格监控管理（<code>add/list/set/remove/check</code>）',
    '• <code>/lu</code> - 查看撸了吗状态卡片（<code>/lu stats</code> 统计、<code>/lu undo</code> 撤销最新一次）',
    '',
    '🤖 <b>自然语言对话：</b>',
    '直接发送 <code>10 分钟后提醒我下楼</code> 即可。',
    '──────────────────',
    '#帮助 #NotiNews',
  ].join('\n');
}

export function formatReminderCreated(reminder: Reminder, source?: 'deterministic' | 'ai' | 'preset'): string {
  const sourceTag = source === 'ai' ? ' [AI]' : source === 'deterministic' ? ' [指令]' : source === 'preset' ? ' [快捷]' : '';
  return [
    `✅ <b>提醒设置成功</b>${sourceTag}`,
    '──────────────────',
    `📅 <b>时间</b>：${bjFormat(reminder.trigger_at)}`,
    `📝 <b>内容</b>：${escapeHtml(reminder.text)}`,
    '──────────────────',
    '<i>任务已记录，我会准时提醒你。</i>',
  ].join('\n');
}

export function formatEmptyReminderList(): string {
  return '✨ <b>当前清单空空如也</b>\n\n使用 /remind 或直接发送语音/文字来创建一个提醒吧。';
}

export function formatReminderList(reminders: Reminder[]): string {
  const count = reminders.length;
  const lines = [`📋 <b>待处理提醒清单 (${count})</b>`, '──────────────────'];

  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  reminders.forEach((r, i) => {
    const time = formatShortDisplay(r.trigger_at);
    const prefix = i < 10 ? emojis[i] : `${i + 1}.`;
    lines.push(`${prefix} <code>${time}</code> ${escapeHtml(r.text)}`);
  });

  if (count > 0) {
    lines.push('──────────────────');
    lines.push('<i>点击下方按钮可快速操作。</i>');
  }

  return lines.join('\n');
}

export function buildReminderListButtons(reminders: Reminder[]): { reply_markup: InlineKeyboardMarkup } {
  const rows = reminders.map((r, i) => [{
    text: `取消 ${i + 1}`,
    callback_data: `reminder:cancel:${r.id}`
  }]);

  return { reply_markup: { inline_keyboard: rows } };
}

export function formatReminderMessage(reminder: Reminder): string {
  return [
    '⏰ <b>提醒时间到</b>',
    '──────────────────',
    escapeHtml(reminder.text),
    '──────────────────',
    '#提醒 #任务',
  ].join('\n');
}

export function formatReminderDone(reminder: Reminder): string {
  return `✅ 提醒「<b>${escapeHtml(reminder.text)}</b>」已标记为完成。`;
}

export function formatReminderSnoozed(reminder: Reminder): string {
  return [
    '💤 <b>提醒已推迟</b>',
    '──────────────────',
    `新时间：<code>${bjFormat(reminder.trigger_at)}</code>`,
  ].join('\n');
}

export function formatReminderCancelled(reminder: Reminder): string {
  return `🗑️ 提醒「<b>${escapeHtml(reminder.text)}</b>」已从清单中移除。`;
}

export function buildCancelButton(reminderId: number): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '取消提醒', callback_data: `reminder:cancel:${reminderId}` }
      ]]
    }
  };
}

export function buildReminderButtons(reminderId: number): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ 已完成', callback_data: `reminder:done:${reminderId}` },
        { text: '💤 晚点再说', callback_data: `reminder:snooze5:${reminderId}` }
      ]]
    }
  };
}

export function formatRecurringCreated(rule: RecurringRule, description: string): string {
  const nextTime = bjFormat(rule.next_trigger_at);
  const sourceTag = rule.source === 'ai' ? ' [AI]' : ' [指令]';
  return [
    `🔄 <b>循环提醒已就绪</b>${sourceTag}`,
    '──────────────────',
    `🗓️ <b>规则</b>：${escapeHtml(description)}`,
    `📝 <b>内容</b>：${escapeHtml(rule.text)}`,
    `⏳ <b>下次</b>：${nextTime}`,
    '──────────────────',
    '<i>规则已生效，将持续为您保驾护航。</i>',
  ].join('\n');
}

export function formatRecurringReminderMessage(rule: RecurringRule): string {
  return [
    '🔄 <b>循环提醒时间到</b>',
    '──────────────────',
    escapeHtml(rule.text),
    '──────────────────',
    '#循环提醒 #例行',
  ].join('\n');
}

export function buildRecurringRuleButtons(ruleId: number): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '⏸️ 暂停循环', callback_data: `recur:pause:${ruleId}` },
        { text: '🗑️ 取消规则', callback_data: `recur:cancel:${ruleId}` },
      ]]
    }
  };
}

export function buildRecurringReminderButtons(ruleId: number, runId: number): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ 已完成', callback_data: `recur:done:${ruleId}:${runId}` },
        { text: '⏭️ 跳过本次', callback_data: `recur:skip:${ruleId}:${runId}` },
      ], [
        { text: '🛑 停止循环', callback_data: `recur:cancel:${ruleId}:0` },
      ]]
    }
  };
}

export function formatRecurringCancelled(rule: RecurringRule): string {
  return `🗑️ 循环提醒规则「<b>${escapeHtml(rule.text)}</b>」已取消。`;
}

export function formatRecurringPaused(rule: RecurringRule): string {
  return `⏸️ 循环提醒「<b>${escapeHtml(rule.text)}</b>」已暂停。`;
}

export function formatRecurringRunDone(): string {
  return '✅ 已完成本次循环任务。';
}

export function formatRecurringRunSkipped(): string {
  return '⏭️ 已跳过本次循环任务。';
}

export interface ReminderListItem {
  kind: 'once' | 'recurring';
  text: string;
  triggerAt: Date;
}

export interface CancelCandidate {
  kind: 'once' | 'recurring';
  id: number;
  text: string;
  triggerAt: Date;
}

export function formatReminderRangeList(
  title: string,
  items: ReminderListItem[],
): string {
  const label = title || '查询结果';
  if (items.length === 0) {
    return `📭 <b>${escapeHtml(label)}</b>\n\n这个时间段没有提醒。`;
  }
  const lines = [
    `📋 <b>${escapeHtml(label)} 提醒 (${items.length})</b>`,
    '──────────────────',
  ];
  items.forEach((item, i) => {
    const time = bjFormat(item.triggerAt);
    const tag = item.kind === 'recurring' ? ' [循环]' : '';
    const num = i + 1;
    lines.push(`${num}. <code>${time}</code>${tag} ${escapeHtml(item.text)}`);
  });
  return lines.join('\n');
}

export function formatCancelCandidates(
  query: string,
  candidates: CancelCandidate[],
): string {
  if (candidates.length === 0) {
    return `🔍 没有找到与「<b>${escapeHtml(query)}</b>」相关的提醒。`;
  }
  if (candidates.length === 1) {
    const c = candidates[0]!;
    const tag = c.kind === 'recurring' ? '循环' : '一次性';
    return `已取消${tag}提醒「<b>${escapeHtml(c.text)}</b>」。`;
  }
  const lines = [
    `🔍 找到 ${candidates.length} 个与「<b>${escapeHtml(query)}</b>」相关的提醒，请选择一个取消：`,
    '──────────────────',
  ];
  candidates.forEach((c, i) => {
    const time = bjFormat(c.triggerAt);
    const tag = c.kind === 'recurring' ? ' [循环]' : '';
    lines.push(`${i + 1}. <code>${time}</code>${tag} ${escapeHtml(c.text)}`);
  });
  return lines.join('\n');
}

export function buildCancelCandidateButtons(
  candidates: CancelCandidate[],
): { reply_markup: InlineKeyboardMarkup } {
  const rows = candidates.map((c) => {
    const prefix = c.kind === 'once' ? 'nlcancel:once' : 'nlcancel:recur';
    return [{
      text: `取消「${c.text.slice(0, 10)}${c.text.length > 10 ? '...' : ''}」`,
      callback_data: `${prefix}:${c.id}`,
    }];
  });
  return { reply_markup: { inline_keyboard: rows } };
}

export function buildPresetKeyboard(): { reply_markup: { keyboard: Array<Array<{ text: string }>>; resize_keyboard: boolean; one_time_keyboard: boolean } } {
  const buttons = [
    ...PRESET_REMINDERS
      .filter((preset) => preset.id !== 'laundry' && preset.id !== 'workout')
      .map((preset) => ({ text: `${preset.emoji} ${preset.label}` })),
    { text: `${STARTGG_GO_SHORTCUT.emoji} ${STARTGG_GO_SHORTCUT.label}` },
    { text: '📝 撸了吗' },
  ];
  const rows: Array<Array<{ text: string }>> = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  };
}
