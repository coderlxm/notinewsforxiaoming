import OpenAI from 'openai';
import { config } from '../config/index';

export interface ParsedReminder {
  triggerAt: Date;
  text: string;
}

export interface ParseError {
  error: string;
}

const helpText = '格式不正确。示例：\n/remind 2026-05-08 15:30 开会\n/remind 10m 收衣服\n/remind 2h 看日志';

function formatBeijingTime(date: Date): string {
  const offsetMs = 8 * 60 * 60 * 1000;
  const beijing = new Date(date.getTime() + offsetMs);
  const year = beijing.getUTCFullYear();
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijing.getUTCDate()).padStart(2, '0');
  const hour = String(beijing.getUTCHours()).padStart(2, '0');
  const minute = String(beijing.getUTCMinutes()).padStart(2, '0');
  const second = String(beijing.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

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

function parseChineseRelative(text: string, now: Date): ParsedReminder | null {
  const patterns = [
    /(\d+)\s*分钟[之以]?后[提醒]?我?\s*(.+)/,
    /(\d+)\s*小时[之以]?后[提醒]?我?\s*(.+)/,
    /半\s*小时[之以]?后[提醒]?我?\s*(.+)/,
    /(\d+)\s*秒[钟之以]?后[提醒]?我?\s*(.+)/,
    /提醒\s*我\s*(.+?)\s*在\s*(\d+)\s*分钟[之以]?后/,
    /(.+?)\s*在\s*(\d+)\s*分钟[之以]?后/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    let ms = 0;
    let reminderText = '';

    if (pattern.source.includes('半小时')) {
      ms = 30 * 60 * 1000;
      reminderText = match[1]!.trim();
    } else if (pattern.source.includes('提醒')) {
      // Pattern: 提醒我XXX在N分钟后 → text=group1, num=group2
      const [numStr, txt] = [match[2], match[1]];
      ms = parseInt(numStr!, 10) * 60 * 1000;
      reminderText = txt!.trim();
    } else {
      const numStr = match[1]!;
      const unit = pattern.source.includes('小时') ? 3600000 : pattern.source.includes('秒') ? 1000 : 60000;
      ms = parseInt(numStr, 10) * unit;
      reminderText = match[2]!.trim();
    }

    if (!reminderText || ms <= 0) continue;
    return { triggerAt: new Date(now.getTime() + ms), text: reminderText };
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

  const beijingTime = formatBeijingTime(now);

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

    return { triggerAt, text: reminderText };
  } catch (error) {
    console.error('Failed to parse natural reminder with DeepSeek:', error);
    return { error: '没有识别到有效提醒时间。' };
  }
}
