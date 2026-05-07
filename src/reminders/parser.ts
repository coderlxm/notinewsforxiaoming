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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
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

export async function parseNaturalReminder(
  text: string,
  now: Date
): Promise<ParsedReminder | ParseError> {
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
    });

    const raw = completion.choices[0]?.message?.content || '';
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
