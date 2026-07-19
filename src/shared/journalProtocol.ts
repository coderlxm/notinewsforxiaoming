import { z } from 'zod';

export const journalVisibilitySchema = z.enum(['private', 'public']);
export type JournalVisibility = z.infer<typeof journalVisibilitySchema>;

export const journalAssetSchema = z.object({
  id: z.number().int().positive(),
  kind: z.string().min(1),
  url: z.string().min(1),
  originalName: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  duration: z.number().int().nonnegative().nullable(),
});
export type JournalAsset = z.infer<typeof journalAssetSchema>;

export const journalEntrySchema = z.object({
  id: z.number().int().positive(),
  publicId: z.string().uuid(),
  contentType: z.string().min(1),
  contentText: z.string(),
  visibility: journalVisibilitySchema,
  tags: z.array(z.string()),
  pinned: z.boolean(),
  structuredContent: z.record(z.string(), z.unknown()).nullable(),
  sourceCreatedAt: z.string().datetime(),
  capturedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  assets: z.array(journalAssetSchema),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

export const journalFeedSchema = z.object({
  entries: z.array(journalEntrySchema),
  nextCursor: z.string().nullable(),
});
export type JournalFeed = z.infer<typeof journalFeedSchema>;

export const journalIngestRequestSchema = z.object({
  requestId: z.string().min(3),
  visibility: journalVisibilitySchema,
  chatId: z.string().min(1),
  message: z.record(z.string(), z.unknown()),
});
export type JournalIngestRequest = z.infer<typeof journalIngestRequestSchema>;

export const journalVisibilityRequestSchema = z.object({
  visibility: journalVisibilitySchema,
});
export type JournalVisibilityRequest = z.infer<typeof journalVisibilityRequestSchema>;

export const journalLoginRequestSchema = z.object({
  password: z.string().min(1),
});
export type JournalLoginRequest = z.infer<typeof journalLoginRequestSchema>;

export const journalContentUpdateRequestSchema = z.object({
  contentText: z.string(),
});
export type JournalContentUpdateRequest = z.infer<typeof journalContentUpdateRequestSchema>;

export const journalPinnedUpdateRequestSchema = z.object({
  pinned: z.boolean(),
});
export type JournalPinnedUpdateRequest = z.infer<typeof journalPinnedUpdateRequestSchema>;

export const journalDeletionResultSchema = z.object({
  deletedEntryCount: z.number().int().positive(),
  deletedAssetCount: z.number().int().nonnegative(),
});
export type JournalDeletionResult = z.infer<typeof journalDeletionResultSchema>;

export const journalApiErrorSchema = z.object({
  error: z.string().min(1),
});
export type JournalApiError = z.infer<typeof journalApiErrorSchema>;
