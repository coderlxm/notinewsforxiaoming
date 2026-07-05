import OpenAI from 'openai';
import Parser from 'rss-parser';
import type { Telegraf } from 'telegraf';
import { createBot } from '../bot/createBot.js';
import { config } from '../config/index.js';
import { formatAvLabelSummaryMessage, formatAvUpdateMessage } from '../formatters/avFormatter.js';
import { sendAvUpdate } from '../publishers/avTelegram.js';
import { sendTelegramMessage } from '../publishers/telegram.js';
import {
  buildAvTargetRoute,
  buildAvTargetUrl,
  isAvBatchTarget,
} from './avTargets.js';
import {
  findAvSourceHealth,
  createPushBatchHistory,
  createPushHistory,
  findPushBatchHistory,
  findPushHistory,
  findTrackedTargets,
  markAvSourceRecovered,
  markCoverSent,
  updateAvSourceLastAlertAt,
  upsertAvSourceDown,
  type TrackedTarget
} from './avRepository.js';
import {
  parseAvContent,
  pickBestMagnet,
} from './avContentParser.js';

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
  healthNotify?: boolean;
  avSendMode?: 'cover' | 'gallery';
  targets?: TrackedTarget[];
  skipBatchTargetDelay?: boolean;
}

const parser = new Parser();
const AV_LABEL_FETCH_LIMIT = 30;
const AV_LABEL_SUMMARY_TOPK = 10;
const AV_SOURCE_ALERT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LABEL_DELAY_MIN_MS = 5000;
const LABEL_DELAY_MAX_MS = 10000;

function pickItemGuid(item: FeedItemLike): string | null {
  const guid = item.guid || item.id || item.link || item.title;
  if (!guid) return null;
  return String(guid).trim() || null;
}

function toBatchDate(item: FeedItemLike, releaseDate: string | null): string {
  if (releaseDate && releaseDate.trim()) {
    return releaseDate.trim();
  }
  if (item.pubDate) {
    const date = new Date(item.pubDate);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function getErrorType(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  const message = error.message || '';
  if (message.includes('Status code 503')) return 'HTTP_503';
  if (message.includes('Status code 404')) return 'HTTP_404';
  if (message.includes('timed out')) return 'Timeout';
  return error.name || 'Error';
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.message || error.name || 'Unknown error';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TargetFailure {
  target: TrackedTarget;
  route: string;
  errorType: string;
  errorMessage: string;
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

async function translateLabelTitlesBatch(titles: string[]): Promise<string[]> {
  if (titles.length === 0) return [];
  if (!config.deepseekApiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set.');
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const numbered = titles.map((title, index) => `${index + 1}. ${title}`).join('\n');
  const prompt = [
    '请把下面这些 AV 作品标题翻译成简体中文。',
    '要求：',
    '1) 只返回 json 对象',
    '2) json 对象格式为 {"titles":["..."]}',
    '3) titles 数组长度必须和输入数量一致',
    '4) 每个元素是对应序号标题的中文翻译',
    '5) 不要输出任何解释',
    '',
    numbered,
  ].join('\n');

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'deepseek-v4-flash',
    response_format: { type: 'json_object' },
  });
  const output = completion.choices[0]?.message?.content?.trim();
  if (!output) {
    throw new Error('DeepSeek returned empty translation result for label titles.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error(`Invalid JSON from DeepSeek label batch translation: ${output}`);
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { titles?: unknown }).titles) ||
    (parsed as { titles: unknown[] }).titles.length !== titles.length ||
    (parsed as { titles: unknown[] }).titles.some((item) => typeof item !== 'string')
  ) {
    throw new Error(`Unexpected translation array shape from DeepSeek: ${output}`);
  }
  return (parsed as { titles: string[] }).titles;
}

export async function runAvFetchOnce(
  bot?: Telegraf,
  options: RunAvFetchOptions = {}
): Promise<AvFetchSummary> {
  const targets = options.targets ?? findTrackedTargets();
  const forceResend = options.forceResend === true;
  const healthNotify = options.healthNotify !== false;
  const avSendMode = options.avSendMode ?? 'gallery';
  const skipBatchTargetDelay = options.skipBatchTargetDelay === true;
  let senderInstance = bot ?? null;

  function getSender(): Telegraf {
    if (senderInstance) {
      return senderInstance;
    }
    senderInstance = createBot();
    return senderInstance;
  }

  async function processStarTarget(target: TrackedTarget): Promise<TargetRunSummary> {
    const startedAt = Date.now();
    const route = buildAvTargetRoute(target.target_type, target.target_id);
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
      const coverSent = await sendAvUpdate({
        message,
        coverUrl,
        sampleUrls: parsed.sampleImages,
        mode: avSendMode,
      }, getSender());
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

  async function processLabelTarget(target: TrackedTarget): Promise<TargetRunSummary> {
    const startedAt = Date.now();
    const route = buildAvTargetRoute(target.target_type, target.target_id);
    let pushed = 0;
    let skipped = 0;

    console.log(`[av_update] [${route}] start`);
    const rssStartedAt = Date.now();
    const feed = await parser.parseURL(`http://localhost:1200/${route}`);
    console.log(`[av_update] [${route}] rss=${Date.now() - rssStartedAt}ms`);
    const recentItems = (feed.items || []).slice(0, AV_LABEL_FETCH_LIMIT) as FeedItemLike[];

    const parsedItems = recentItems.map((item) => {
      const parseStartedAt = Date.now();
      const htmlContent = item.content || item.description || '';
      const parsed = parseAvContent(htmlContent);
      console.log(`[av_update] [${route}] parse=${Date.now() - parseStartedAt}ms`);
      const guid = pickItemGuid(item);
      const title = item.title?.trim() || '未知标题';
      const batchDate = toBatchDate(item, parsed.metadata.releaseDate);
      return {
        guid,
        title,
        link: item.link?.trim() || null,
        batchDate,
      };
    }).filter((item) => item.guid);

    if (parsedItems.length === 0) {
      skipped += AV_LABEL_FETCH_LIMIT;
      console.log(
        `[av_update] [${route}] done total=${Date.now() - startedAt}ms pushed=${pushed} skipped=${skipped}`
      );
      return { pushed, skipped };
    }

    const effectiveItems = forceResend
      ? parsedItems
      : parsedItems.filter((item) => !findPushHistory(target.id, item.guid as string));
    skipped += parsedItems.length - effectiveItems.length;

    if (effectiveItems.length === 0) {
      console.log(
        `[av_update] [${route}] done total=${Date.now() - startedAt}ms pushed=${pushed} skipped=${skipped}`
      );
      return { pushed, skipped };
    }

    const latestBatchDate = effectiveItems[0].batchDate;
    const latestBatchItems = effectiveItems.filter((item) => item.batchDate === latestBatchDate);
    const dedupeKey = `javbus:${target.target_type}:${target.target_id}:${latestBatchDate}`;
    if (!forceResend && findPushBatchHistory(dedupeKey)) {
      skipped += latestBatchItems.length;
      console.log(
        `[av_update] [${route}] done total=${Date.now() - startedAt}ms pushed=${pushed} skipped=${skipped}`
      );
      return { pushed, skipped };
    }

    const visibleItems = latestBatchItems.slice(0, AV_LABEL_SUMMARY_TOPK);
    const translateStartedAt = Date.now();
    const translatedTitles = await translateLabelTitlesBatch(visibleItems.map((item) => item.title));
    console.log(`[av_update] [${route}] translate=${Date.now() - translateStartedAt}ms`);
    const summaryItems = visibleItems.map((item, index) => ({
      title: translatedTitles[index] || '未知标题',
      link: item.link,
    }));
    const summaryMessage = formatAvLabelSummaryMessage({
      targetName: target.name,
      targetType: target.target_type,
      latestDate: latestBatchDate,
      totalNewCount: latestBatchItems.length,
      items: summaryItems,
      remainingCount: Math.max(0, latestBatchItems.length - summaryItems.length),
      targetLink: buildAvTargetUrl(target.target_type, target.target_id),
    });

    const sendStartedAt = Date.now();
    await sendTelegramMessage(summaryMessage, getSender());
    console.log(`[av_update] [${route}] send=${Date.now() - sendStartedAt}ms`);

    latestBatchItems.forEach((item) => {
      const history = findPushHistory(target.id, item.guid as string);
      if (!history) {
        createPushHistory(target.id, item.guid as string, true);
      } else {
        markCoverSent(history.id);
      }
    });
    createPushBatchHistory(dedupeKey);

    pushed += latestBatchItems.length;
    console.log(
      `[av_update] [${route}] done total=${Date.now() - startedAt}ms pushed=${pushed} skipped=${skipped}`
    );
    return { pushed, skipped };
  }

  function markSourceUp(sourceKey: string): void {
    markAvSourceRecovered(sourceKey);
  }

  function markSourceDown(target: TrackedTarget, errorType: string, errorMessage: string): void {
    const sourceKey = `javbus:${target.target_type}:${target.target_id}`;
    upsertAvSourceDown(sourceKey, errorType, errorMessage);
  }

  async function maybeSendGlobalFailureAlert(failures: TargetFailure[]): Promise<void> {
    if (!healthNotify || failures.length < 2) return;
    const sourceKey = 'javbus:global';
    const health = findAvSourceHealth(sourceKey);
    const now = Date.now();
    const lastAlertAt = health?.last_alert_at ? new Date(health.last_alert_at).getTime() : 0;
    const shouldAlert = !health || !health.last_alert_at || (now - lastAlertAt) >= AV_SOURCE_ALERT_INTERVAL_MS;
    upsertAvSourceDown(
      sourceKey,
      'ALL_TARGETS_FAILED',
      failures.map((item) => `${item.route}:${item.errorType}`).join(' | ')
    );
    if (!shouldAlert) return;

    const alert = [
      'AV 源站异常（双路失败）',
      ...failures.map((item) => `目标：${item.route} | 类型：${item.errorType} | 错误：${item.errorMessage}`),
    ].join('\n');
    await sendTelegramMessage(alert, getSender());
    updateAvSourceLastAlertAt(sourceKey);
  }

  async function processTargetWithHealth(
    target: TrackedTarget
  ): Promise<{ summary: TargetRunSummary; failure: TargetFailure | null }> {
    const route = buildAvTargetRoute(target.target_type, target.target_id);
    const sourceKey = `javbus:${target.target_type}:${target.target_id}`;
    try {
      const result = isAvBatchTarget(target.target_type)
        ? await processLabelTarget(target)
        : await processStarTarget(target);
      markSourceUp(sourceKey);
      return { summary: result, failure: null };
    } catch (error) {
      console.error(`[av_update] [${route}] failed:`, error);
      const errorType = getErrorType(error);
      const errorMessage = getErrorMessage(error);
      markSourceDown(target, errorType, errorMessage);
      return {
        summary: { pushed: 0, skipped: 0 },
        failure: { target, route, errorType, errorMessage },
      };
    }
  }

  const starTargets = targets.filter((target) => !isAvBatchTarget(target.target_type));
  const labelTargets = targets.filter((target) => isAvBatchTarget(target.target_type));
  const results: Array<{ summary: TargetRunSummary; failure: TargetFailure | null }> = [];

  for (const target of starTargets) {
    results.push(await processTargetWithHealth(target));
  }
  if (labelTargets.length > 0) {
    if (!skipBatchTargetDelay) {
      const delay = LABEL_DELAY_MIN_MS + Math.floor(Math.random() * (LABEL_DELAY_MAX_MS - LABEL_DELAY_MIN_MS + 1));
      console.log(`[av_update] delay before label targets: ${delay}ms`);
      await sleep(delay);
    }
    for (const target of labelTargets) {
      results.push(await processTargetWithHealth(target));
    }
  }

  const failures = results.map((item) => item.failure).filter((item): item is TargetFailure => item !== null);
  await maybeSendGlobalFailureAlert(failures);

  const pushed = results.reduce((sum, current) => sum + current.summary.pushed, 0);
  const skipped = results.reduce((sum, current) => sum + current.summary.skipped, 0);

  return {
    pushed,
    skipped,
    checkedTargets: targets.length,
  };
}
