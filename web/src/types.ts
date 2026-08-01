export type JournalVisibility = 'private' | 'public';
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
  structuredContent: Record<string, unknown> | null;
  sourceCreatedAt: string;
  capturedAt: string;
  updatedAt: string;
  assets: JournalAsset[];
}

export interface JournalFeed {
  entries: JournalEntry[];
  nextCursor: string | null;
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
  updatedAt: string;
}

export interface AdminContributionLink {
  url?: string;
  expiresAt: string;
  createdAt: string;
}

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
