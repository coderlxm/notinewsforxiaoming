import type { Reminder } from './repository';

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
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
    '/remind - 创建提醒',
    '',
    '<b>提醒格式：</b>',
    '<code>/remind 2026-05-08 15:30 开会</code>',
    '<code>/remind 10m 收衣服</code>',
    '<code>/remind 2h 看日志</code>',
  ].join('\n');
}

export function formatReminderCreated(reminder: Reminder): string {
  return [
    '<b>已创建提醒</b>',
    '',
    `时间：${formatTime(reminder.trigger_at)}`,
    `内容：${escapeHtml(reminder.text)}`,
  ].join('\n');
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
  return `提醒已推迟 5 分钟，新的提醒时间：${formatTime(reminder.trigger_at)}`;
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
