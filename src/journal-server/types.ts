import type { JournalVisibility } from '../shared/journalProtocol.js';

export interface JournalServerConfig {
  telegramToken: string;
  allowedChatId: string;
  ingestToken: string;
  adminPassword: string;
  cookieSecret: string;
  publicBaseUrl: string;
  qweatherApiKey: string;
  qweatherCityId: string;
  port: number;
  host: string;
  dataDir: string;
  webRoot: string;
}

export interface TelegramAssetSource {
  kind: string;
  fileId: string;
  fileUniqueId: string;
  originalName: string | null;
  mimeType: string | null;
  declaredByteSize: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sortOrder: number;
}

export interface ParsedTelegramContent {
  sourceMessageId: number;
  mediaGroupId: string | null;
  contentType: string;
  contentText: string;
  tags: string[];
  structuredContent: Record<string, unknown> | null;
  sourceCreatedAt: string;
  assets: TelegramAssetSource[];
}

export interface StoredAssetInput extends TelegramAssetSource {
  relativePath: string;
  previewRelativePath: string | null;
  byteSize: number;
  mimeType: string | null;
}

export interface CreateJournalEntryInput {
  publicId: string;
  chatId: string;
  visibility: JournalVisibility;
  message: Record<string, unknown>;
  parsed: ParsedTelegramContent;
  capturedAt: string;
  assets: StoredAssetInput[];
}

export interface JournalListFilters {
  cursor?: string;
  visibility?: JournalVisibility;
  tag?: string;
  query?: string;
  contentType?: string;
  from?: string;
  to?: string;
  limit: number;
}

export interface JournalAssetAccess {
  id: number;
  kind: string;
  relativePath: string;
  previewRelativePath: string | null;
  originalName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  visibility: JournalVisibility;
}

export interface JournalDeletionTargetEntry {
  id: number;
  publicId: string;
  assetRelativePaths: string[];
}

export interface JournalDeletionTarget {
  entries: JournalDeletionTargetEntry[];
  assetCount: number;
}

export interface JournalImagePreviewBackfillAsset {
  id: number;
  relativePath: string;
}
