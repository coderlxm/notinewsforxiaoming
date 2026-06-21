import type { Telegraf } from 'telegraf';
import { summarizeV2exWithAI } from '../ai/deepseek.js';
import type { V2exTopic } from '../fetchers/v2ex.js';
import { sendTelegramMessage } from '../publishers/telegram.js';
import { renderMarkdownLikeAsHtml } from '../utils/telegramMarkdown.js';
import {
  createV2exHolidayBatch,
  findUnconsumedV2exHolidayBatches,
  findV2exItemsByBatchIds,
  insertV2exBatchItems,
  markV2exBatchesConsumed,
} from './v2exBufferRepository.js';

function chinaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function bufferHolidayV2exTopics(topics: V2exTopic[], now: Date): void {
  const batchDate = chinaDateKey(now);
  const batchId = createV2exHolidayBatch(batchDate);
  insertV2exBatchItems(
    batchId,
    topics.map((topic) => ({
      topicId: Number.isFinite(topic.id) ? String(topic.id) : null,
      topicUrl: topic.link,
      title: topic.title,
      author: topic.node ?? null,
      replyCount: topic.replies ?? 0,
    }))
  );
}

function dedupeBufferedTopics(items: Array<{ topic_id: string | null; topic_url: string; title: string; author: string | null; reply_count: number }>): V2exTopic[] {
  const seen = new Set<string>();
  const result: V2exTopic[] = [];
  for (const item of items) {
    const dedupeKey = item.topic_id ? `id:${item.topic_id}` : `url:${item.topic_url}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({
      id: item.topic_id ? Number(item.topic_id) : 0,
      title: item.title,
      content: '',
      node: item.author ?? 'Unknown',
      link: item.topic_url,
      replies: item.reply_count,
    });
  }
  return result;
}

function buildBufferedRangeLabel(batchDates: string[]): string {
  if (batchDates.length === 0) return '';
  return batchDates.length === 1 ? batchDates[0] : `${batchDates[0]} ~ ${batchDates[batchDates.length - 1]}`;
}

function formatV2exBufferedMessage(summary: string, rangeLabel: string): string {
  return [
    '🚀 <b>V2EX 节假日补充简报</b>',
    `📅 <b>覆盖日期</b>：${rangeLabel}`,
    '',
    renderMarkdownLikeAsHtml(summary),
    '',
    '#V2EX #补充简报',
  ].join('\n');
}

export async function pushBufferedV2exIfNeeded(bot?: Telegraf): Promise<{ pushed: boolean; topicCount: number }> {
  const batches = findUnconsumedV2exHolidayBatches();
  if (batches.length === 0) return { pushed: false, topicCount: 0 };

  const batchIds = batches.map((batch) => batch.id);
  const items = findV2exItemsByBatchIds(batchIds);
  const dedupedTopics = dedupeBufferedTopics(items);
  if (dedupedTopics.length === 0) {
    markV2exBatchesConsumed(batchIds);
    return { pushed: false, topicCount: 0 };
  }

  const summary = await summarizeV2exWithAI(dedupedTopics);
  const rangeLabel = buildBufferedRangeLabel(batches.map((batch) => batch.batch_date));
  const message = formatV2exBufferedMessage(summary, rangeLabel);
  await sendTelegramMessage(message, bot);

  markV2exBatchesConsumed(batchIds);
  return { pushed: true, topicCount: dedupedTopics.length };
}
