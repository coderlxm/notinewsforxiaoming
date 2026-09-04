import type {
  FeedFilters,
  JournalDeletionResult,
  JournalEntry,
  JournalFeed,
  JournalPage,
  JournalChannel,
  JournalPlainChannel,
  PublicJournalEntryResponse,
  PublicJournalFeed,
  JournalVisibility,
  OnThisDayResponse,
} from '../types';
import { requestJson, requestWithoutResponse, requestMutationWithTimeout, jsonRequest, withVisitorId } from './client';

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
  visitorId?: string | null;
}): Promise<PublicJournalFeed> {
  const params = new URLSearchParams();
  params.set('channel', options.channel);
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.tag) params.set('tag', options.tag);
  const query = params.size ? `?${params.toString()}` : '';
  return requestJson<PublicJournalFeed>(
    `/api/feed${query}`,
    withVisitorId({}, options.visitorId),
  );
}

export function fetchPublicEntry(
  publicId: string,
  visitorId?: string | null,
): Promise<PublicJournalEntryResponse> {
  return requestJson<PublicJournalEntryResponse>(
    `/api/entries/${encodeURIComponent(publicId)}`,
    withVisitorId({}, visitorId),
  );
}

export function unlockPublicEntry(
  publicId: string,
  password: string,
  visitorId?: string | null,
): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/entries/${encodeURIComponent(publicId)}/unlock`,
    withVisitorId(jsonRequest('POST', { password }), visitorId),
  );
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
  title: string | null;
  contentText: string;
  uploadId: string;
  action: 'draft' | 'publish';
  channel: JournalPlainChannel;
  visibility?: JournalVisibility;
  accessPassword?: string;
  sourceCreatedAt?: string;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>('/api/me/entries', jsonRequest('POST', input));
}

export function updateDraft(id: number, input: {
  title: string | null;
  contentText: string;
  uploadId: string;
  removedAssetIds: number[];
  action: 'draft' | 'publish';
  channel: JournalPlainChannel;
  visibility?: JournalVisibility;
  accessPassword?: string;
  sourceCreatedAt?: string;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/entries/${id}/draft`, jsonRequest('PATCH', input));
}

export function updatePublishedWebEntry(id: number, input: {
  title: string | null;
  contentText: string;
  uploadId: string;
  removedAssetIds: number[];
  channel: JournalPlainChannel;
  visibility: JournalVisibility;
  accessPassword?: string;
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

export function updateEntryVisibility(
  id: number,
  visibility: JournalVisibility,
  accessPassword?: string,
): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/entries/${id}/visibility`,
    jsonRequest('PATCH', { visibility, accessPassword }),
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
