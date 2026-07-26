export type JournalVisibility = 'private' | 'public';
export type JournalPublicationStatus = 'draft' | 'published';

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

export interface SiteProfile {
  bio: string;
  avatarUrl: string;
  updatedAt: string;
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
