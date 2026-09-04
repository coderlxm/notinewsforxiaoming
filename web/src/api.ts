import type {
  AdminContributionDetail,
  AdminContributionLink,
  ContributionLinkLifetime,
  AdminContributionListResponse,
  ChannelTags,
  FeedFilters,
  JournalAdminCommentDeletionResponse,
  JournalAdminCommentMutationResponse,
  JournalAdminCommentStatus,
  JournalAdminInteractionsResponse,
  JournalApiError,
  JournalArticleAssetResponse,
  JournalDeletionResult,
  JournalDiscoveryArchiveMonthResponse,
  JournalDiscoveryArchiveOverview,
  JournalDiscoverySearchResponse,
  JournalEntry,
  JournalFeed,
  JournalPage,
  JournalChannel,
  JournalPlainChannel,
  JournalPublicInteractionsResponse,
  JournalPublicResume,
  JournalReactionResponse,
  JournalResumeAccessInput,
  JournalResumeAccessUpdateResponse,
  JournalAdminResumeSummary,
  JournalVisitorCommentResponse,
  PublicJournalEntryResponse,
  PublicJournalFeed,
  JournalRichDocument,
  JournalVisibility,
  OnThisDayResponse,
  SiteContactItem,
  SiteProfile,
} from './types';
import type {
  PhotoAlbumDetail,
  PhotoLibraryOverview,
} from '../../src/shared/photoLibraryProtocol';
import type {
  GameImageRole,
  GameInput,
  GameItem,
} from '../../src/shared/gameProtocol';

export type JournalTagSuggestionRequest =
  | {
      kind: 'entry';
      channel: JournalPlainChannel;
      title: string | null;
      contentText: string;
    }
  | {
      kind: 'article';
      channel: 'article';
      title: string;
      richBody: JournalRichDocument;
      existingTags: string[];
    };

export interface JournalTagSuggestionResponse {
  tags: string[];
}

export interface JournalTopicSuggestionRequest {
  contentText: string;
}

export interface JournalTopicSuggestionResponse {
  topic: string;
}

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

function withVisitorId(init: RequestInit, visitorId: string | null | undefined): RequestInit {
  if (!visitorId) return init;
  return {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      'X-Journal-Visitor-Id': visitorId,
    },
  };
}

export function requestTagSuggestions(
  input: JournalTagSuggestionRequest,
): Promise<JournalTagSuggestionResponse> {
  return requestJson<JournalTagSuggestionResponse>(
    '/api/me/tag-suggestions',
    jsonRequest('POST', input),
  );
}

export function requestTopicSuggestion(
  input: JournalTopicSuggestionRequest,
): Promise<JournalTopicSuggestionResponse> {
  return requestJson<JournalTopicSuggestionResponse>(
    '/api/me/topic-suggestion',
    jsonRequest('POST', input),
  );
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

export function fetchPhotoLibrary(): Promise<PhotoLibraryOverview> {
  return requestJson<PhotoLibraryOverview>('/api/photos');
}

export function fetchPhotoAlbum(albumId: string): Promise<PhotoAlbumDetail> {
  return requestJson<PhotoAlbumDetail>(
    `/api/photos/albums/${encodeURIComponent(albumId)}`,
  );
}

export function fetchGames(): Promise<GameItem[]> {
  return requestJson<GameItem[]>('/api/games');
}

export function createGame(input: GameInput): Promise<GameItem> {
  return requestJson<GameItem>('/api/me/games', jsonRequest('POST', input));
}

export function updateGame(id: string, input: GameInput): Promise<GameItem> {
  return requestJson<GameItem>(
    `/api/me/games/${encodeURIComponent(id)}`,
    jsonRequest('PUT', input),
  );
}

export function uploadGameImage(
  id: string,
  file: File,
  role: GameImageRole,
): Promise<GameItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('role', role);
  return requestJson<GameItem>(
    `/api/me/games/${encodeURIComponent(id)}/images`,
    { method: 'POST', body: form },
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

export function fetchEntryInteractions(
  publicId: string,
  visitorId?: string | null,
): Promise<JournalPublicInteractionsResponse> {
  return requestJson<JournalPublicInteractionsResponse>(
    `/api/entries/${encodeURIComponent(publicId)}/interactions`,
    withVisitorId({}, visitorId),
  );
}

export function setEntryReaction(
  publicId: string,
  visitorId: string | null,
  reacted: boolean,
): Promise<JournalReactionResponse> {
  return requestJson<JournalReactionResponse>(
    `/api/entries/${encodeURIComponent(publicId)}/reaction`,
    withVisitorId({ method: reacted ? 'PUT' : 'DELETE' }, visitorId),
  );
}

export function createEntryComment(
  publicId: string,
  visitorId: string | null,
  input: { authorName: string; content: string; website: string },
): Promise<JournalVisitorCommentResponse> {
  return requestJson<JournalVisitorCommentResponse>(
    `/api/entries/${encodeURIComponent(publicId)}/comments`,
    withVisitorId(jsonRequest('POST', input), visitorId),
  );
}

export function fetchAdminEntryInteractions(
  entryId: number,
): Promise<JournalAdminInteractionsResponse> {
  return requestJson<JournalAdminInteractionsResponse>(
    `/api/me/entries/${entryId}/interactions`,
  );
}

export function createOwnerCommentReply(
  entryId: number,
  input: { parentId: number; content: string },
): Promise<JournalAdminCommentMutationResponse> {
  return requestJson<JournalAdminCommentMutationResponse>(
    `/api/me/entries/${entryId}/comments`,
    jsonRequest('POST', input),
  );
}

export function updateAdminCommentStatus(
  commentId: number,
  status: JournalAdminCommentStatus,
): Promise<JournalAdminCommentMutationResponse> {
  return requestJson<JournalAdminCommentMutationResponse>(
    `/api/me/comments/${commentId}/status`,
    jsonRequest('PATCH', { status }),
  );
}

export function deleteAdminComment(
  commentId: number,
): Promise<JournalAdminCommentDeletionResponse> {
  return requestJson<JournalAdminCommentDeletionResponse>(
    `/api/me/comments/${commentId}`,
    { method: 'DELETE' },
  );
}

export function fetchPublicDiscoverySearch(options: {
  query: string;
  cursor?: string;
}): Promise<JournalDiscoverySearchResponse> {
  const params = new URLSearchParams({ q: options.query });
  if (options.cursor) params.set('cursor', options.cursor);
  return requestJson<JournalDiscoverySearchResponse>(
    `/api/discovery/search?${params.toString()}`,
  );
}

export function fetchPublicDiscoveryArchive(): Promise<JournalDiscoveryArchiveOverview> {
  return requestJson<JournalDiscoveryArchiveOverview>('/api/discovery/archive');
}

export function fetchPublicDiscoveryArchiveMonth(options: {
  year: number;
  month: number;
  cursor?: string;
}): Promise<JournalDiscoveryArchiveMonthResponse> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.size ? `?${params.toString()}` : '';
  return requestJson<JournalDiscoveryArchiveMonthResponse>(
    `/api/discovery/archive/${options.year}/${String(options.month).padStart(2, '0')}${query}`,
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

export function fetchAuthenticationState(): Promise<{ authenticated: boolean }> {
  return requestJson<{ authenticated: boolean }>('/api/auth/session');
}

export function fetchSiteProfile(): Promise<SiteProfile> {
  return requestJson<SiteProfile>('/api/site-profile');
}

export function fetchPublicResume(): Promise<JournalPublicResume> {
  return requestJson<JournalPublicResume>('/api/resume');
}

export function unlockResume(password: string): Promise<JournalPublicResume> {
  return requestJson<JournalPublicResume>(
    '/api/resume/unlock',
    jsonRequest('POST', { password }),
  );
}

export function exchangeResumeShareToken(token: string): Promise<JournalPublicResume> {
  return requestJson<JournalPublicResume>('/api/resume/share-session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchAdminResume(): Promise<JournalAdminResumeSummary | null> {
  return requestJson<JournalAdminResumeSummary | null>('/api/me/resume');
}

export function uploadResume(file: File): Promise<JournalAdminResumeSummary> {
  const form = new FormData();
  form.append('resume', file);
  return requestJson<JournalAdminResumeSummary>('/api/me/resume', { method: 'PUT', body: form });
}

export function updateResumeAccess(
  input: JournalResumeAccessInput,
): Promise<JournalResumeAccessUpdateResponse> {
  return requestJson<JournalResumeAccessUpdateResponse>(
    '/api/me/resume/access',
    jsonRequest('PUT', input),
  );
}

export function deleteResume(): Promise<void> {
  return requestWithoutResponse('/api/me/resume', { method: 'DELETE' });
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

export function createAdminContributionLink(
  lifetime: ContributionLinkLifetime,
): Promise<{ link: AdminContributionLink }> {
  return requestJson<{ link: AdminContributionLink }>(
    '/api/private/contribution-link',
    jsonRequest('POST', { lifetime }),
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

export function fetchArticle(id: number): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/articles/${id}`);
}

export function createArticle(input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
  aiGenerated: boolean;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>('/api/me/articles', jsonRequest('POST', input));
}

export function updateArticle(id: number, input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
  aiGenerated: boolean;
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
