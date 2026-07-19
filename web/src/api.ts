import type {
  FeedFilters,
  JournalApiError,
  JournalDeletionResult,
  JournalEntry,
  JournalFeed,
  JournalVisibility,
  OnThisDayResponse,
} from './types';

export class JournalRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'JournalRequestError';
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });

  if (!response.ok) {
    const body = await response.json() as JournalApiError;
    throw new JournalRequestError(response.status, body.error);
  }

  return await response.json() as T;
}

async function requestWithoutResponse(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });

  if (!response.ok) {
    const body = await response.json() as JournalApiError;
    throw new JournalRequestError(response.status, body.error);
  }
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function appendFilterParams(params: URLSearchParams, filters: FeedFilters): void {
  if (filters.visibility !== 'all') params.set('visibility', filters.visibility);
  if (filters.query) params.set('query', filters.query);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.contentType) params.set('contentType', filters.contentType);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
}

export function fetchPublicFeed(options: { cursor?: string; tag?: string }): Promise<JournalFeed> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.tag) params.set('tag', options.tag);
  const query = params.size ? `?${params.toString()}` : '';
  return requestJson<JournalFeed>(`/api/feed${query}`);
}

export function fetchPublicEntry(publicId: string): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/entries/${encodeURIComponent(publicId)}`);
}

export function login(password: string): Promise<void> {
  return requestWithoutResponse('/api/auth/login', jsonRequest('POST', { password }));
}

export function logout(): Promise<void> {
  return requestWithoutResponse('/api/auth/logout', { method: 'POST' });
}

export function fetchPrivateFeed(options: { cursor?: string; filters: FeedFilters }): Promise<JournalFeed> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  appendFilterParams(params, options.filters);
  const query = params.size ? `?${params.toString()}` : '';
  return requestJson<JournalFeed>(`/api/me/entries${query}`);
}

export function fetchOnThisDay(): Promise<OnThisDayResponse> {
  return requestJson<OnThisDayResponse>('/api/me/on-this-day');
}

export function updateEntryContent(id: number, contentText: string): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/entries/${id}/content`,
    jsonRequest('PATCH', { contentText }),
  );
}

export function updateEntryVisibility(id: number, visibility: JournalVisibility): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/entries/${id}/visibility`,
    jsonRequest('PATCH', { visibility }),
  );
}

export function updateEntryPinned(id: number, pinned: boolean): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/entries/${id}/pinned`,
    jsonRequest('PATCH', { pinned }),
  );
}

export function deleteEntry(id: number): Promise<JournalDeletionResult> {
  return requestJson<JournalDeletionResult>(`/api/me/entries/${id}`, { method: 'DELETE' });
}
