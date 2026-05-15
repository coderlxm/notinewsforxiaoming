import OpenAI from 'openai';
import Parser from 'rss-parser';
import type { Telegraf } from 'telegraf';
import { config } from '../config';
import { formatAvUpdateMessage } from '../formatters/avFormatter';
import { sendAvUpdateWithGallery } from '../publishers/avTelegram';
import {
  createPushHistory,
  findPushHistory,
  findTrackedTargets,
  markCoverSent,
  type TrackedTarget
} from './avRepository';
import {
  parseAvContent,
  pickBestMagnet,
} from './avContentParser';

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
interface TargetRunSummary {
  pushed: number;
  skipped: number;
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
  const forceResend = options.forceResend === true;

  async function processTarget(target: TrackedTarget): Promise<TargetRunSummary> {
    const startedAt = Date.now();
    const route = buildTargetRoute(target);
    let pushed = 0;
    let skipped = 0;

    console.log(`[av_update] [${route}] start`);
    const rssStartedAt = Date.now();
    const feed = await parser.parseURL(`http://localhost:1200/${route}`);
    console.log(`[av_update] [${route}] rss=${Date.now() - rssStartedAt}ms`);
    const recentItems = (feed.items || []).slice(0, 1) as FeedItemLike[];

    for (const item of recentItems) {
      const itemGuid = pickItemGuid(item);
      if (!itemGuid) {
        skipped += 1;
        continue;
      }

      const history = findPushHistory(target.id, itemGuid);
      if (!forceResend && history && history.cover_sent === 1) {
        skipped += 1;
        continue;
      }

      // Parse HTML content with cheerio
      const parseStartedAt = Date.now();
      const htmlContent = item.content || item.description || '';
      const parsed = parseAvContent(htmlContent);
      console.log(`[av_update] [${route}] parse=${Date.now() - parseStartedAt}ms`);

      const title = item.title?.trim() || '未知标题';
      const translateStartedAt = Date.now();
      const translatedTitle = await translateAvTitle(title);
      console.log(`[av_update] [${route}] translate=${Date.now() - translateStartedAt}ms`);

      // 仅保留规则选磁力，去掉额外 AI 调用
      const bestMagnet = pickBestMagnet(parsed.magnets);

      const message = formatAvUpdateMessage({
        targetName: target.name,
        targetType: target.target_type,
        title,
        translatedTitle,
        pubDate: item.pubDate?.trim() || null,
        link: item.link?.trim() || null,
        code: parsed.metadata.code,
        maker: parsed.metadata.maker,
        genres: parsed.metadata.genres,
        bestMagnet,
      });

      const coverUrl = parsed.coverUrl;
      const sendStartedAt = Date.now();
      const coverSent = await sendAvUpdateWithGallery(
        { message, coverUrl, sampleUrls: parsed.sampleImages },
        bot
      );
      console.log(`[av_update] [${route}] send=${Date.now() - sendStartedAt}ms`);

      if (!history) {
        createPushHistory(target.id, itemGuid, coverSent || !coverUrl);
      } else if (coverSent || !coverUrl) {
        markCoverSent(history.id);
      }

      pushed += 1;
    }

    console.log(
      `[av_update] [${route}] done total=${Date.now() - startedAt}ms pushed=${pushed} skipped=${skipped}`
    );
    return { pushed, skipped };
  }

  // 并行处理各目标，缩短命令总耗时
  const results = await Promise.all(targets.map((target) => processTarget(target)));
  const pushed = results.reduce((sum, current) => sum + current.pushed, 0);
  const skipped = results.reduce((sum, current) => sum + current.skipped, 0);

  return {
    pushed,
    skipped,
    checkedTargets: targets.length,
  };
}
