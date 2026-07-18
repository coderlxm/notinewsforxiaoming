import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { escapeHtml } from '../utils/html.js';
import { bj, bjDate, bjFormat } from '../utils/time.js';

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
      '⚠️ 同步状态异常',
      '还没有找到任何同步记录。',
    ].join('\n');
  }

  const pendingCount = getPendingCount(status);
  const latestRunDate = bjDate(latestRun.started_at);
  const isToday = latestRunDate === bjDate();
  const latestRunTime = bjFormat(latestRun.started_at, 'MM-DD HH:mm');
  const runDuration = formatRunDuration(latestRun);
  const todayDurationLabel = runDuration === null ? '尚未完成' : `耗时 ${runDuration}`;

  if (!isToday) {
    const suffix = runDuration === null ? '（尚未完成）' : `（耗时 ${runDuration}）`;
    return [
      '🎬 <b>X 点赞视频</b>',
      '⚠️ 同步状态异常',
      `今天还没看到同步记录，最近一次是 ${latestRunTime}${suffix}。`,
      `结果：${escapeHtml(formatRunResult(latestRun.result))}`,
    ].join('\n');
  }

  if (pendingCount > 0 || latestRun.errors > 0 || latestRun.result !== 'success') {
    return [
      '🎬 <b>X 点赞视频</b>',
      '⚠️ 今日同步有异常',
      `最近运行：${latestRunTime} · ${escapeHtml(formatRunResult(latestRun.result))} · ${todayDurationLabel}`,
      `本地待处理：${pendingCount} 个`,
      `本次错误：${latestRun.errors} 个`,
    ].join('\n');
  }

  if (latestRun.downloaded === 0 && latestRun.uploaded === 0) {
    return [
      '🎬 <b>X 点赞视频</b>',
      '✅ 今日同步正常',
      `最近运行：${latestRunTime} · ${todayDurationLabel}`,
      '今天没有新的点赞视频。',
    ].join('\n');
  }

  return [
    '🎬 <b>X 点赞视频</b>',
    '✅ 今日同步正常',
    `最近运行：${latestRunTime} · ${todayDurationLabel}`,
    `今天成功下载并上传 ${latestRun.uploaded} 个视频。`,
    '服务器没有残留待上传文件。',
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

function formatRunDuration(run: XLikedVideoStatus['latest_run']): string | null {
  if (!run) return null;
  if (run.finished_at === null) return null;
  const startedAt = bj(run.started_at);
  const finishedAt = bj(run.finished_at);
  const diffMs = finishedAt.diff(startedAt);
  if (!Number.isFinite(diffMs)) {
    throw new Error(`invalid sync timestamps: ${run.started_at} -> ${run.finished_at}`);
  }
  if (diffMs < 0) {
    throw new Error(`sync finished_at earlier than started_at: ${run.started_at} -> ${run.finished_at}`);
  }
  const totalSeconds = Math.round(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return seconds === 0
      ? `${hours}小时${pad2(minutes)}分`
      : `${hours}小时${pad2(minutes)}分${seconds}秒`;
  }
  if (minutes > 0) {
    return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
