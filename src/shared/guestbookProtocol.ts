import { z } from 'zod';

export const guestbookStatusSchema = z.enum(['published', 'hidden']);
export type GuestbookStatus = z.infer<typeof guestbookStatusSchema>;

export const guestbookPublicReplySchema = z.object({
  id: z.number().int().positive(),
  parentId: z.number().int().positive(),
  authorRole: z.literal('owner'),
  authorName: z.string().min(1),
  contentHtml: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GuestbookPublicReply = z.infer<typeof guestbookPublicReplySchema>;

export const guestbookPublicMessageSchema = z.object({
  id: z.number().int().positive(),
  authorRole: z.literal('visitor'),
  authorName: z.string().min(1),
  contentHtml: z.string(),
  pinned: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  replies: z.array(guestbookPublicReplySchema),
});
export type GuestbookPublicMessage = z.infer<typeof guestbookPublicMessageSchema>;

export const guestbookAdminReplySchema = guestbookPublicReplySchema.extend({
  status: guestbookStatusSchema,
});
export type GuestbookAdminReply = z.infer<typeof guestbookAdminReplySchema>;

export const guestbookAdminMessageSchema = guestbookPublicMessageSchema
  .omit({ replies: true })
  .extend({
    status: guestbookStatusSchema,
    replies: z.array(guestbookAdminReplySchema),
  });
export type GuestbookAdminMessage = z.infer<typeof guestbookAdminMessageSchema>;

export type GuestbookMessage = GuestbookPublicMessage | GuestbookAdminMessage;

export const guestbookVisitorCreateRequestSchema = z.object({
  authorName: z.string().trim().min(1).refine(
    (value) => [...value].length <= 24,
    { message: 'Guestbook author name must not exceed 24 Unicode characters.' },
  ),
  content: z.string().trim().min(1).refine(
    (value) => [...value].length <= 1000,
    { message: 'Guestbook content must not exceed 1,000 Unicode characters.' },
  ),
  website: z.string().refine(
    (value) => value === '',
    { message: 'Guestbook form contained an unexpected field.' },
  ),
});
export type GuestbookVisitorCreateRequest = z.infer<typeof guestbookVisitorCreateRequestSchema>;

export const guestbookOwnerReplyRequestSchema = z.object({
  content: z.string().trim().min(1).refine(
    (value) => [...value].length <= 1000,
    { message: 'Guestbook reply content must not exceed 1,000 Unicode characters.' },
  ),
});
export type GuestbookOwnerReplyRequest = z.infer<typeof guestbookOwnerReplyRequestSchema>;

export const guestbookStatusRequestSchema = z.object({
  status: guestbookStatusSchema,
});
export type GuestbookStatusRequest = z.infer<typeof guestbookStatusRequestSchema>;

export const guestbookPinnedRequestSchema = z.object({
  pinned: z.boolean(),
});
export type GuestbookPinnedRequest = z.infer<typeof guestbookPinnedRequestSchema>;

export const guestbookPublicListResponseSchema = z.object({
  messages: z.array(guestbookPublicMessageSchema),
});
export type GuestbookPublicListResponse = z.infer<typeof guestbookPublicListResponseSchema>;

export const guestbookAdminListResponseSchema = z.object({
  messages: z.array(guestbookAdminMessageSchema),
});
export type GuestbookAdminListResponse = z.infer<typeof guestbookAdminListResponseSchema>;

export const guestbookVisitorCreateResponseSchema = z.object({
  message: guestbookPublicMessageSchema,
});
export type GuestbookVisitorCreateResponse = z.infer<typeof guestbookVisitorCreateResponseSchema>;

export const guestbookOwnerReplyResponseSchema = z.object({
  parentId: z.number().int().positive(),
  reply: guestbookAdminReplySchema,
});
export type GuestbookOwnerReplyResponse = z.infer<typeof guestbookOwnerReplyResponseSchema>;

export const guestbookStatusMutationResponseSchema = z.object({
  id: z.number().int().positive(),
  status: guestbookStatusSchema,
  updatedAt: z.string().datetime(),
});
export type GuestbookStatusMutationResponse = z.infer<
  typeof guestbookStatusMutationResponseSchema
>;

export const guestbookPinnedMutationResponseSchema = z.object({
  id: z.number().int().positive(),
  pinned: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type GuestbookPinnedMutationResponse = z.infer<
  typeof guestbookPinnedMutationResponseSchema
>;

export const guestbookDeletionResponseSchema = z.object({
  id: z.number().int().positive(),
});
export type GuestbookDeletionResponse = z.infer<typeof guestbookDeletionResponseSchema>;
