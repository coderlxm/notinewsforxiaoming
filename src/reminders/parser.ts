import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../config/index';
import { bjFormat } from '../utils/time';
import type { RecurrenceSpec } from './recurring';

export interface ParsedReminder {
  triggerAt: Date;
  text: string;
  source: 'deterministic' | 'ai';
}

export interface ParsedRecurringReminder {
  spec: RecurrenceSpec;
  text: string;
  source: 'deterministic' | 'ai';
}

export interface ParseError {
  error: string;
}

const helpText = '格式不正确。示例：\n/remind 2026-05-08 15:30 开会\n/remind 10m 收衣服\n/remind 2h 看日志\n/remind every day 22:00 做俯卧撑';

function extractJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw.trim());
  } catch {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]!.trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}

const DAY_MAP: Record<string, string> = {
  mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU',
  monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH', friday: 'FR', saturday: 'SA', sunday: 'SU',
};

export function parseRecurringCommand(args: string, _now: Date): ParsedRecurringReminder | ParseError | null {
  if (!args) return null;

  const everyDayMatch = args.match(/^every\s+day\s+(\d{2}:\d{2})\s+(.+)/);
  if (everyDayMatch) {
    const [, time, text] = everyDayMatch;
    if (!text?.trim()) return { error: '提醒内容不能为空。' };
    return {
      spec: { freq: 'DAILY', byweekday: [], bymonthday: [], time: time!, timezone: 'Asia/Shanghai' },
      text: text.trim(),
      source: 'deterministic',
    };
  }

  const everyWeekMatch = args.match(/^every\s+week\s+([a-zA-Z,\s]+?)\s+(\d{2}:\d{2})\s+(.+)/);
  if (everyWeekMatch) {
    const [, daysStr, time, text] = everyWeekMatch;
    const byweekday = daysStr!.split(/[,，\s]+/).filter(Boolean).map(d => {
      const mapped = DAY_MAP[d.toLowerCase().trim()];
      if (!mapped) throw new Error(`Invalid weekday: ${d}`);
      return mapped;
    });
    if (byweekday.length === 0) return { error: '请指定至少一个星期几。如: mon,wed,fri' };
    if (!text?.trim()) return { error: '提醒内容不能为空。' };
    return {
      spec: { freq: 'WEEKLY', byweekday, bymonthday: [], time: time!, timezone: 'Asia/Shanghai' },
      text: text.trim(),
      source: 'deterministic',
    };
  }

  const everyMonthMatch = args.match(/^every\s+month\s+(\d{1,2})\s+(\d{2}:\d{2})\s+(.+)/);
  if (everyMonthMatch) {
    const [, day, time, text] = everyMonthMatch;
    const dayNum = parseInt(day!, 10);
    if (dayNum < 1 || dayNum > 31) return { error: '日期必须在 1-31 之间。' };
    if (!text?.trim()) return { error: '提醒内容不能为空。' };
    return {
      spec: { freq: 'MONTHLY', byweekday: [], bymonthday: [dayNum], time: time!, timezone: 'Asia/Shanghai' },
      text: text.trim(),
      source: 'deterministic',
    };
  }

  return null;
}

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
    return { triggerAt, text: text.trim(), source: 'deterministic' };
  }

  const relativeMatch = args.match(/^(\d+)\s*(m|h)\s+(.+)/);
  if (relativeMatch) {
    const [, num, unit, text] = relativeMatch;
    const ms = parseInt(num!, 10) * (unit === 'h' ? 3600000 : 60000);
    const triggerAt = new Date(now.getTime() + ms);
    if (!text?.trim()) {
      return { error: '提醒内容不能为空。' };
    }
    return { triggerAt, text: text.trim(), source: 'deterministic' };
  }

  return { error: helpText };
}

function parseChineseRelative(text: string, now: Date): ParsedReminder | null {
  const primaryMatch = text.match(/(\d+)\s*(分钟|小时|秒钟?)?[之以]?后(?:提醒我?)?\s*(.+)/);
  if (primaryMatch) {
    const num = parseInt(primaryMatch[1]!, 10);
    const unit = (primaryMatch[2] || '分钟') as string;
    const reminderText = primaryMatch[3]!.trim();
    if (reminderText && num > 0) {
      const multipliers: Record<string, number> = { 秒: 1000, 秒钟: 1000, 分钟: 60000, 小时: 3600000 };
      const ms = num * (multipliers[unit] || 60000);
      return { triggerAt: new Date(now.getTime() + ms), text: reminderText, source: 'deterministic' };
    }
  }

  const halfHourMatch = text.match(/半小时[之以]?后(?:提醒我?)?\s*(.+)/);
  if (halfHourMatch && halfHourMatch[1]!.trim()) {
    return {
      triggerAt: new Date(now.getTime() + 30 * 60 * 1000),
      text: halfHourMatch[1]!.trim(),
      source: 'deterministic' as const,
    };
  }

  const remindBeforeMatch = text.match(/提醒\s*我\s*(.+?)\s*在\s*(\d+)\s*分钟[之以]?后/);
  if (remindBeforeMatch) {
    const num = parseInt(remindBeforeMatch[2]!, 10);
    const reminderText = remindBeforeMatch[1]!.trim();
    if (reminderText && num > 0) {
      return { triggerAt: new Date(now.getTime() + num * 60000), text: reminderText, source: 'deterministic' };
    }
  }

  return null;
}

function normalizeHourByPeriod(period: string | undefined, hour: number): number {
  if (!period) return hour;
  if (period === '下午' || period === '晚上') {
    if (hour < 12) return hour + 12;
    return hour;
  }
  if (period === '凌晨') {
    if (hour === 12) return 0;
    return hour;
  }
  if (period === '中午') {
    if (hour >= 1 && hour <= 10) return hour + 12;
    return hour;
  }
  return hour;
}

function parseChineseDailyRecurring(text: string): ParsedRecurringReminder | null {
  const normalized = text.replace(/\s+/g, '');
  const match = normalized.match(/^每(?:天|日)(?:早上|上午|中午|下午|晚上|凌晨)?\d{1,2}(?:点|:|：)\d{1,2}分?(?:提醒我?)?.+$/);
  if (!match) return null;

  const detailMatch = normalized.match(/^每(?:天|日)(早上|上午|中午|下午|晚上|凌晨)?(\d{1,2})(?:点|:|：)(\d{1,2})分?(?:提醒我?)?(.+)$/);
  if (!detailMatch) return null;

  const [, period, hourRaw, minuteRaw, reminderTextRaw] = detailMatch;
  const minute = parseInt(minuteRaw!, 10);
  const hourBase = parseInt(hourRaw!, 10);
  const hour = normalizeHourByPeriod(period, hourBase);
  const reminderText = reminderTextRaw?.trim() || '';

  if (!reminderText) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  return {
    spec: {
      freq: 'DAILY',
      byweekday: [],
      bymonthday: [],
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      timezone: 'Asia/Shanghai',
    },
    text: reminderText,
    source: 'deterministic',
  };
}

const recurrenceSchema = z.object({
  intent: z.literal('create_recurring_reminder'),
  recurrence: z.object({
    freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    byweekday: z.array(z.string()),
    bymonthday: z.array(z.number()),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string(),
  }),
  text: z.string().min(1),
});

export async function parseNaturalReminder(
  text: string,
  now: Date
): Promise<ParsedReminder | ParsedRecurringReminder | ParseError> {
  const deterministic = parseChineseRelative(text, now);
  if (deterministic) return deterministic;
  const recurringDeterministic = parseChineseDailyRecurring(text);
  if (recurringDeterministic) return recurringDeterministic;

  if (!config.deepseekApiKey) {
    return { error: 'AI 解析未配置，请使用 /remind 命令格式创建提醒。' };
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const beijingTime = bjFormat(now, 'YYYY-MM-DD HH:mm:ss');

  const prompt = `你是提醒解析器。当前北京时间：${beijingTime}。
只输出 JSON，不输出解释。

输入：${text}

如果用户想要创建循环/重复提醒（如每天、每周、每月），输出：
{
  "intent": "create_recurring_reminder",
  "recurrence": {
    "freq": "DAILY",
    "byweekday": [],
    "bymonthday": [],
    "time": "22:00",
    "timezone": "Asia/Shanghai"
  },
  "text": "做俯卧撑"
}

如果用户想要一次性提醒，输出：
{
  "intent": "create_reminder",
  "trigger_at": "2026-05-07T21:20:00+08:00",
  "text": "收衣服"
}`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    console.log('[parseNaturalReminder] raw AI:', raw);
    const parsed = extractJson(raw);

    if (typeof parsed !== 'object' || parsed === null || !('intent' in parsed)) {
      return { error: '没有识别到有效提醒时间。' };
    }

    const obj = parsed as Record<string, unknown>;

    if (obj.intent === 'create_recurring_reminder') {
      const result = recurrenceSchema.safeParse(parsed);
      if (!result.success) {
        console.log('[parseNaturalReminder] zod validation failed:', result.error.issues);
        return { error: '没有识别到有效的循环提醒格式。' };
      }
      const { recurrence, text: reminderText } = result.data;
      return {
        spec: {
          freq: recurrence.freq,
          byweekday: recurrence.byweekday,
          bymonthday: recurrence.bymonthday,
          time: recurrence.time,
          timezone: recurrence.timezone,
        },
        text: reminderText,
        source: 'ai',
      };
    }

    if (obj.intent !== 'create_reminder') {
      return { error: '没有识别到有效提醒时间。' };
    }

    if (!('trigger_at' in obj) || !('text' in obj)) {
      return { error: '没有识别到有效提醒时间。' };
    }

    const triggerAt = new Date(String(obj.trigger_at));
    if (isNaN(triggerAt.getTime())) {
      return { error: '没有识别到有效提醒时间。' };
    }
    if (triggerAt <= now) {
      return { error: '提醒时间必须在未来。' };
    }

    const reminderText = String(obj.text).trim();
    if (!reminderText) {
      return { error: '没有识别到有效提醒时间。' };
    }

    return { triggerAt, text: reminderText, source: 'ai' };
  } catch (error) {
    console.error('Failed to parse natural reminder with DeepSeek:', error);
    return { error: '没有识别到有效提醒时间。' };
  }
}
