import type {
  AdminContributionDetail,
  AdminContributionLink,
  AdminContributionListResponse,
  ChannelTags,
  FeedFilters,
  JournalApiError,
  JournalArticleAssetResponse,
  JournalDeletionResult,
  JournalEntry,
  JournalFeed,
  JournalPage,
  JournalChannel,
  JournalPlainChannel,
  JournalRichDocument,
  JournalVisibility,
  OnThisDayResponse,
  SiteContactItem,
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

const mutationTimeoutMs = 15_000;

async function requestMutationWithTimeout<T>(path: string, init: RequestInit): Promise<T> {
  const signal = AbortSignal.timeout(mutationTimeoutMs);
  try {
    return await requestJson<T>(path, { ...init, signal });
  } catch (reason) {
    if (signal.aborted) throw new Error('网络请求长时间没有响应。');
    throw reason;
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

export function fetchPublicFeed(options: {
  channel: JournalChannel;
  cursor?: string;
  tag?: string;
}): Promise<JournalFeed> {
  const params = new URLSearchParams();
  params.set('channel', options.channel);
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

export function updateSiteProfile(input: {
  bio: string;
  avatar: File | null;
  weatherEnabled: boolean;
  channelTags: ChannelTags;
  aboutIntro: string;
  contactItems: SiteContactItem[];
}): Promise<SiteProfile> {
  const form = new FormData();
  form.append('bio', input.bio);
  form.append('weatherEnabled', String(input.weatherEnabled));
  form.append('channelTags', JSON.stringify(input.channelTags));
  form.append('aboutIntro', input.aboutIntro);
  form.append('contactItems', JSON.stringify(input.contactItems));
  if (input.avatar !== null) form.append('avatar', input.avatar);
  return requestJson<SiteProfile>('/api/me/site-profile', { method: 'PATCH', body: form });
}

export function fetchAdminContributionLink(): Promise<{ link: AdminContributionLink | null }> {
  return requestJson<{ link: AdminContributionLink | null }>('/api/private/contribution-link');
}

export function createAdminContributionLink(): Promise<{ link: AdminContributionLink }> {
  return requestJson<{ link: AdminContributionLink }>(
    '/api/private/contribution-link',
    { method: 'POST' },
  );
}

export function revokeAdminContributionLink(): Promise<void> {
  return requestWithoutResponse('/api/private/contribution-link', { method: 'DELETE' });
}

export function fetchAdminContributions(): Promise<AdminContributionListResponse> {
  return requestJson<AdminContributionListResponse>('/api/private/contributions');
}

export function fetchAdminContribution(publicId: string): Promise<AdminContributionDetail> {
  return requestJson<AdminContributionDetail>(
    `/api/private/contributions/${encodeURIComponent(publicId)}`,
  );
}

export function publishAdminContribution(
  publicId: string,
  input: {
    contentText: string;
    assetIds: number[];
    sourceCreatedAt: string;
    visibility: JournalVisibility;
  },
): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/private/contributions/${encodeURIComponent(publicId)}/publish`,
    jsonRequest('POST', input),
  );
}

export function deleteAdminContributionAsset(
  publicId: string,
  assetId: number,
): Promise<AdminContributionDetail> {
  return requestJson<AdminContributionDetail>(
    `/api/private/contributions/${encodeURIComponent(publicId)}/assets/${assetId}`,
    { method: 'DELETE' },
  );
}

export function deleteAdminContribution(publicId: string): Promise<void> {
  return requestWithoutResponse(
    `/api/private/contributions/${encodeURIComponent(publicId)}`,
    { method: 'DELETE' },
  );
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

export function fetchPrivateTablePage(options: {
  page: number;
  pageSize: number;
  filters: FeedFilters;
}): Promise<JournalPage> {
  const params = new URLSearchParams();
  params.set('page', String(options.page));
  params.set('pageSize', String(options.pageSize));
  appendFilterParams(params, options.filters);
  const query = params.size ? `?${params.toString()}` : '';
  return requestJson<JournalPage>(`/api/me/entries/page${query}`);
}

export function publishEntry(input: {
  contentText: string;
  uploadId: string;
  action: 'draft' | 'publish';
  channel: JournalPlainChannel;
  visibility?: JournalVisibility;
  sourceCreatedAt?: string;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>('/api/me/entries', jsonRequest('POST', input));
}

export function updateDraft(id: number, input: {
  contentText: string;
  uploadId: string;
  removedAssetIds: number[];
  action: 'draft' | 'publish';
  channel: JournalPlainChannel;
  visibility?: JournalVisibility;
  sourceCreatedAt?: string;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/entries/${id}/draft`, jsonRequest('PATCH', input));
}

export function updatePublishedWebEntry(id: number, input: {
  contentText: string;
  uploadId: string;
  removedAssetIds: number[];
  channel: JournalPlainChannel;
  visibility: JournalVisibility;
  sourceCreatedAt: string;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/entries/${id}`, jsonRequest('PATCH', input));
}

export function createEntryUpload(entryId?: number): Promise<{ uploadId: string; token: string }> {
  return requestMutationWithTimeout<{ uploadId: string; token: string }>(
    '/api/me/entry-uploads',
    jsonRequest('POST', entryId === undefined ? {} : { entryId }),
  );
}

export function processEntryUpload(uploadId: string, assetUploadId: string): Promise<void> {
  return requestWithoutResponse(
    `/api/me/entry-uploads/${encodeURIComponent(uploadId)}/assets/${encodeURIComponent(assetUploadId)}`,
    { method: 'POST' },
  );
}

export function discardEntryUpload(uploadId: string): Promise<void> {
  return requestWithoutResponse(`/api/me/entry-uploads/${encodeURIComponent(uploadId)}`, { method: 'DELETE' });
}

export function fetchOnThisDay(): Promise<OnThisDayResponse> {
  return requestJson<OnThisDayResponse>('/api/me/on-this-day');
}

export function updateEntryContent(id: number, contentText: string): Promise<JournalEntry> {
  return requestMutationWithTimeout<JournalEntry>(
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

export function updateEntryChannel(id: number, channel: JournalPlainChannel): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/entries/${id}/channel`,
    jsonRequest('PATCH', { channel }),
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
