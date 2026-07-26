import type {
  CurrentWeather,
  FeedFilters,
  JournalApiError,
  JournalArticleAssetResponse,
  JournalDeletionResult,
  JournalEntry,
  JournalFeed,
  JournalRichDocument,
  JournalVisibility,
  OnThisDayResponse,
  SiteProfile,
} from './types';

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
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

async function requestWithoutResponse(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  });

  if (!response.ok) {
    const body = await readError(response);
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

export function fetchAuthenticationState(): Promise<{ authenticated: boolean }> {
  return requestJson<{ authenticated: boolean }>('/api/auth/session');
}

export function fetchSiteProfile(): Promise<SiteProfile> {
  return requestJson<SiteProfile>('/api/site-profile');
}

export function fetchCurrentWeather(): Promise<CurrentWeather> {
  return requestJson<CurrentWeather>('/api/weather');
}

export function updateSiteProfile(input: {
  bio: string;
  avatar: File | null;
  weatherEnabled: boolean;
}): Promise<SiteProfile> {
  const form = new FormData();
  form.append('bio', input.bio);
  form.append('weatherEnabled', String(input.weatherEnabled));
  if (input.avatar !== null) form.append('avatar', input.avatar);
  return requestJson<SiteProfile>('/api/me/site-profile', { method: 'PATCH', body: form });
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

export function fetchPrivateEntry(id: number): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/entries/${id}`);
}

export function publishEntry(input: {
  contentText: string;
  images: File[];
  action: 'draft' | 'publish';
  visibility?: JournalVisibility;
}): Promise<JournalEntry> {
  const form = new FormData();
  form.append('contentText', input.contentText);
  form.append('action', input.action);
  if (input.visibility !== undefined) form.append('visibility', input.visibility);
  input.images.forEach(file => form.append('images', file));
  return requestJson<JournalEntry>('/api/me/entries', { method: 'POST', body: form });
}

export function updateDraft(id: number, input: {
  contentText: string;
  newImages: File[];
  removedAssetIds: number[];
  action: 'draft' | 'publish';
  visibility?: JournalVisibility;
}): Promise<JournalEntry> {
  const form = new FormData();
  form.append('contentText', input.contentText);
  form.append('action', input.action);
  if (input.visibility !== undefined) form.append('visibility', input.visibility);
  input.newImages.forEach(file => form.append('newImages', file));
  form.append('removedAssetIds', JSON.stringify(input.removedAssetIds));
  return requestJson<JournalEntry>(
    `/api/me/entries/${id}/draft`,
    { method: 'PATCH', body: form },
  );
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

export function updateEntryPublishedTime(id: number, sourceCreatedAt: string): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/entries/${id}/published-time`,
    jsonRequest('PATCH', { sourceCreatedAt }),
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

export function fetchArticle(id: number): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/articles/${id}`);
}

export function createArticle(input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>('/api/me/articles', jsonRequest('POST', input));
}

export function updateArticle(id: number, input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/articles/${id}`,
    jsonRequest('PATCH', input),
  );
}

export function uploadArticleAsset(
  id: number,
  file: File,
  role: 'cover' | 'inline',
): Promise<JournalArticleAssetResponse> {
  const form = new FormData();
  form.append('role', role);
  form.append('file', file);
  return requestJson<JournalArticleAssetResponse>(
    `/api/me/articles/${id}/assets`,
    { method: 'POST', body: form },
  );
}

export function deleteArticleAsset(id: number, assetId: number): Promise<void> {
  return requestWithoutResponse(`/api/me/articles/${id}/assets/${assetId}`, { method: 'DELETE' });
}
