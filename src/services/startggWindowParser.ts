import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../config';
import { bjFormat } from '../utils/time';
import { fetchEventMeta, normalizeEventSlug } from './startggTracker';
import type { StartggTournamentWindow } from './startggPresetConfig';

const startggWindowSchema = z.object({
  name: z.string().min(1),
  start_at: z.string().min(1),
  end_at: z.string().min(1),
  timezone: z.string().min(1),
  events: z.array(z.object({
    event_slug: z.string().min(1),
    event_name: z.string().min(1),
  })).min(1),
});

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw.trim()) as unknown;
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!match) {
      throw new Error('模型返回不是合法 JSON。');
    }
    return JSON.parse(match[1]!.trim()) as unknown;
  }
}

export async function parseTournamentWindowFromNaturalLanguage(
  input: string,
  now: Date,
): Promise<StartggTournamentWindow> {
  if (!config.deepseekApiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置。');
  }
  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey,
  });

  const nowText = bjFormat(now, 'YYYY-MM-DD HH:mm:ss');
  const prompt = `你是 start.gg 赛事窗口解析器。当前北京时间：${nowText}。
只输出 JSON 对象，不输出解释，不输出 markdown。

用户输入：
${input}

输出格式必须是：
{
  "name": "赛事窗口名",
  "start_at": "2026-06-15T00:00:00+08:00",
  "end_at": "2026-06-19T00:00:00+08:00",
  "timezone": "Asia/Shanghai",
  "events": [
    {
      "event_slug": "tournament/xxx/event/yyy",
      "event_name": "可读名"
    }
  ]
}

约束：
1. start_at/end_at 必须是 ISO8601 且包含时区偏移（+08:00）。
2. end_at 必须晚于 start_at。
3. 至少输出 1 个 event。
4. event_slug 只能是 tournament/.../event/... 结构。`;

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'deepseek-v4-flash',
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content || '';
  const parsed = startggWindowSchema.parse(extractJson(raw));

  const start = new Date(parsed.start_at);
  const end = new Date(parsed.end_at);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('解析失败：start_at 或 end_at 不是有效时间。');
  }
  if (start.getTime() >= end.getTime()) {
    throw new Error('解析失败：start_at 必须早于 end_at。');
  }

  const normalizedEvents: Array<{ event_slug: string; event_name: string }> = [];
  for (const event of parsed.events) {
    const normalizedSlug = normalizeEventSlug(event.event_slug);
    const meta = await fetchEventMeta(normalizedSlug);
    normalizedEvents.push({
      event_slug: meta.slug,
      event_name: meta.tournamentName ? `${meta.tournamentName} / ${meta.name}` : meta.name,
    });
  }

  return {
    name: parsed.name,
    start_at: parsed.start_at,
    end_at: parsed.end_at,
    timezone: parsed.timezone,
    events: normalizedEvents,
  };
}
