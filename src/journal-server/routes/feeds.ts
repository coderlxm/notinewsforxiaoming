import type { FastifyInstance } from 'fastify';
import { Feed } from 'feed';
import type { JournalEntry } from '../../shared/journalProtocol.js';
import type { JournalRepository } from '../repository.js';
import { generateArticleHtml } from '../richText.js';

function itemTitle(entry: JournalEntry): string {
  if (entry.title) return entry.title;
  const compact = entry.contentText.replace(/\s+/g, ' ').trim();
  return compact === '' ? `${entry.contentType} 记录` : compact.slice(0, 80);
}

function itemContent(entry: JournalEntry, publicBaseUrl: string): string {
  if (entry.bodyFormat === 'rich' && entry.richBody) {
    return generateArticleHtml(entry.richBody, publicBaseUrl);
  }
  return entry.contentText;
}

function itemDescription(entry: JournalEntry): string {
  if (entry.title) {
    const summary = entry.contentText.replace(/\s+/g, ' ').trim();
    return summary === '' ? entry.title : summary;
  }
  return entry.contentText;
}

function buildFeed(repository: JournalRepository, publicBaseUrl: string): Feed {
  const entries = repository.list({ visibility: 'public', limit: 50 }).entries;
  const feed = new Feed({
    title: '小明同学',
    description: '姚黄魏紫开次第，不觉成恨俱零凋',
    id: publicBaseUrl,
    link: publicBaseUrl,
    language: 'zh-CN',
    copyright: `Copyright ${new Date().getFullYear()} 小明同学`,
    feedLinks: {
      rss: `${publicBaseUrl}/rss.xml`,
      json: `${publicBaseUrl}/feed.json`,
    },
    author: { name: '小明同学', link: publicBaseUrl },
  });

  for (const entry of entries) {
    const link = `${publicBaseUrl}/p/${entry.publicId}`;
    const firstAsset = entry.assets.find((asset) => asset.role === 'cover') ?? entry.assets[0];
    const enclosure = firstAsset
      ? {
          url: `${publicBaseUrl}${firstAsset.url}`,
          ...(firstAsset.mimeType ? { type: firstAsset.mimeType } : {}),
          ...(firstAsset.byteSize !== null ? { length: firstAsset.byteSize } : {}),
        }
      : undefined;
    feed.addItem({
      title: itemTitle(entry),
      id: link,
      link,
      date: new Date(entry.sourceCreatedAt),
      description: itemDescription(entry),
      content: itemContent(entry, publicBaseUrl),
      category: entry.tags.map((tag) => ({ name: tag })),
      ...(enclosure ? { enclosure } : {}),
    });
  }
  return feed;
}

export async function registerFeedRoutes(
  server: FastifyInstance,
  repository: JournalRepository,
  publicBaseUrl: string,
): Promise<void> {
  server.get('/rss.xml', async (_request, reply) => {
    reply.type('application/rss+xml; charset=utf-8');
    return buildFeed(repository, publicBaseUrl).rss2();
  });

  server.get('/feed.json', async (_request, reply) => {
    reply.type('application/feed+json; charset=utf-8');
    return buildFeed(repository, publicBaseUrl).json1();
  });
}
