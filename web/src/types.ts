export type JournalVisibility = 'private' | 'protected' | 'public';
export type JournalPublicationStatus = 'draft' | 'published';
export type JournalChannel = 'life' | 'article' | 'interest';
export type JournalPlainChannel = Exclude<JournalChannel, 'article'>;
export type AssetView = 'waterfall' | 'table';

export type ChannelTags = Record<JournalChannel, string[]>;

export type JournalSourceKind = 'telegram' | 'web';
export type JournalBodyFormat = 'plain' | 'rich';
export type JournalAssetSourceKind = 'telegram' | 'web';
export type JournalAssetRole = 'attachment' | 'cover' | 'inline';

export interface JournalRichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JournalRichNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface JournalRichDocument {
  type: 'doc';
  content: JournalRichNode[];
}

export interface JournalAsset {
  id: number;
  sourceKind: JournalAssetSourceKind;
  role: JournalAssetRole;
  kind: string;
  url: string;
  previewUrl: string | null;
  posterUrl: string | null;
  originalName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

export interface JournalEntry {
  id: number;
  publicId: string;
  sourceKind: JournalSourceKind;
  contentType: string;
  title: string | null;
  bodyFormat: JournalBodyFormat;
  richBody: JournalRichDocument | null;
  contentText: string;
  channel: JournalChannel;
  visibility: JournalVisibility;
  publicationStatus: JournalPublicationStatus;
  tags: string[];
  pinned: boolean;
  aiGenerated: boolean;
  structuredContent: Record<string, unknown> | null;
  sourceCreatedAt: string;
  capturedAt: string;
  updatedAt: string;
  assets: JournalAsset[];
}

export interface ProtectedJournalEntryPreview {
  kind: 'protected';
  publicId: string;
  channel: JournalChannel;
  entryType: 'record' | 'article';
  sourceCreatedAt: string;
}

export interface JournalDiscoveryEntrySummary {
  kind: 'entry';
  publicId: string;
  title: string | null;
  excerpt: string;
  channel: JournalChannel;
  entryType: 'record' | 'article';
  contentType: string;
  tags: string[];
  visibility: 'public' | 'protected';
  sourceCreatedAt: string;
}

export interface JournalDiscoverySearchResponse {
  entries: JournalDiscoveryEntrySummary[];
  nextCursor: string | null;
}

export interface JournalDiscoveryArchiveOverview {
  years: Array<{
    year: number;
    months: Array<{
      month: number;
      count: number;
    }>;
  }>;
}

export interface JournalDiscoveryArchiveMonthResponse {
  entries: Array<JournalDiscoveryEntrySummary | ProtectedJournalEntryPreview>;
  nextCursor: string | null;
}

export type JournalDiscoveryListItem = JournalDiscoveryArchiveMonthResponse['entries'][number];

export type PublicJournalFeedItem = JournalEntry | ProtectedJournalEntryPreview;
export type PublicJournalEntryResponse = JournalEntry | ProtectedJournalEntryPreview;

export function isProtectedJournalEntry(
  entry: PublicJournalFeedItem,
): entry is ProtectedJournalEntryPreview {
  return 'kind' in entry && entry.kind === 'protected';
}

export interface JournalFeed {
  entries: JournalEntry[];
  nextCursor: string | null;
}

export interface PublicJournalFeed {
  entries: PublicJournalFeedItem[];
  nextCursor: string | null;
}

export interface JournalPage {
  entries: JournalEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OnThisDayResponse {
  entries: JournalEntry[];
}

export interface JournalDeletionResult {
  deletedEntryCount: number;
  deletedAssetCount: number;
}

export interface JournalApiError {
  error: string;
}

export type SiteContactKind = 'telegram' | 'email' | 'wechat' | 'github' | 'website';

export interface SiteContactItem {
  kind: SiteContactKind;
  label: string;
  value: string;
  url: string | null;
  enabled: boolean;
}

export interface SiteProfile {
  bio: string;
  avatarUrl: string;
  weatherEnabled: boolean;
  channelTags: ChannelTags;
  aboutIntro: string;
  contactItems: SiteContactItem[];
  resume: JournalResumeSummary | null;
  updatedAt: string;
}

export type JournalResumeFormat = 'markdown' | 'pdf';
export type JournalResumeAccessMode = 'private' | 'protected' | 'temporary' | 'public';

export interface JournalResumeSummary {
  format: JournalResumeFormat;
  originalName: string;
  updatedAt: string;
  viewUrl: '/resume';
  accessMode: 'protected' | 'public';
}

export interface JournalResumePreviewPage {
  pageNumber: number;
  width: number;
  height: number;
  lightUrl: string;
  darkUrl: string;
}

export type JournalPublicResume =
  | { kind: 'locked'; accessMode: 'protected' }
  | {
      kind: 'resume';
      format: 'markdown';
      accessMode: JournalResumeAccessMode;
      originalName: string;
      updatedAt: string;
      renderedHtml: string;
      downloadUrl: string;
    }
  | {
      kind: 'resume';
      format: 'pdf';
      accessMode: JournalResumeAccessMode;
      originalName: string;
      updatedAt: string;
      contentUrl: string;
      downloadUrl: string;
      previewPages: JournalResumePreviewPage[];
    };

export interface JournalAdminResumeSummary {
  format: JournalResumeFormat;
  originalName: string;
  updatedAt: string;
  accessMode: JournalResumeAccessMode;
  temporaryShare: { createdAt: string; expiresAt: string } | null;
}

export type JournalResumeAccessInput =
  | { accessMode: 'private' }
  | { accessMode: 'protected'; password: string }
  | { accessMode: 'temporary'; expiresAt: string }
  | { accessMode: 'public' };

export interface JournalResumeAccessUpdateResponse {
  summary: JournalAdminResumeSummary;
  shareUrl: string | null;
}

export interface AdminContributionLink {
  url?: string;
  expiresAt: string | null;
  createdAt: string;
}

export type ContributionLinkLifetime = 'temporary' | 'permanent';

export interface AdminContributionAsset {
  id: number;
  kind: 'photo' | 'video';
  url: string;
  previewUrl: string;
  sourceName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  duration: number | null;
  sortOrder: number;
}

export interface AdminContributionSummary {
  publicId: string;
  senderName: string;
  contentText: string;
  submittedAt: string;
  photoCount: number;
  videoCount: number;
  assets: AdminContributionAsset[];
}

export interface AdminContributionDetail {
  publicId: string;
  senderName: string;
  contentText: string;
  submittedAt: string;
  assets: AdminContributionAsset[];
}

export interface AdminContributionListResponse {
  contributions: AdminContributionSummary[];
  pendingCount: number;
}

export interface FeedFilters {
  visibility: 'all' | JournalVisibility;
  query: string;
  tag: string;
  contentType: string;
  from: string;
  to: string;
}

export interface JournalArticleAssetResponse {
  id: number;
  role: JournalAssetRole;
  kind: string;
  url: string;
  originalName: string | null;
  mimeType: string | null;
  byteSize: number | null;
}

export const emptyFeedFilters = (): FeedFilters => ({
  visibility: 'all',
  query: '',
  tag: '',
  contentType: '',
  from: '',
  to: '',
});

export function tagsInputToString(tags: string[]): string {
  return tags.join(', ');
}

export function parseTagsInput(value: string): string[] {
  return [...new Set(
    value
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0 && tag.length <= 32),
  )].slice(0, 20);
}
