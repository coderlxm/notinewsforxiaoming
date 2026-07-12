import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { escapeHtml } from '../utils/html.js';
import { bjDate, bjFormat } from '../utils/time.js';

const execFileAsync = promisify(execFile);
const projectDirectory = '/opt/x-liked-video-downloader';

const latestRunSchema = z.object({
  id: z.number(),
  mode: z.string(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  downloaded: z.number(),
  uploaded: z.number(),
  errors: z.number(),
  result: z.string().nullable(),
});

const statusSchema = z.object({
  media_status: z.record(z.string(), z.number()),
  latest_run: latestRunSchema.nullable(),
});

export type XLikedVideoStatus = z.infer<typeof statusSchema>;

export async function readXLikedVideoStatus(): Promise<XLikedVideoStatus> {
  const { stdout } = await execFileAsync('/usr/bin/docker', [
    'compose',
    '--project-directory', projectDirectory,
    '--env-file', `${projectDirectory}/.env`,
    '-f', `${projectDirectory}/current/compose.yml`,
    'run', '--rm', 'app', 'status',
  ], {
    cwd: projectDirectory,
    timeout: 10 * 60 * 1000,
    maxBuffer: 1024 * 1024,
  });

  return statusSchema.parse(JSON.parse(stdout));
}

export function formatXLikedVideoStatusMessage(status: XLikedVideoStatus): string {
  const latestRun = status.latest_run;
  if (!latestRun) {
    return [
      '🎬 <b>X 点赞视频</b>',
      '⚠️ 今日 11:00 巡检异常',
      '还没有找到任何同步记录。',
    ].join('\n');
  }

  const pendingCount = getPendingCount(status);
  const latestRunDate = bjDate(latestRun.started_at);
  const isToday = latestRunDate === bjDate();
  const latestRunTime = bjFormat(latestRun.started_at, 'MM-DD HH:mm');

  if (!isToday) {
    return [
      '🎬 <b>X 点赞视频</b>',
      '⚠️ 今日 11:00 巡检异常',
      `今天还没看到同步记录，最近一次是 ${latestRunTime}。`,
      `结果：${escapeHtml(formatRunResult(latestRun.result))}`,
    ].join('\n');
  }

  if (pendingCount > 0 || latestRun.errors > 0 || latestRun.result !== 'success') {
    return [
      '🎬 <b>X 点赞视频</b>',
      '⚠️ 今日同步有异常',
      `最近运行：${latestRunTime} · ${escapeHtml(formatRunResult(latestRun.result))}`,
      `本地待处理：${pendingCount} 个`,
      `本次错误：${latestRun.errors} 个`,
    ].join('\n');
  }

  if (latestRun.downloaded === 0 && latestRun.uploaded === 0) {
    return [
      '🎬 <b>X 点赞视频</b>',
      '✅ 今日同步正常',
      `最近运行：${latestRunTime}`,
      '今天没有新的点赞视频。',
    ].join('\n');
  }

  return [
    '🎬 <b>X 点赞视频</b>',
    '✅ 今日同步正常',
    `最近运行：${latestRunTime}`,
    `今天成功下载并上传 ${latestRun.uploaded} 个视频。`,
    '服务器没有残留待上传文件。',
  ].join('\n');
}

export function formatXLikedVideoStatusCheckFailure(error: Error): string {
  return [
    '🎬 <b>X 点赞视频</b>',
    '🚨 今日 11:00 巡检执行失败',
    escapeHtml(error.message),
  ].join('\n');
}

function getPendingCount(status: XLikedVideoStatus): number {
  return (status.media_status.downloaded ?? 0)
    + (status.media_status.queued ?? 0)
    + (status.media_status.retryable_error ?? 0);
}

function formatRunResult(result: string | null): string {
  if (result === 'success') return '成功';
  if (result === 'partial') return '部分完成';
  if (result === 'failed') return '失败';
  return result || '未知';
}
