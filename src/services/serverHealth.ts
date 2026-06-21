import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface ServerHealthTarget {
  alias: string;
  name: string;
  host: string;
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
const SSH_KEY_PATH = '/root/.ssh/notinews_health_ed25519';

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

function probeServer(target: ServerHealthTarget): ServerHealthResult {
  const result = spawnSync(
    'ssh',
    [
      '-i', SSH_KEY_PATH,
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'IdentitiesOnly=yes',
      '-o', 'PreferredAuthentications=publickey',
      '-o', 'GSSAPIAuthentication=no',
      '-o', 'ConnectionAttempts=1',
      '-o', `ConnectTimeout=${Math.floor(SSH_TIMEOUT_MS / 1000)}`,
      '-o', 'ServerAliveInterval=3',
      '-o', 'ServerAliveCountMax=1',
      '-o', 'LogLevel=ERROR',
      '-l', 'root',
      target.host,
      'hostname && uptime -p'
    ],
    {
      encoding: 'utf-8',
      timeout: SSH_TIMEOUT_MS,
      killSignal: 'SIGKILL'
    }
  );

  if (result.status === 0) {
    const lines = result.stdout
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    return {
      target,
      online: true,
      hostname: lines[0] ?? target.alias,
      uptime: lines[1] ?? '未知'
    };
  }

  if (result.error) {
    return {
      target,
      online: false,
      error: normalizeSshError(result.error)
    };
  }

  if (result.signal === 'SIGKILL' || result.status === null) {
    return {
      target,
      online: false,
      error: 'SSH 连接超时'
    };
  }

  return {
    target,
    online: false,
    error: result.stderr.trim().split('\n').slice(-1)[0] || `SSH 探测失败，退出码 ${result.status}`
  };
}

async function probeServerWithRetry(target: ServerHealthTarget): Promise<ServerHealthResult> {
  const firstResult = probeServer(target);
  if (firstResult.online) return firstResult;

  await sleep(RETRY_DELAY_MS);
  const secondResult = probeServer(target);
  if (secondResult.online) return secondResult;

  return secondResult;
}

export async function checkServerHealth(): Promise<ServerHealthResult[]> {
  const targets = loadServerHealthTargets();
  return Promise.all(targets.map(target => probeServerWithRetry(target)));
}
