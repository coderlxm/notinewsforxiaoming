import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { bj } from '../utils/time.js';
import type {
  VideoDownloadResult,
  VideoDownloadStage,
} from './videoDownloadProtocol.js';

const maxFileSize = 8 * 1024 ** 3;
const jobTimeout = 6 * 60 * 60 * 1000;

interface VideoDownloadRunnerOptions {
  url: string;
  ytDlpPath: string;
  rclonePath: string;
  rcloneRemote: string;
  workRoot: string;
  nodePath: string;
  onStage: (stage: VideoDownloadStage) => void | Promise<void>;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
}

export async function runLocalVideoDownload(
  options: VideoDownloadRunnerOptions,
): Promise<VideoDownloadResult> {
  const url = parseVideoUrl(options.url);
  await mkdir(options.workRoot, { recursive: true, mode: 0o700 });
  const taskDirectory = await mkdtemp(join(options.workRoot, 'job-'));
  const downloadedPathFile = join(taskDirectory, 'downloaded-path.txt');

  try {
    await options.onStage('downloading');
    await runProcess(options.ytDlpPath, [
      '--force-ipv4',
      '--no-playlist',
      '--match-filter', '!is_live',
      '--max-filesize', '8G',
      '--no-progress',
      '--no-warnings',
      '--js-runtimes', `node:${options.nodePath}`,
      '--print-to-file', 'after_move:filepath', downloadedPathFile,
      '--paths', taskDirectory,
      '--output', '%(title).150B [%(id)s].%(ext)s',
      '--',
      url.toString(),
    ]);

    const downloadedPath = resolve((await readFile(downloadedPathFile, 'utf8')).trim());
    if (!downloadedPath.startsWith(`${resolve(taskDirectory)}/`)) {
      throw new Error('yt-dlp 返回了任务目录之外的文件路径。');
    }

    const fileStats = await stat(downloadedPath);
    if (fileStats.size > maxFileSize) {
      throw new Error('下载结果超过 8 GiB 限制。');
    }

    await options.onStage('uploading');
    const driveDirectory = [
      'NotiNewsDownloads',
      bj().format('YYYY-MM'),
      `${bj().format('YYYYMMDD-HHmmss')}-${randomUUID()}`,
    ].join('/');
    const fileName = basename(downloadedPath);
    const drivePath = `${driveDirectory}/${fileName}`;

    await runProcess(options.rclonePath, [
      'copyto',
      downloadedPath,
      `${options.rcloneRemote}:${drivePath}`,
      '--retries', '1',
      '--low-level-retries', '1',
    ]);

    return {
      type: 'result',
      fileName,
      byteSize: fileStats.size,
      drivePath,
    };
  } finally {
    await rm(taskDirectory, { recursive: true, force: true });
  }
}

function parseVideoUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只支持 http 或 https 视频链接。');
  }
  return url;
}

function runProcess(command: string, args: string[]): Promise<ProcessResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      shell: false,
      timeout: jobTimeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      const detail = stderr.trim() || stdout.trim();
      reject(new Error(detail || `${command} 退出：code=${code ?? '-'} signal=${signal ?? '-'}`));
    });
  });
}
