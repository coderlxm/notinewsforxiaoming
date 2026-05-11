import type { Reminder, RecurringRule } from './repository';
import { bjFormat, formatShortDisplay } from '../utils/time';
import { describeRecurrence } from './recurring';

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    '',
    '🤖 <b>自然语言对话：</b>',
    '直接发送 <code>10 分钟后提醒我下楼</code> 即可。',
    '──────────────────',
    '#帮助 #NotiNews',
  ].join('\n');
}

export function formatReminderCreated(reminder: Reminder, source?: 'deterministic' | 'ai'): string {
  const sourceTag = source === 'ai' ? ' [AI]' : source === 'deterministic' ? ' [指令]' : '';
  return [
    `✅ <b>提醒设置成功</b>${sourceTag}`,
    '──────────────────',
    `📅 <b>时间</b>：${bjFormat(reminder.trigger_at)}`,
    `📝 <b>内容</b>：${escapeHtml(reminder.text)}`,
    '──────────────────',
    '<i>我会在准时叫醒你。</i>',
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

