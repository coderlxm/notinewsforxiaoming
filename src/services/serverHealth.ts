import { execFile } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface ServerHealthTarget {
  alias: string;
  name: string;
  role: string;
  provider?: string;
  note?: string;
}

export interface ServerHealthResult {
  target: ServerHealthTarget;
  online: boolean;
  hostname?: string;
  uptime?: string;
  error?: string;
}

const TARGETS_PATH = resolve(process.cwd(), 'data/server-health-targets.json');
const SSH_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadServerHealthTargets(): ServerHealthTarget[] {
  if (!existsSync(TARGETS_PATH)) {
    throw new Error(`Server health targets file not found: ${TARGETS_PATH}`);
  }

  const targets = JSON.parse(readFileSync(TARGETS_PATH, 'utf-8')) as ServerHealthTarget[];
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('Server health targets must be a non-empty array.');
  }

  return targets;
}

function normalizeSshError(error: unknown): string {
  if (error instanceof Error) {
    const maybeError = error as Error & { code?: string; signal?: string; stderr?: string };
    if (maybeError.signal === 'SIGTERM') return 'SSH 连接超时';
    if (maybeError.code === 'ETIMEDOUT') return 'SSH 连接超时';
    if (maybeError.stderr?.trim()) return maybeError.stderr.trim().split('\n').slice(-1)[0] ?? maybeError.stderr.trim();
    return maybeError.message;
  }
  return String(error);
}

function probeServer(target: ServerHealthTarget): Promise<ServerHealthResult> {
  return new Promise(resolve => {
    execFile(
      'ssh',
      [
        '-o', 'BatchMode=yes',
        '-o', `ConnectTimeout=${Math.floor(SSH_TIMEOUT_MS / 1000)}`,
        target.alias,
        'hostname && uptime -p'
      ],
      { timeout: SSH_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          resolve({
            target,
            online: false,
            error: normalizeSshError(error)
          });
          return;
        }

        const lines = stdout.trim().split('\n').map(line => line.trim()).filter(Boolean);
        resolve({
          target,
          online: true,
          hostname: lines[0] ?? target.alias,
          uptime: lines[1] ?? '未知'
        });
      }
    );
  });
}

async function probeServerWithRetry(target: ServerHealthTarget): Promise<ServerHealthResult> {
  const firstResult = await probeServer(target);
  if (firstResult.online) return firstResult;

  await sleep(RETRY_DELAY_MS);
  const secondResult = await probeServer(target);
  if (secondResult.online) return secondResult;

  return secondResult;
}

export async function checkServerHealth(): Promise<ServerHealthResult[]> {
  const targets = loadServerHealthTargets();
  return Promise.all(targets.map(target => probeServerWithRetry(target)));
}
