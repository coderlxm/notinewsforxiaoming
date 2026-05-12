import OpenAI from 'openai';
import Parser from 'rss-parser';
import type { Telegraf } from 'telegraf';
import { config } from '../config';
import { formatAvUpdateMessage } from '../formatters/avFormatter';
import { sendAvUpdate } from '../publishers/avTelegram';
import {
  createPushHistory,
  findPushHistory,
  findTrackedTargets,
  markCoverSent,
  type TrackedTarget
} from './avRepository';

interface FeedItemLike {
  guid?: string;
  id?: string;
  link?: string;
  title?: string;
  pubDate?: string;
  content?: string;
  description?: string;
}

export interface AvFetchSummary {
  pushed: number;
  skipped: number;
  checkedTargets: number;
}

interface RunAvFetchOptions {
  forceResend?: boolean;
}

const parser = new Parser();

function buildTargetRoute(target: TrackedTarget): string {
  if (target.target_type === 'label') {
    return `javbus/label/${target.target_id}`;
  }
  return `javbus/star/${target.target_id}`;
}

function pickItemGuid(item: FeedItemLike): string | null {
  const guid = item.guid || item.id || item.link || item.title;
  if (!guid) return null;
  return String(guid).trim() || null;
}

function extractCoverUrl(content?: string, description?: string): string | null {
  const raw = content || description;
  if (!raw) return null;

  // Unescape common HTML entities that might break regex
  const unescaped = raw
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  // 1. Try to find the "bigImage" link first (it usually contains the high-quality cover)
  // Matching something like: <a ... class="bigImage" ... href="URL" ...> or <a ... href="URL" ... class="bigImage" ...>
  const bigImageMatch = unescaped.match(/<a[^>]+class=["'][^"']*bigImage[^"']*["'][^>]+href=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) 
    || unescaped.match(/<a[^>]+href=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["'][^>]+class=["'][^"']*bigImage[^"']*["']/i);
  
  if (bigImageMatch?.[1]) return bigImageMatch[1];

  // 2. Fallback to the first available image src
  const anyImgMatch = unescaped.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  if (anyImgMatch?.[1]) return anyImgMatch[1];

  return null;
}

async function translateAvTitle(title: string): Promise<string | null> {
  if (!config.deepseekApiKey) return null;

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = [
    '请把下面这个 AV 作品标题翻译成简体中文。',
    '只输出翻译后的标题本身，不要解释，不要加引号。',
    '',
    title
  ].join('\n');

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });
    const output = completion.choices[0]?.message?.content?.trim();
    return output || null;
  } catch (error) {
    console.error('Failed to translate AV title with DeepSeek:', error);
    return null;
  }
}

export async function runAvFetchOnce(
  bot?: Telegraf,
  options: RunAvFetchOptions = {}
): Promise<AvFetchSummary> {
  const targets = findTrackedTargets();
  let pushed = 0;
  let skipped = 0;
  const forceResend = options.forceResend === true;

  for (const target of targets) {
    const route = buildTargetRoute(target);
    const feed = await parser.parseURL(`http://localhost:1200/${route}`);
    const recentItems = (feed.items || []).slice(0, 1) as FeedItemLike[];

    for (const item of recentItems) {
      const itemGuid = pickItemGuid(item);
      if (!itemGuid) {
        skipped += 1;
        continue;
      }
      const coverUrl = extractCoverUrl(item.content, item.description);
      const history = findPushHistory(target.id, itemGuid);
      if (!forceResend && history && history.cover_sent === 1) {
        skipped += 1;
        continue;
      }

      const title = item.title?.trim() || '未知标题';
      const translatedTitle = await translateAvTitle(title);
      const message = formatAvUpdateMessage({
        targetName: target.name,
        targetType: target.target_type,
        title,
        translatedTitle,
        pubDate: item.pubDate?.trim() || null,
        link: item.link?.trim() || null,
      });

      const coverSent = await sendAvUpdate({ message, coverUrl }, bot);

      if (!history) {
        createPushHistory(target.id, itemGuid, coverSent || !coverUrl);
      } else if (coverSent || !coverUrl) {
        markCoverSent(history.id);
      }

      pushed += 1;
    }
  }

  return {
    pushed,
    skipped,
    checkedTargets: targets.length,
  };
}
