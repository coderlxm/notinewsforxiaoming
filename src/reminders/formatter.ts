import type { Reminder } from './repository';
import { bjFormat, formatShortDisplay } from '../utils/time';

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatStartMessage(): string {
  return '你好！我是 NotiNews Bot。\n\n使用 /help 查看可用命令。';
}

export function formatHelpMessage(): string {
  return [
    '<b>可用命令：</b>',
    '',
    '/start - 开始使用',
    '/help - 查看帮助',
    '/remind - 查看提醒列表',
    '/remind <时间> <内容> - 创建提醒',
    '',
    '<b>命令格式：</b>',
    '<code>/remind 2026-05-08 15:30 开会</code>',
    '<code>/remind 10m 收衣服</code>',
    '<code>/remind 2h 看日志</code>',
    '',
    '<b>自然语言（直接输入即可）：</b>',
    '<code>10 分钟后提醒我收衣服</code>',
    '<code>明天下午 3 点提醒我开会</code>',
  ].join('\n');
}

export function formatReminderCreated(reminder: Reminder, source?: 'deterministic' | 'ai'): string {
  const sourceTag = source === 'ai' ? ' [AI]' : source === 'deterministic' ? ' [固定]' : '';
  return [
    `<b>已创建提醒</b>${sourceTag}`,
    '',
    `时间：${bjFormat(reminder.trigger_at)}`,
    `内容：${escapeHtml(reminder.text)}`,
  ].join('\n');
}

export function formatEmptyReminderList(): string {
  return '暂无提醒。\n\n使用 /remind 或直接输入自然语言创建提醒。';
}

export function formatReminderList(reminders: Reminder[]): string {
  const count = reminders.length;
  const lines = [`<b>待处理提醒 (${count})</b>`, ''];

  reminders.forEach((r, i) => {
    const time = formatShortDisplay(r.trigger_at);
    lines.push(`${i + 1}. ${time} ${escapeHtml(r.text)}`);
  });

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
    '<b>提醒时间到</b>',
    '',
    escapeHtml(reminder.text),
  ].join('\n');
}

export function formatReminderDone(reminder: Reminder): string {
  return `提醒「${escapeHtml(reminder.text)}」已标记为完成。`;
}

export function formatReminderSnoozed(reminder: Reminder): string {
  return `提醒已推迟 5 分钟，新的提醒时间：${bjFormat(reminder.trigger_at)}`;
}

export function formatReminderCancelled(reminder: Reminder): string {
  return `提醒「${escapeHtml(reminder.text)}」已取消。`;
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
        { text: '已完成', callback_data: `reminder:done:${reminderId}` },
        { text: '推迟 5 分钟', callback_data: `reminder:snooze5:${reminderId}` }
      ]]
    }
  };
}
