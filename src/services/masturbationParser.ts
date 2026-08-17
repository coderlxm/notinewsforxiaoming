import { z } from 'zod';
import { config } from '../config/index.js';
import { getDeepSeekClient, DEEPSEEK_MODEL } from '../ai/client.js';
import { bj, bjFormat } from '../utils/time.js';

export interface ParsedMasturbationInput {
  occurredAt: Date;
  note: string;
}

export interface ParseError {
  error: string;
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

function parseDeterministicTime(
  text: string,
  now: Date,
  referenceDate?: string,
): ParsedMasturbationInput | null {
  const match = text.trim().match(/^(\d{1,2})[:：](\d{2})(?:\s*([\s\S]*))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const occurredAt = new Date(
    `${referenceDate ?? bj(now).format('YYYY-MM-DD')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`,
  );
  if (isNaN(occurredAt.getTime()) || occurredAt > now) return null;
  return { occurredAt, note: (match[3] ?? '').trim() };
}

const masturbationInputSchema = z.object({
  invalid: z.boolean().default(false),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  time: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().default(null),
  note: z.string().default(''),
});

export async function parseMasturbationInput(
  text: string,
  now: Date,
  referenceDate?: string,
): Promise<ParsedMasturbationInput | ParseError> {
  const deterministic = parseDeterministicTime(text, now, referenceDate);
  if (deterministic) return deterministic;

  if (!config.deepseekApiKey) {
    return { error: '请使用 HH:mm 格式输入时间，例如：20:30 在卧室。' };
  }

  const openai = getDeepSeekClient();
  const beijingNow = bj(now);
  const defaultDate = referenceDate ?? beijingNow.format('YYYY-MM-DD');
  const prompt = `你是"撸了吗"记录解析器，用于把用户描述解析为一次撸的发生时间和备注。当前北京时间：${bjFormat(now, 'YYYY-MM-DD HH:mm')}。
只输出 JSON，不输出解释。

输入：${text}

如果用户是在记录一次撸（可能提到时间、地点、状态等备注），输出：
{
  "invalid": false,
  "date": "2026-08-17",
  "time": "20:30",
  "note": "在卧室"
}
要求：
- date 是发生日期 YYYY-MM-DD，未提日期时用本次提醒所属日期（${defaultDate}），提到"今天/昨天/前天/具体日期"时按当前北京时间用对应日期。
- time 是发生时刻 HH:mm，未提供时间时用当前时间 ${beijingNow.format('HH:mm')}。
- note 是用户备注，没有则为空字符串。

如果输入与记录撸这件事无关（例如提醒、查统计、闲聊），输出：
{
  "invalid": true
}`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: DEEPSEEK_MODEL,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    console.log('[parseMasturbationInput] raw AI:', raw);
    const parsed = extractJson(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return { error: '没有识别到有效内容，请重新输入。' };
    }

    const result = masturbationInputSchema.safeParse(parsed);
    if (!result.success) {
      console.log('[parseMasturbationInput] zod validation failed:', result.error.issues);
      return { error: '没有识别到有效内容，请重新输入。' };
    }
    if (result.data.invalid) {
      return { error: '无法识别为一次撸的记录，请重新输入实际时间和备注，例如：20:30 在卧室。' };
    }

    const date = result.data.date ?? defaultDate;
    const [hour, minute] = result.data.time?.split(':') ?? [beijingNow.format('HH'), beijingNow.format('mm')];
    const occurredAt = new Date(
      `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`,
    );
    if (isNaN(occurredAt.getTime()) || occurredAt > now) {
      return { error: '时间无效或晚于当前时间，请重新输入。' };
    }

    return { occurredAt, note: result.data.note.trim() };
  } catch (error) {
    console.error('Failed to parse masturbation input with DeepSeek:', error);
    return { error: '识别失败，请重新输入。' };
  }
}
