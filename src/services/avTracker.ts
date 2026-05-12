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
  description?: string;
}

export interface AvFetchSummary {
  pushed: number;
  skipped: number;
  checkedTargets: number;
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

function extractCoverUrl(description?: string): string | null {
  if (!description) return null;

  const bigImageHref = description.match(/class=["']bigImage["'][^>]*href=["'](https?:\/\/[^"']+)["']/i);
  if (bigImageHref?.[1]) return bigImageHref[1];

  const imgSrc = description.match(/<img[^>]*src=["'](https?:\/\/[^"']+)["']/i);
  if (imgSrc?.[1]) return imgSrc[1];

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

export async function runAvFetchOnce(bot?: Telegraf): Promise<AvFetchSummary> {
  const targets = findTrackedTargets();
  let pushed = 0;
  let skipped = 0;

  for (const target of targets) {
    const route = buildTargetRoute(target);
    const feed = await parser.parseURL(`http://localhost:1200/${route}`);
    const recentItems = (feed.items || []).slice(0, 5) as FeedItemLike[];

    for (const item of recentItems) {
      const itemGuid = pickItemGuid(item);
      if (!itemGuid) {
        skipped += 1;
        continue;
      }
      const coverUrl = extractCoverUrl(item.description);
      const history = findPushHistory(target.id, itemGuid);
      if (history && history.cover_sent === 1) {
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
