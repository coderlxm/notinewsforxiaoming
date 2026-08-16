import { z } from 'zod';

export const journalVisibilitySchema = z.enum(['private', 'protected', 'public']);
export type JournalVisibility = z.infer<typeof journalVisibilitySchema>;

export const journalAccessPasswordSchema = z.string().regex(/^\d{6}$/, {
  message: 'Access password must contain exactly 6 digits.',
});
export type JournalAccessPassword = z.infer<typeof journalAccessPasswordSchema>;

export const journalSourceKindSchema = z.enum(['telegram', 'web']);
export type JournalSourceKind = z.infer<typeof journalSourceKindSchema>;

export const journalBodyFormatSchema = z.enum(['plain', 'rich']);
export type JournalBodyFormat = z.infer<typeof journalBodyFormatSchema>;

export const journalPublicationStatusSchema = z.enum(['draft', 'published']);
export type JournalPublicationStatus = z.infer<typeof journalPublicationStatusSchema>;

export const journalChannelSchema = z.enum(['life', 'article', 'interest']);
export type JournalChannel = z.infer<typeof journalChannelSchema>;

export const journalPlainChannelSchema = z.enum(['life', 'interest']);
export type JournalPlainChannel = z.infer<typeof journalPlainChannelSchema>;

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
  posterUrl: z.string().min(1).nullable(),
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
  channel: journalChannelSchema,
  visibility: journalVisibilitySchema,
  tags: z.array(z.string()),
  pinned: z.boolean(),
  aiGenerated: z.boolean(),
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
  aiGenerated: z.boolean(),
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

export const journalWebEntryTitleSchema = z.string().trim().min(1).refine(
  (value) => [...value].length <= 60,
  { message: 'Web entry title must not exceed 60 Unicode characters.' },
).nullable();
export type JournalWebEntryTitle = z.infer<typeof journalWebEntryTitleSchema>;

const journalWebEntryDraftFieldsSchema = z.object({
  title: journalWebEntryTitleSchema,
  contentText: z.string(),
  action: z.literal('draft'),
  uploadId: z.string().uuid(),
  channel: journalPlainChannelSchema,
  visibility: z.never().optional(),
  sourceCreatedAt: z.never().optional(),
});

const journalWebEntryPublishFieldsSchema = z.object({
  title: journalWebEntryTitleSchema,
  contentText: z.string(),
  action: z.literal('publish'),
  uploadId: z.string().uuid(),
  channel: journalPlainChannelSchema,
  visibility: journalVisibilitySchema,
  accessPassword: journalAccessPasswordSchema.optional(),
  sourceCreatedAt: z.string().datetime({ offset: true }).optional(),
});

export const journalWebEntryCreateFieldsSchema = z.discriminatedUnion('action', [
  journalWebEntryDraftFieldsSchema,
  journalWebEntryPublishFieldsSchema,
]).superRefine((fields, context) => {
  if (fields.action !== 'publish') return;
  if (fields.visibility === 'protected' && fields.accessPassword === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['accessPassword'],
      message: 'Protected Journal entries require a 6-digit access password.',
    });
  }
  if (fields.visibility !== 'protected' && fields.accessPassword !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['accessPassword'],
      message: 'Only protected Journal entries accept an access password.',
    });
  }
});
export type JournalWebEntryCreateFields = z.infer<typeof journalWebEntryCreateFieldsSchema>;

export const journalWebDraftUpdateFieldsSchema = z.discriminatedUnion('action', [
  journalWebEntryDraftFieldsSchema.extend({
    removedAssetIds: z.array(z.number().int().positive()),
  }),
  journalWebEntryPublishFieldsSchema.extend({
    removedAssetIds: z.array(z.number().int().positive()),
  }),
]).superRefine((fields, context) => {
  if (fields.action !== 'publish') return;
  if (fields.visibility === 'protected' && fields.accessPassword === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['accessPassword'],
      message: 'Protected Journal entries require a 6-digit access password.',
    });
  }
  if (fields.visibility !== 'protected' && fields.accessPassword !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['accessPassword'],
      message: 'Only protected Journal entries accept an access password.',
    });
  }
});
export type JournalWebDraftUpdateFields = z.infer<typeof journalWebDraftUpdateFieldsSchema>;

export const journalPublishedWebEntryUpdateFieldsSchema = z.object({
  title: journalWebEntryTitleSchema,
  contentText: z.string(),
  uploadId: z.string().uuid(),
  removedAssetIds: z.array(z.number().int().positive()),
  channel: journalPlainChannelSchema,
  visibility: journalVisibilitySchema,
  accessPassword: journalAccessPasswordSchema.optional(),
  sourceCreatedAt: z.string().datetime({ offset: true }),
}).superRefine((fields, context) => {
  if (fields.visibility !== 'protected' && fields.accessPassword !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['accessPassword'],
      message: 'Only protected Journal entries accept an access password.',
    });
  }
});

export const journalProtectedEntryPreviewSchema = z.object({
  kind: z.literal('protected'),
  publicId: z.string().uuid(),
  channel: journalChannelSchema,
  entryType: z.enum(['article', 'record']),
  sourceCreatedAt: z.string().datetime(),
});
export type JournalProtectedEntryPreview = z.infer<
  typeof journalProtectedEntryPreviewSchema
>;

export const journalDiscoveryEntrySummarySchema = z.object({
  kind: z.literal('entry'),
  publicId: z.string().uuid(),
  title: z.string().nullable(),
  excerpt: z.string(),
  channel: journalChannelSchema,
  entryType: z.enum(['article', 'record']),
  contentType: z.string().min(1),
  tags: z.array(z.string()),
  visibility: z.enum(['public', 'protected']),
  sourceCreatedAt: z.string().datetime(),
});
export type JournalDiscoveryEntrySummary = z.infer<
  typeof journalDiscoveryEntrySummarySchema
>;

export const journalDiscoverySearchResponseSchema = z.object({
  entries: z.array(journalDiscoveryEntrySummarySchema),
  nextCursor: z.string().nullable(),
});
export type JournalDiscoverySearchResponse = z.infer<
  typeof journalDiscoverySearchResponseSchema
>;

export const journalDiscoveryArchiveOverviewSchema = z.object({
  years: z.array(z.object({
    year: z.number().int(),
    months: z.array(z.object({
      month: z.number().int().min(1).max(12),
      count: z.number().int().nonnegative(),
    })),
  })),
});
export type JournalDiscoveryArchiveOverview = z.infer<
  typeof journalDiscoveryArchiveOverviewSchema
>;

export const journalDiscoveryArchiveMonthResponseSchema = z.object({
  entries: z.array(z.union([
    journalDiscoveryEntrySummarySchema,
    journalProtectedEntryPreviewSchema,
  ])),
  nextCursor: z.string().nullable(),
});
export type JournalDiscoveryArchiveMonthResponse = z.infer<
  typeof journalDiscoveryArchiveMonthResponseSchema
>;

export const journalFeedSchema = z.object({
  entries: z.array(z.union([journalEntrySchema, journalProtectedEntryPreviewSchema])),
  nextCursor: z.string().nullable(),
});
export type JournalFeed = z.infer<typeof journalFeedSchema>;

export const journalPageSchema = z.object({
  entries: z.array(journalEntrySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type JournalPage = z.infer<typeof journalPageSchema>;

export const journalIngestRequestSchema = z.object({
  requestId: z.string().min(3),
  visibility: journalVisibilitySchema.refine((value) => value !== 'protected', {
    message: 'Telegram ingestion only accepts private or public visibility.',
  }),
  chatId: z.string().min(1),
  message: z.record(z.string(), z.unknown()),
});
export type JournalIngestRequest = z.infer<typeof journalIngestRequestSchema>;

export const journalVisibilityRequestSchema = z.object({
  visibility: journalVisibilitySchema,
  accessPassword: journalAccessPasswordSchema.optional(),
}).superRefine((request, context) => {
  if (request.visibility !== 'protected' && request.accessPassword !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['accessPassword'],
      message: 'Only protected Journal entries accept an access password.',
    });
  }
});
export type JournalVisibilityRequest = z.infer<typeof journalVisibilityRequestSchema>;

export const journalUnlockRequestSchema = z.object({
  password: journalAccessPasswordSchema,
});
export type JournalUnlockRequest = z.infer<typeof journalUnlockRequestSchema>;

const journalSuggestedTagSchema = z.string().trim().min(1).max(32).refine(
  (tag) => !tag.includes('#'),
  { message: 'Suggested tags must not contain #.' },
).refine(
  (tag) => /^[\p{L}\p{N}_]+$/u.test(tag),
  { message: 'Suggested tags may only contain letters, numbers, and underscores.' },
);

const journalEntryTagSuggestionRequestSchema = z.object({
  kind: z.literal('entry'),
  title: journalWebEntryTitleSchema,
  contentText: z.string(),
}).strict();

const journalArticleTagSuggestionRequestSchema = z.object({
  kind: z.literal('article'),
  title: z.string().trim().min(1).max(120),
  richBody: journalRichDocumentSchema,
  existingTags: journalArticleTagsSchema,
}).strict();

export const journalTagSuggestionRequestSchema = z.discriminatedUnion('kind', [
  journalEntryTagSuggestionRequestSchema,
  journalArticleTagSuggestionRequestSchema,
]).superRefine((request, context) => {
  if (
    request.kind === 'entry'
    && request.title === null
    && request.contentText.trim() === ''
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Entry tag suggestions require a title or content text.',
    });
  }
});
export type JournalTagSuggestionRequest = z.infer<
  typeof journalTagSuggestionRequestSchema
>;

export const journalTagSuggestionModelResponseSchema = z.object({
  tags: z.array(journalSuggestedTagSchema).min(1).max(5),
}).strict();

export const journalTagSuggestionResponseSchema = z.object({
  tags: z.array(journalSuggestedTagSchema).max(5),
}).strict();
export type JournalTagSuggestionResponse = z.infer<
  typeof journalTagSuggestionResponseSchema
>;

export const journalTopicSuggestionRequestSchema = z.object({
  contentText: z.string().trim().min(1),
}).strict();
export type JournalTopicSuggestionRequest = z.infer<
  typeof journalTopicSuggestionRequestSchema
>;

const journalSuggestedTopicSchema = z.string().trim().min(1).refine(
  (topic) => [...topic].length <= 60,
  { message: 'Suggested topic must not exceed 60 Unicode characters.' },
).refine(
  (topic) => !/[\r\n\u2028\u2029]/u.test(topic),
  { message: 'Suggested topic must be a single line.' },
);

export const journalTopicSuggestionModelResponseSchema = z.object({
  topic: journalSuggestedTopicSchema,
}).strict();

export const journalTopicSuggestionResponseSchema = z.object({
  topic: journalSuggestedTopicSchema,
}).strict();
export type JournalTopicSuggestionResponse = z.infer<
  typeof journalTopicSuggestionResponseSchema
>;

export const journalPlainChannelRequestSchema = z.object({
  channel: journalPlainChannelSchema,
});
export type JournalPlainChannelRequest = z.infer<typeof journalPlainChannelRequestSchema>;

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
export const journalSiteProfileAboutIntroSchema = z.string().trim().max(1200);

const journalSiteContactKinds = [
  'telegram',
  'email',
  'wechat',
  'github',
  'website',
] as const;

export const journalSiteContactKindSchema = z.enum(journalSiteContactKinds);
export type JournalSiteContactKind = z.infer<typeof journalSiteContactKindSchema>;

export const journalSiteContactItemSchema = z.object({
  kind: journalSiteContactKindSchema,
  label: z.string().trim().min(1).max(24),
  value: z.string().trim().max(120),
  url: z.string().trim().url().max(500).nullable(),
  enabled: z.boolean(),
}).superRefine((item, context) => {
  if (item.kind === 'wechat' && item.url !== null) {
    context.addIssue({
      code: 'custom',
      message: 'WeChat contact URL must be null.',
      path: ['url'],
    });
  }
  if (!item.enabled) return;
  if (item.value.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'Enabled contact value must not be empty.',
      path: ['value'],
    });
  }
  if (item.kind !== 'wechat' && item.url === null) {
    context.addIssue({
      code: 'custom',
      message: 'Enabled linked contact URL must not be empty.',
      path: ['url'],
    });
  }
});
export type JournalSiteContactItem = z.infer<typeof journalSiteContactItemSchema>;

export const journalSiteContactItemsSchema = z
  .array(journalSiteContactItemSchema)
  .length(journalSiteContactKinds.length)
  .refine(
    items => items.every((item, index) => item.kind === journalSiteContactKinds[index]),
    'Site contacts must use the fixed channel order.',
  );

const journalChannelTagListSchema = z
  .array(z.string()
    .trim()
    .min(1)
    .max(32)
    .refine(tag => !tag.includes('#'), 'Channel tags must not contain #.')
    .refine(tag => tag !== '全部', 'The all-content tab is fixed and cannot be configured.'))
  .max(8)
  .refine(tags => new Set(tags).size === tags.length, 'Channel tags must be unique.');

export const journalChannelTagsSchema = z.object({
  life: journalChannelTagListSchema,
  article: journalChannelTagListSchema,
  interest: journalChannelTagListSchema,
});
export type JournalChannelTags = z.infer<typeof journalChannelTagsSchema>;

export const journalResumeFormatSchema = z.enum(['markdown', 'pdf']);
export type JournalResumeFormat = z.infer<typeof journalResumeFormatSchema>;

export const journalResumeAccessModeSchema = z.enum(['private', 'protected', 'temporary', 'public']);
export type JournalResumeAccessMode = z.infer<typeof journalResumeAccessModeSchema>;

export const journalResumePreviewPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string().min(1),
});
export type JournalResumePreviewPage = z.infer<typeof journalResumePreviewPageSchema>;

export const journalResumeSummarySchema = z.object({
  format: journalResumeFormatSchema,
  originalName: z.string().min(1),
  updatedAt: z.string().datetime(),
  viewUrl: z.literal('/resume'),
  accessMode: z.enum(['protected', 'public']),
});
export type JournalResumeSummary = z.infer<typeof journalResumeSummarySchema>;

export const journalPublicResumeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('locked'),
    accessMode: z.literal('protected'),
  }),
  z.object({
    kind: z.literal('resume'),
    format: z.literal('markdown'),
    accessMode: journalResumeAccessModeSchema,
    originalName: z.string().min(1),
    updatedAt: z.string().datetime(),
    renderedHtml: z.string().min(1),
    downloadUrl: z.string().min(1),
  }),
  z.object({
    kind: z.literal('resume'),
    format: z.literal('pdf'),
    accessMode: journalResumeAccessModeSchema,
    originalName: z.string().min(1),
    updatedAt: z.string().datetime(),
    contentUrl: z.string().min(1),
    downloadUrl: z.string().min(1),
    previewPages: z.array(journalResumePreviewPageSchema).min(1),
  }),
]);
export type JournalPublicResume = z.infer<typeof journalPublicResumeSchema>;

export const journalAdminResumeSummarySchema = z.object({
  format: journalResumeFormatSchema,
  originalName: z.string().min(1),
  updatedAt: z.string().datetime(),
  accessMode: journalResumeAccessModeSchema,
  temporaryShare: z.object({
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }).nullable(),
});
export type JournalAdminResumeSummary = z.infer<typeof journalAdminResumeSummarySchema>;

export const journalResumeAccessInputSchema = z.discriminatedUnion('accessMode', [
  z.object({ accessMode: z.literal('private') }).strict(),
  z.object({
    accessMode: z.literal('protected'),
    password: journalAccessPasswordSchema,
  }).strict(),
  z.object({
    accessMode: z.literal('temporary'),
    expiresAt: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({ accessMode: z.literal('public') }).strict(),
]);
export type JournalResumeAccessInput = z.infer<typeof journalResumeAccessInputSchema>;

export const journalResumeUnlockRequestSchema = z.object({
  password: journalAccessPasswordSchema,
});
export type JournalResumeUnlockRequest = z.infer<typeof journalResumeUnlockRequestSchema>;

export const journalSiteProfileSchema = z.object({
  bio: journalSiteProfileBioSchema,
  avatarUrl: z.string().min(1),
  weatherEnabled: z.boolean(),
  channelTags: journalChannelTagsSchema,
  aboutIntro: journalSiteProfileAboutIntroSchema,
  contactItems: journalSiteContactItemsSchema,
  resume: journalResumeSummarySchema.nullable(),
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
  visibility: z.enum(['private', 'public']),
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
