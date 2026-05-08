import OpenAI from 'openai';
import { config } from '../config/index';
import { bjFormat } from '../utils/time';

export interface ParsedReminder {
  triggerAt: Date;
  text: string;
  source: 'deterministic' | 'ai';
}

export interface ParseError {
  error: string;
}

const helpText = '格式不正确。示例：\n/remind 2026-05-08 15:30 开会\n/remind 10m 收衣服\n/remind 2h 看日志';

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
  // Pattern 1: "N分/小时后提醒我XXX" or "N分/小时后XXX"
  // Group 1 = number, Group 2 = reminder text
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

  // Pattern 2: "半小时后提醒我XXX" or "半小时后XXX"
  // Group 1 = reminder text
  const halfHourMatch = text.match(/半小时[之以]?后(?:提醒我?)?\s*(.+)/);
  if (halfHourMatch && halfHourMatch[1]!.trim()) {
    return {
      triggerAt: new Date(now.getTime() + 30 * 60 * 1000),
      text: halfHourMatch[1]!.trim(),
      source: 'deterministic' as const,
    };
  }

  // Pattern 3: "提醒我XXX在N分钟后"  — Group 1 = text, Group 2 = number
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

export async function parseNaturalReminder(
  text: string,
  now: Date
): Promise<ParsedReminder | ParseError> {
  const deterministic = parseChineseRelative(text, now);
  if (deterministic) return deterministic;

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

输出格式：
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

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('intent' in parsed) ||
      !('trigger_at' in parsed) ||
      !('text' in parsed)
    ) {
      return { error: '没有识别到有效提醒时间。' };
    }

    const obj = parsed as Record<string, unknown>;

    if (obj.intent !== 'create_reminder') {
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
