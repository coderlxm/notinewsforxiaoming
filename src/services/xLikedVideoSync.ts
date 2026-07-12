import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { escapeHtml } from '../utils/html.js';

const execFileAsync = promisify(execFile);
const projectDirectory = '/opt/x-liked-video-downloader';

const syncResultSchema = z.object({
  discovered: z.number(),
  downloaded: z.number(),
  uploaded: z.number(),
  errors: z.number(),
  items: z.array(z.object({
    tweet_id: z.string(),
    author_username: z.string().nullable(),
    text: z.string(),
    file_size: z.number(),
    uploaded: z.boolean(),
  })),
});

export type XLikedVideoSyncResult = z.infer<typeof syncResultSchema>;

let running = false;

export function isXLikedVideoSyncRunning(): boolean {
  return running;
}

export async function runXLikedVideoSync(): Promise<XLikedVideoSyncResult> {
  running = true;
  try {
    const { stdout } = await execFileAsync('/usr/bin/docker', [
      'compose',
      '--project-directory', projectDirectory,
      '--env-file', `${projectDirectory}/.env`,
      '-f', `${projectDirectory}/current/compose.yml`,
      'run', '--rm', 'app', 'sync',
    ], {
      cwd: projectDirectory,
      timeout: 30 * 60 * 1000,
      maxBuffer: 1024 * 1024,
    });

    return syncResultSchema.parse(JSON.parse(stdout));
  } finally {
    running = false;
  }
}

export function formatXLikedVideoSyncResult(result: XLikedVideoSyncResult): string {
  const lines = [
    `同步完成：发现 ${result.discovered} 条，下载 ${result.downloaded} 个，上传 ${result.uploaded} 个，错误 ${result.errors} 个。`,
  ];
  const posts = groupItemsByPost(result.items);
  const displayed = posts.slice(0, 10);

  for (const [index, post] of displayed.entries()) {
    const author = post.authorUsername ? `@${post.authorUsername}` : '未知作者';
    const url = post.authorUsername
      ? `https://x.com/${post.authorUsername}/status/${post.tweetId}`
      : `https://x.com/i/web/status/${post.tweetId}`;
    const mediaLabel = post.mediaCount > 1 ? `${post.mediaCount} 个视频 · ` : '';
    lines.push(
      '',
      `${index + 1}. <b>${escapeHtml(author)}</b>`,
      escapeHtml(post.text),
      `${mediaLabel}${formatBytes(post.fileSize)} · <a href="${url}">查看原推文</a>`,
    );
  }

  if (posts.length > displayed.length) {
    lines.push('', `另有 ${posts.length - displayed.length} 条未展开。`);
  }
  return lines.join('\n');
}

interface GroupedPost {
  tweetId: string;
  authorUsername: string | null;
  text: string;
  fileSize: number;
  mediaCount: number;
}

function groupItemsByPost(items: XLikedVideoSyncResult['items']): GroupedPost[] {
  const grouped = new Map<string, GroupedPost>();
  for (const item of items) {
    const existing = grouped.get(item.tweet_id);
    if (existing) {
      existing.fileSize += item.file_size;
      existing.mediaCount += 1;
      continue;
    }
    grouped.set(item.tweet_id, {
      tweetId: item.tweet_id,
      authorUsername: item.author_username,
      text: summarizeText(item.text),
      fileSize: item.file_size,
      mediaCount: 1,
    });
  }
  return [...grouped.values()];
}

function summarizeText(text: string): string {
  const normalized = text.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim() || '无正文';
  const characters = [...normalized];
  return characters.length > 80 ? `${characters.slice(0, 80).join('')}…` : normalized;
}

function formatBytes(bytes: number): string {
  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  return bytes >= gib ? `${(bytes / gib).toFixed(2)} GiB` : `${(bytes / mib).toFixed(1)} MiB`;
}
