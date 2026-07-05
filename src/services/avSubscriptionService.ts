import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { parseAvContent } from './avContentParser.js';
import {
  buildAvTargetRoute,
  buildAvTargetUrl,
  type AvTargetType,
} from './avTargets.js';

interface FeedItemLike {
  content?: string;
  description?: string;
}

interface ParsedAvSubscriptionUrl {
  targetType: AvTargetType;
  targetId: string;
  url: string;
}

export interface ResolvedAvSubscription {
  name: string;
  targetType: AvTargetType;
  targetId: string;
  url: string;
}

const parser = new Parser();

function isSupportedJavBusHost(hostname: string): boolean {
  return hostname === 'javbus.com' || hostname === 'www.javbus.com';
}

function normalizeTargetId(rawTargetId: string): string {
  const targetId = rawTargetId.trim();
  if (!targetId) {
    throw new Error('JavBus 订阅链接缺少目标 ID。');
  }
  return targetId;
}

export function parseAvSubscriptionUrl(rawUrl: string): ParsedAvSubscriptionUrl {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    throw new Error('请提供完整的 JavBus 链接。');
  }

  if (!isSupportedJavBusHost(parsedUrl.hostname)) {
    throw new Error('只支持 JavBus 链接。');
  }

  const parts = parsedUrl.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new Error('只支持 /star/<id>、/series/<id>、/studio/<id>、/label/<id> 这类 JavBus 链接。');
  }

  const [rawTargetType, rawTargetId] = parts;
  if (
    rawTargetType !== 'star' &&
    rawTargetType !== 'series' &&
    rawTargetType !== 'studio' &&
    rawTargetType !== 'label'
  ) {
    throw new Error('当前只支持 star、series、studio、label 四类 JavBus 订阅链接。');
  }

  const targetType: AvTargetType = rawTargetType;
  const targetId = normalizeTargetId(rawTargetId ?? '');

  return {
    targetType,
    targetId,
    url: buildAvTargetUrl(targetType, targetId),
  };
}

function extractStarName(html: string): string | null {
  const $ = cheerio.load(html);
  const directName = $('.star-name a').first().text().trim();
  if (directName) {
    return directName;
  }

  const fallbackName = $('a[href*="/star/"]').first().text().trim();
  return fallbackName || null;
}

function extractSubscriptionName(targetType: AvTargetType, item: FeedItemLike): string | null {
  const html = item.content || item.description || '';
  if (!html.trim()) {
    return null;
  }

  if (targetType === 'star') {
    return extractStarName(html);
  }

  const parsed = parseAvContent(html);
  switch (targetType) {
    case 'series':
      return parsed.metadata.series?.trim() || null;
    case 'studio':
      return parsed.metadata.maker?.trim() || null;
    case 'label':
      return parsed.metadata.publisher?.trim() || null;
    case 'star':
      return null;
  }
}

export async function resolveAvSubscription(rawUrl: string): Promise<ResolvedAvSubscription> {
  const parsed = parseAvSubscriptionUrl(rawUrl);
  const route = buildAvTargetRoute(parsed.targetType, parsed.targetId);
  const feed = await parser.parseURL(`http://localhost:1200/${route}`);
  const firstItem = (feed.items || [])[0] as FeedItemLike | undefined;

  if (!firstItem) {
    throw new Error(`AV 订阅探测失败：${route} 没有返回作品数据。`);
  }

  const name = extractSubscriptionName(parsed.targetType, firstItem);
  if (!name) {
    throw new Error(`AV 订阅探测失败：无法从 ${route} 提取订阅名称。`);
  }

  return {
    name,
    targetType: parsed.targetType,
    targetId: parsed.targetId,
    url: parsed.url,
  };
}
