import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { lookup } from 'mime-types';
import { z } from 'zod';
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
  cookiesFile?: string;
  extractorArgs?: string[];
  onStage: (stage: VideoDownloadStage) => void | Promise<void>;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
}

const ytDlpSelectedFormatSchema = z.object({
  format_id: z.string(),
  format: z.string(),
  resolution: z.string(),
  fps: z.number().nullable(),
  vcodec: z.string().nullable(),
  acodec: z.string().nullable(),
  ext: z.string(),
  dynamic_range: z.string().nullable(),
});

export async function runLocalVideoDownload(
  options: VideoDownloadRunnerOptions,
): Promise<VideoDownloadResult> {
  const url = parseVideoUrl(options.url);
  await mkdir(options.workRoot, { recursive: true, mode: 0o700 });
  const taskDirectory = await mkdtemp(join(options.workRoot, 'job-'));
  const downloadedPathFile = join(taskDirectory, 'downloaded-path.txt');
  const selectedFormatFile = join(taskDirectory, 'selected-format.json');
  const startedAt = Date.now();

  try {
    await options.onStage('downloading');
    await runProcess(options.ytDlpPath, [
      '--force-ipv4',
      '--no-playlist',
      '--match-filter', '!is_live',
      '--max-filesize', '8G',
      '--format', 'bestvideo*+bestaudio/best',
      '--no-progress',
      '--no-warnings',
      '--js-runtimes', `node:${options.nodePath}`,
      ...(options.cookiesFile ? ['--cookies', options.cookiesFile] : []),
      ...(options.extractorArgs ?? []).flatMap((value) => ['--extractor-args', value]),
      '--print-to-file', 'after_move:filepath', downloadedPathFile,
      '--print-to-file',
      'after_move:%(.{format_id,format,resolution,fps,vcodec,acodec,ext,dynamic_range})j',
      selectedFormatFile,
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

    const fileName = basename(downloadedPath);
    const contentType = lookup(fileName);
    if (!contentType || !contentType.startsWith('video/')) {
      throw new Error(`下载结果不是可识别的视频文件：${fileName}`);
    }
    const selectedFormat = ytDlpSelectedFormatSchema.parse(
      JSON.parse((await readFile(selectedFormatFile, 'utf8')).trim()),
    );

    await options.onStage('uploading');
    const driveDirectory = `NotiNewsDownloads/${bj().format('YYYY-MM')}`;
    const drivePath = `${driveDirectory}/${fileName}`;

    await runProcess(options.rclonePath, [
      'copyto',
      downloadedPath,
      `${options.rcloneRemote}:${drivePath}`,
      '--retries', '1',
      '--low-level-retries', '1',
      '--metadata',
      '--metadata-set', `content-type=${contentType}`,
    ]);

    return {
      type: 'result',
      fileName,
      byteSize: fileStats.size,
      drivePath,
      elapsedMs: Math.max(1, Date.now() - startedAt),
      selectedFormat: {
        formatId: selectedFormat.format_id,
        description: selectedFormat.format,
        resolution: selectedFormat.resolution,
        fps: selectedFormat.fps,
        videoCodec: selectedFormat.vcodec,
        audioCodec: selectedFormat.acodec,
        container: selectedFormat.ext,
        dynamicRange: selectedFormat.dynamic_range,
      },
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
