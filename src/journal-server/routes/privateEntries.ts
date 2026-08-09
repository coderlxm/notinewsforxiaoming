import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  journalContentUpdateRequestSchema,
  journalLoginRequestSchema,
  journalPinnedUpdateRequestSchema,
  journalPlainChannelRequestSchema,
  journalPublishedWebEntryUpdateFieldsSchema,
  journalPublishedTimeUpdateRequestSchema,
  journalVisibilityRequestSchema,
  journalWebDraftUpdateFieldsSchema,
  journalWebEntryCreateFieldsSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { JournalDeletionService } from '../deletion.js';
import type { JournalRepository } from '../repository.js';
import type { JournalWebEntryService } from '../webEntryService.js';
import type { JournalWebEntryUploadService } from '../webEntryUploadService.js';

const privateEntriesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  query: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const privateEntriesPageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive()
    .refine((value) => value === 30, { message: 'pageSize must be 30.' })
    .default(30),
  visibility: z.enum(['private', 'public']).optional(),
  query: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const uploadParamsSchema = z.object({ uploadId: z.string().uuid() });
const assetUploadParamsSchema = uploadParamsSchema.extend({ assetUploadId: z.string().min(1) });

function currentShanghaiDate(): { monthDay: string; year: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!month || !day) throw new Error('Could not determine the current Asia/Shanghai date.');
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date());
  return { monthDay: `${month}-${day}`, year };
}

function shanghaiDayStart(date: string): string {
  return new Date(`${date}T00:00:00+08:00`).toISOString();
}

function shanghaiDayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999+08:00`).toISOString();
}

export async function registerPrivateEntryRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  repository: JournalRepository,
  deletionService: JournalDeletionService,
  webEntryService: JournalWebEntryService,
  webEntryUploads: JournalWebEntryUploadService,
): Promise<void> {
  server.get('/api/auth/session', async (request) => ({
    authenticated: auth.isAdmin(request),
  }));

  server.post('/api/auth/login', async (request, reply) => {
    const { password } = journalLoginRequestSchema.parse(request.body);
    if (!auth.passwordMatches(password)) {
      return reply.code(401).send({ error: 'Journal administrator password is incorrect.' });
    }
    auth.setAdminCookie(reply);
    return { ok: true };
  });

  server.post('/api/auth/logout', { preHandler: auth.requireAdmin }, async (_request, reply) => {
    auth.clearAdminCookie(reply);
    return { ok: true };
  });

  server.get('/api/me/entries', { preHandler: auth.requireAdmin }, async (request) => {
    const query = privateEntriesQuerySchema.parse(request.query);
    return repository.list({
      limit: 30,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.query ? { query: query.query } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
      ...(query.contentType ? { contentType: query.contentType } : {}),
      ...(query.from ? { from: shanghaiDayStart(query.from) } : {}),
      ...(query.to ? { to: shanghaiDayEnd(query.to) } : {}),
    });
  });

  server.get('/api/me/entries/page', { preHandler: auth.requireAdmin }, async (request) => {
    const query = privateEntriesPageQuerySchema.parse(request.query);
    return repository.listPage({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.query ? { query: query.query } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
      ...(query.contentType ? { contentType: query.contentType } : {}),
      ...(query.from ? { from: shanghaiDayStart(query.from) } : {}),
      ...(query.to ? { to: shanghaiDayEnd(query.to) } : {}),
    });
  });

  server.post('/api/me/entries', { preHandler: auth.requireAdmin }, async (request) => {
    const fields = journalWebEntryCreateFieldsSchema.parse(request.body);
    const { uploadId } = uploadParamsSchema.parse(request.body);
    return await webEntryService.createPrepared(fields, webEntryUploads.take(uploadId));
  });

  server.post('/api/me/entry-uploads', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const body = z.object({ entryId: z.number().int().positive().optional() }).parse(request.body);
    try {
      return await webEntryUploads.create(body);
    } catch (error) {
      if (error instanceof Error && error.message.includes('was not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  server.post('/api/me/entry-uploads/:uploadId/assets/:assetUploadId', {
    preHandler: auth.requireAdmin,
    bodyLimit: 1024,
  }, async (request) => {
    const { uploadId, assetUploadId } = assetUploadParamsSchema.parse(request.params);
    try {
      await webEntryUploads.process(uploadId, assetUploadId);
    } catch (error) {
      await webEntryUploads.discard(uploadId);
      throw error;
    }
    return { ok: true };
  });

  server.delete('/api/me/entry-uploads/:uploadId', { preHandler: auth.requireAdmin }, async (request) => {
    const { uploadId } = uploadParamsSchema.parse(request.params);
    await webEntryUploads.discard(uploadId);
    return { ok: true };
  });

  server.get('/api/me/entries/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const entry = repository.getByIdOrNull(id);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });

  server.patch('/api/me/entries/:id/draft', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const fields = journalWebDraftUpdateFieldsSchema.parse(request.body);
    const { uploadId } = uploadParamsSchema.parse(request.body);
    try {
      const input = {
        contentText: fields.contentText,
        channel: fields.channel,
        removedAssetIds: fields.removedAssetIds,
      };
      return fields.action === 'draft'
        ? await webEntryService.updatePreparedDraft(id, input, webEntryUploads.take(uploadId), null)
        : await webEntryService.updatePreparedDraft(id, input, webEntryUploads.take(uploadId), fields.visibility, fields.sourceCreatedAt);
    } catch (error) {
      if (error instanceof Error && error.message.includes('was not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  server.patch('/api/me/entries/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const fields = journalPublishedWebEntryUpdateFieldsSchema.parse(request.body);
    try {
      return await webEntryService.updatePreparedPublished(id, fields, webEntryUploads.take(fields.uploadId));
    } catch (error) {
      if (error instanceof Error && error.message.includes('was not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  server.get('/api/me/on-this-day', { preHandler: auth.requireAdmin }, async () => {
    const current = currentShanghaiDate();
    return { entries: repository.listOnThisDay(current.monthDay, current.year) };
  });

  server.patch('/api/me/entries/:id/content', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { contentText } = journalContentUpdateRequestSchema.parse(request.body);
    const entry = repository.updateContent(id, contentText);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });

  server.patch('/api/me/entries/:id/visibility', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { visibility } = journalVisibilityRequestSchema.parse(request.body);
    const entry = repository.updateVisibilityById(id, visibility);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });

  server.patch('/api/me/entries/:id/channel', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { channel } = journalPlainChannelRequestSchema.parse(request.body);
    try {
      const entry = repository.updatePlainChannel(id, channel);
      if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
      return entry;
    } catch (error) {
      if (error instanceof Error && error.message === 'Article entries cannot change channels.') {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  server.patch('/api/me/entries/:id/pinned', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { pinned } = journalPinnedUpdateRequestSchema.parse(request.body);
    const entry = repository.updatePinned(id, pinned);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });

  server.patch('/api/me/entries/:id/published-time', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { sourceCreatedAt } = journalPublishedTimeUpdateRequestSchema.parse(request.body);
    const entry = repository.updatePublishedTime(id, sourceCreatedAt);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });

  server.delete('/api/me/entries/:id', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const result = await deletionService.deleteById(id);
    if (!result) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return result;
  });
}
