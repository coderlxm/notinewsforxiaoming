import { spawn } from 'node:child_process';
import { config } from './config/index.js';
import { runLocalVideoDownload } from './services/videoDownloadRunner.js';
import {
  readVideoDownloadRequest,
  videoDownloadEventSchema,
  writeVideoDownloadEvent,
  type VideoDownloadResult,
} from './services/videoDownloadProtocol.js';

const jobTimeout = 6 * 60 * 60 * 1000;

const request = await readVideoDownloadRequest();
const url = new URL(request.url);
const result = isBilibiliHost(url.hostname)
  ? await runMacVideoDownload(request.url)
  : await runLocalVideoDownload({
      url: request.url,
      ytDlpPath: '/usr/local/bin/yt-dlp',
      rclonePath: '/usr/bin/rclone',
      rcloneRemote: 'notinews-drive',
      workRoot: '/var/lib/notinews-downloads',
      nodePath: '/usr/bin/node',
      cookiesFile: '/root/.config/yt-dlp/youtube-cookies.txt',
      extractorArgs: isYouTubeHost(url.hostname)
        ? [
            'youtube:player-client=mweb',
            'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416',
          ]
        : undefined,
      onStage(stage) {
        writeVideoDownloadEvent({ type: 'stage', stage });
      },
    });

writeVideoDownloadEvent(result);

function isBilibiliHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'b23.tv'
    || host === 'bilibili.com'
    || host.endsWith('.bilibili.com');
}

function isYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'youtu.be'
    || host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'youtube-nocookie.com'
    || host.endsWith('.youtube-nocookie.com');
}

function runMacVideoDownload(url: string): Promise<VideoDownloadResult> {
  if (
    !config.videoDownloadMacSshHost
    || !config.videoDownloadMacSshUser
    || !config.videoDownloadMacSshKeyPath
  ) {
    throw new Error('Mac 下载 worker 的 SSH 配置不完整。');
  }

  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/ssh', [
      '-T',
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes',
      '-o', 'ConnectTimeout=10',
      '-p', String(config.videoDownloadMacSshPort),
      '-i', config.videoDownloadMacSshKeyPath,
      `${config.videoDownloadMacSshUser}@${config.videoDownloadMacSshHost}`,
    ], {
      shell: false,
      timeout: jobTimeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdoutBuffer = '';
    let stderr = '';
    let result: VideoDownloadResult | undefined;
    let protocolError: Error | undefined;

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
            writeVideoDownloadEvent(event);
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
      if (protocolError) {
        reject(protocolError);
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Mac worker 退出：code=${code ?? '-'} signal=${signal ?? '-'}`));
        return;
      }
      if (!result) {
        reject(new Error('Mac worker 未返回下载结果。'));
        return;
      }
      resolve(result);
    });

    child.stdin.end(`${JSON.stringify({ url })}\n`);
  });
}
