import { spawn } from 'node:child_process';
import {
  videoDownloadEventSchema,
  type VideoDownloadResult,
  type VideoDownloadStage,
} from './videoDownloadProtocol.js';

const projectDirectory = '/root/NotiNewsForXiaoming';
const downloadLock = '/run/lock/notinews-download.lock';
const jobTimeout = 6 * 60 * 60 * 1000;

let running = false;

export function isVideoDownloadRunning(): boolean {
  return running;
}

export async function runVideoDownload(
  rawUrl: string,
  onStage: (stage: VideoDownloadStage) => void | Promise<void>,
): Promise<VideoDownloadResult> {
  const url = parseVideoUrl(rawUrl);
  running = true;
  try {
    return await runDownloadJob(url.toString(), onStage);
  } finally {
    running = false;
  }
}

function parseVideoUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只支持 http 或 https 视频链接。');
  }
  return url;
}

function runDownloadJob(
  url: string,
  onStage: (stage: VideoDownloadStage) => void | Promise<void>,
): Promise<VideoDownloadResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/flock', [
      '--exclusive',
      '--nonblock',
      downloadLock,
      '/usr/local/bin/pnpm',
      'exec',
      'tsx',
      'src/videoDownloadJob.ts',
    ], {
      cwd: projectDirectory,
      shell: false,
      timeout: jobTimeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdoutBuffer = '';
    let stderr = '';
    let result: VideoDownloadResult | undefined;
    let protocolError: Error | undefined;
    let stageUpdates = Promise.resolve();

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = videoDownloadEventSchema.parse(JSON.parse(line));
          if (event.type === 'stage') {
            stageUpdates = stageUpdates.then(() => onStage(event.stage));
          } else {
            result = event;
          }
        } catch (e) {
          protocolError = e instanceof Error ? e : new Error(String(e));
          child.kill();
        }
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      void stageUpdates.then(() => {
        if (protocolError) {
          reject(protocolError);
          return;
        }
        if (code !== 0) {
          reject(new Error(
            stderr.trim()
            || (code === 1
              ? '下载任务当前被备份任务占用。'
              : `下载任务退出：code=${code ?? '-'} signal=${signal ?? '-'}`),
          ));
          return;
        }
        if (!result) {
          reject(new Error('下载任务未返回结果。'));
          return;
        }
        resolve(result);
      }, reject);
    });

    child.stdin.end(`${JSON.stringify({ url })}\n`);
  });
}
