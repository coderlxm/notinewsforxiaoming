export type JournalVisibility = 'private' | 'public';

export interface JournalAsset {
  id: number;
  kind: string;
  url: string;
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
  contentType: string;
  contentText: string;
  visibility: JournalVisibility;
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

export interface FeedFilters {
  visibility: 'all' | JournalVisibility;
  query: string;
  tag: string;
  contentType: string;
  from: string;
  to: string;
}

export const emptyFeedFilters = (): FeedFilters => ({
  visibility: 'all',
  query: '',
  tag: '',
  contentType: '',
  from: '',
  to: '',
});
