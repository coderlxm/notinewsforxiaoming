import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  journalContentUpdateRequestSchema,
  journalLoginRequestSchema,
  journalPinnedUpdateRequestSchema,
  journalPublishedTimeUpdateRequestSchema,
  journalVisibilityRequestSchema,
  journalWebDraftUpdateFieldsSchema,
  journalWebEntryCreateFieldsSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { JournalDeletionService } from '../deletion.js';
import type { JournalRepository } from '../repository.js';
import type { JournalWebEntryService } from '../webEntryService.js';
import type { WebImageUpload } from '../webImage.js';

const privateEntriesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
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

const removedAssetIdsFieldSchema = z.string().transform((value, context): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    context.addIssue({
      code: 'custom',
      message: 'removedAssetIds must be valid JSON.',
    });
    return z.NEVER;
  }
}).pipe(z.array(z.number().int().positive()));

async function readWebEntryMultipart(
  request: Parameters<JournalAuth['requireAdmin']>[0],
  imageFieldName: 'images' | 'newImages',
): Promise<{ fields: Record<string, string>; images: WebImageUpload[] }> {
  const fields: Record<string, string> = {};
  const images: WebImageUpload[] = [];
  const allowedFields = imageFieldName === 'images'
    ? new Set(['contentText', 'action', 'visibility'])
    : new Set(['contentText', 'action', 'visibility', 'removedAssetIds']);

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (part.fieldname !== imageFieldName) {
        throw new Error(`Unexpected multipart file field ${part.fieldname}.`);
      }
      images.push({
        buffer: await part.toBuffer(),
        mimeType: part.mimetype,
        originalName: part.filename || null,
      });
      continue;
    }
    if (!allowedFields.has(part.fieldname)) {
      throw new Error(`Unexpected multipart field ${part.fieldname}.`);
    }
    if (fields[part.fieldname] !== undefined) {
      throw new Error(`Multipart field ${part.fieldname} must not be repeated.`);
    }
    fields[part.fieldname] = String(part.value);
  }
  return { fields, images };
}

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

  server.post('/api/me/entries', { preHandler: auth.requireAdmin }, async (request) => {
    const multipart = await readWebEntryMultipart(request, 'images');
    const fields = journalWebEntryCreateFieldsSchema.parse(multipart.fields);
    return webEntryService.create({
      ...fields,
      images: multipart.images,
    });
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
    const multipart = await readWebEntryMultipart(request, 'newImages');
    const fields = journalWebDraftUpdateFieldsSchema.parse({
      ...multipart.fields,
      removedAssetIds: removedAssetIdsFieldSchema.parse(multipart.fields.removedAssetIds),
    });
    try {
      const input = {
        contentText: fields.contentText,
        removedAssetIds: fields.removedAssetIds,
        newImages: multipart.images,
      };
      return fields.action === 'draft'
        ? await webEntryService.updateDraft(id, input)
        : await webEntryService.publishDraft(id, {
            ...input,
            visibility: fields.visibility,
          });
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
