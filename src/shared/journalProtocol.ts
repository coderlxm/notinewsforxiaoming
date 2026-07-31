import { z } from 'zod';

export const journalVisibilitySchema = z.enum(['private', 'public']);
export type JournalVisibility = z.infer<typeof journalVisibilitySchema>;

export const journalSourceKindSchema = z.enum(['telegram', 'web']);
export type JournalSourceKind = z.infer<typeof journalSourceKindSchema>;

export const journalBodyFormatSchema = z.enum(['plain', 'rich']);
export type JournalBodyFormat = z.infer<typeof journalBodyFormatSchema>;

export const journalPublicationStatusSchema = z.enum(['draft', 'published']);
export type JournalPublicationStatus = z.infer<typeof journalPublicationStatusSchema>;

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
  publicationStatus: journalPublicationStatusSchema,
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

const journalWebEntryDraftFieldsSchema = z.object({
  contentText: z.string(),
  action: z.literal('draft'),
  uploadId: z.string().uuid(),
  visibility: z.never().optional(),
});

const journalWebEntryPublishFieldsSchema = z.object({
  contentText: z.string(),
  action: z.literal('publish'),
  uploadId: z.string().uuid(),
  visibility: journalVisibilitySchema,
});

export const journalWebEntryCreateFieldsSchema = z.discriminatedUnion('action', [
  journalWebEntryDraftFieldsSchema,
  journalWebEntryPublishFieldsSchema,
]);
export type JournalWebEntryCreateFields = z.infer<typeof journalWebEntryCreateFieldsSchema>;

export const journalWebDraftUpdateFieldsSchema = z.discriminatedUnion('action', [
  journalWebEntryDraftFieldsSchema.extend({
    removedAssetIds: z.array(z.number().int().positive()),
  }),
  journalWebEntryPublishFieldsSchema.extend({
    removedAssetIds: z.array(z.number().int().positive()),
  }),
]);
export type JournalWebDraftUpdateFields = z.infer<typeof journalWebDraftUpdateFieldsSchema>;

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

export const journalPublishedTimeUpdateRequestSchema = z.object({
  sourceCreatedAt: z.string().datetime({ offset: true }),
});
export type JournalPublishedTimeUpdateRequest = z.infer<
  typeof journalPublishedTimeUpdateRequestSchema
>;

export const journalDeletionResultSchema = z.object({
  deletedEntryCount: z.number().int().positive(),
  deletedAssetCount: z.number().int().nonnegative(),
});
export type JournalDeletionResult = z.infer<typeof journalDeletionResultSchema>;

export const journalApiErrorSchema = z.object({
  error: z.string().min(1),
});
export type JournalApiError = z.infer<typeof journalApiErrorSchema>;

export const journalSiteProfileBioSchema = z.string().trim().max(120);

export const journalSiteProfileSchema = z.object({
  bio: journalSiteProfileBioSchema,
  avatarUrl: z.string().min(1),
  weatherEnabled: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type JournalSiteProfile = z.infer<typeof journalSiteProfileSchema>;

export const journalCurrentWeatherSchema = z.object({
  text: z.string().min(1),
  temperature: z.number(),
  feelsLike: z.number(),
  windDirection: z.string().min(1),
  observedAt: z.string().datetime({ offset: true }),
});
export type JournalCurrentWeather = z.infer<typeof journalCurrentWeatherSchema>;

export const journalContributionAssetKindSchema = z.enum(['photo', 'video']);
export type JournalContributionAssetKind = z.infer<
  typeof journalContributionAssetKindSchema
>;

export const journalContributionAssetSchema = z.object({
  id: z.number().int().positive(),
  kind: journalContributionAssetKindSchema,
  url: z.string().min(1),
  previewUrl: z.string().min(1),
  sourceName: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration: z.number().nonnegative().nullable(),
  sortOrder: z.number().int().nonnegative(),
});
export type JournalContributionAsset = z.infer<typeof journalContributionAssetSchema>;

export const journalContributionSummarySchema = z.object({
  publicId: z.string().uuid(),
  senderName: z.string().min(1),
  contentText: z.string(),
  submittedAt: z.string().datetime(),
  photoCount: z.number().int().nonnegative(),
  videoCount: z.number().int().nonnegative(),
  assets: z.array(journalContributionAssetSchema).max(4),
});
export type JournalContributionSummary = z.infer<typeof journalContributionSummarySchema>;

export const journalContributionDetailSchema = z.object({
  publicId: z.string().uuid(),
  senderName: z.string().min(1),
  contentText: z.string(),
  submittedAt: z.string().datetime(),
  assets: z.array(journalContributionAssetSchema),
});
export type JournalContributionDetail = z.infer<typeof journalContributionDetailSchema>;

export const journalContributionPublishRequestSchema = z.object({
  contentText: z.string().refine((value) => [...value].length <= 2000, {
    message: 'Contribution content must not exceed 2,000 Unicode characters.',
  }),
  assetIds: z.array(z.number().int().positive()).max(30)
    .refine((assetIds) => new Set(assetIds).size === assetIds.length, {
      message: 'Contribution asset IDs must be unique.',
    }),
  sourceCreatedAt: z.string().datetime({ offset: true }),
  visibility: journalVisibilitySchema,
}).refine(
  ({ contentText, assetIds }) => contentText.trim() !== '' || assetIds.length > 0,
  { message: 'Published contribution must include text or at least one asset.' },
);
export type JournalContributionPublishRequest = z.infer<
  typeof journalContributionPublishRequestSchema
>;

export const journalContributionSubmissionResponseSchema = z.object({
  contribution: z.object({
    publicId: z.string().uuid(),
    senderName: z.string().min(1),
    assetCount: z.number().int().nonnegative(),
    submittedAt: z.string().datetime(),
  }),
});
export type JournalContributionSubmissionResponse = z.infer<
  typeof journalContributionSubmissionResponseSchema
>;

export const journalContributionErrorCodeSchema = z.enum([
  'LINK_EXPIRED',
  'LINK_REVOKED',
  'INVALID_FORM',
  'TOO_MANY_ASSETS',
  'TOO_MANY_VIDEOS',
  'FILE_TOO_LARGE',
  'CONTRIBUTION_TOO_LARGE',
  'IMAGE_FORMAT_UNSUPPORTED',
  'IMAGE_PIXEL_LIMIT_EXCEEDED',
  'VIDEO_FORMAT_UNSUPPORTED',
  'VIDEO_DURATION_EXCEEDED',
  'MEDIA_PROCESSING_FAILED',
]);
export type JournalContributionErrorCode = z.infer<
  typeof journalContributionErrorCodeSchema
>;
