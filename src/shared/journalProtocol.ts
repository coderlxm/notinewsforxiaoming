import { z } from 'zod';

export const journalVisibilitySchema = z.enum(['private', 'public']);
export type JournalVisibility = z.infer<typeof journalVisibilitySchema>;

export const journalSourceKindSchema = z.enum(['telegram', 'web']);
export type JournalSourceKind = z.infer<typeof journalSourceKindSchema>;

export const journalBodyFormatSchema = z.enum(['plain', 'rich']);
export type JournalBodyFormat = z.infer<typeof journalBodyFormatSchema>;

export const journalAssetSourceKindSchema = z.enum(['telegram', 'web']);
export type JournalAssetSourceKind = z.infer<typeof journalAssetSourceKindSchema>;

export const journalAssetRoleSchema = z.enum(['attachment', 'cover', 'inline']);
export type JournalAssetRole = z.infer<typeof journalAssetRoleSchema>;

export interface JournalRichNode {
  type: string;
  attrs?: Record<string, unknown> | undefined;
  content?: JournalRichNode[] | undefined;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> | undefined }> | undefined;
  text?: string | undefined;
}

const journalRichMarkSchema = z.object({
  type: z.enum(['bold', 'italic', 'strike', 'code', 'link']),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

const journalRichNodeSchema: z.ZodType<JournalRichNode> = z.lazy(() => z.object({
  type: z.enum([
    'doc',
    'paragraph',
    'text',
    'heading',
    'bulletList',
    'orderedList',
    'listItem',
    'blockquote',
    'codeBlock',
    'horizontalRule',
    'hardBreak',
    'image',
  ]),
  attrs: z.record(z.string(), z.unknown()).optional(),
  content: z.array(journalRichNodeSchema).optional(),
  marks: z.array(journalRichMarkSchema).optional(),
  text: z.string().optional(),
}));

export const journalRichDocumentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(journalRichNodeSchema),
});
export type JournalRichDocument = z.infer<typeof journalRichDocumentSchema>;

export const journalAssetSchema = z.object({
  id: z.number().int().positive(),
  sourceKind: journalAssetSourceKindSchema,
  role: journalAssetRoleSchema,
  kind: z.string().min(1),
  url: z.string().min(1),
  previewUrl: z.string().min(1).nullable(),
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
  sourceKind: journalSourceKindSchema,
  contentType: z.string().min(1),
  title: z.string().nullable(),
  bodyFormat: journalBodyFormatSchema,
  richBody: journalRichDocumentSchema.nullable(),
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

export const journalArticleTagsSchema = z.array(z.string().trim().min(1).max(32)).max(20);
export type JournalArticleTags = z.infer<typeof journalArticleTagsSchema>;

export const journalArticleCreateRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  richBody: journalRichDocumentSchema,
  tags: journalArticleTagsSchema,
});
export type JournalArticleCreateRequest = z.infer<typeof journalArticleCreateRequestSchema>;

export const journalArticleUpdateRequestSchema = journalArticleCreateRequestSchema;
export type JournalArticleUpdateRequest = z.infer<typeof journalArticleUpdateRequestSchema>;

export const journalArticleAssetResponseSchema = z.object({
  id: z.number().int().positive(),
  role: journalAssetRoleSchema,
  kind: z.string(),
  url: z.string(),
  originalName: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
});
export type JournalArticleAssetResponse = z.infer<typeof journalArticleAssetResponseSchema>;

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
