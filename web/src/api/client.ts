import type {
  JournalApiError,
} from '../types';

export class JournalRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'JournalRequestError';
    this.status = status;
  }
}

async function readError(response: Response): Promise<JournalApiError> {
  return await response.json() as JournalApiError;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });

  if (!response.ok) {
    const body = await readError(response);
    throw new JournalRequestError(response.status, body.error);
  }

  return await response.json() as T;
}

export async function requestWithoutResponse(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });

  if (!response.ok) {
    const body = await readError(response);
    throw new JournalRequestError(response.status, body.error);
  }
}

const mutationTimeoutMs = 15_000;

export async function requestMutationWithTimeout<T>(path: string, init: RequestInit): Promise<T> {
  const signal = AbortSignal.timeout(mutationTimeoutMs);
  try {
    return await requestJson<T>(path, { ...init, signal });
  } catch (reason) {
    if (signal.aborted) throw new Error('网络请求长时间没有响应。');
    throw reason;
  }
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function withVisitorId(init: RequestInit, visitorId: string | null | undefined): RequestInit {
  if (!visitorId) return init;
  return {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      'X-Journal-Visitor-Id': visitorId,
    },
  };
}
