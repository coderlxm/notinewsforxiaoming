export interface ParsedReminder {
  triggerAt: Date;
  text: string;
}

export interface ParseError {
  error: string;
}

const helpText = '格式不正确。示例：\n/remind 2026-05-08 15:30 开会\n/remind 10m 收衣服\n/remind 2h 看日志';

export function parseReminderCommand(input: string, now: Date): ParsedReminder | ParseError {
  const args = input.replace(/^\/remind\s*/, '').trim();

  if (!args) {
    return { error: helpText };
  }

  const absoluteMatch = args.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)/);
  if (absoluteMatch) {
    const [, date, time, text] = absoluteMatch;
    const triggerAt = new Date(`${date}T${time}:00+08:00`);
    if (isNaN(triggerAt.getTime())) {
      return { error: '时间格式无效，无法解析日期时间。' };
    }
    if (triggerAt <= now) {
      return { error: '提醒时间必须在未来。' };
    }
    if (!text?.trim()) {
      return { error: '提醒内容不能为空。' };
    }
    return { triggerAt, text: text.trim() };
  }

  const relativeMatch = args.match(/^(\d+)\s*(m|h)\s+(.+)/);
  if (relativeMatch) {
    const [, num, unit, text] = relativeMatch;
    const ms = parseInt(num!, 10) * (unit === 'h' ? 3600000 : 60000);
    const triggerAt = new Date(now.getTime() + ms);
    if (!text?.trim()) {
      return { error: '提醒内容不能为空。' };
    }
    return { triggerAt, text: text.trim() };
  }

  return { error: helpText };
}
