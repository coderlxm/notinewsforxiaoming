import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { JournalAuth } from '../auth.js';
import { JournalArticleService } from '../articleService.js';

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const assetParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  assetId: z.coerce.number().int().positive(),
});

const uploadRoleSchema = z.enum(['cover', 'inline']);

export async function registerArticleRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  articleService: JournalArticleService,
): Promise<void> {
  server.get('/api/me/articles/:id', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const entry = articleService.getArticleForEditing(id);
    if (!entry) return reply.code(404).send({ error: 'Article was not found.' });
    return entry;
  });

  server.post('/api/me/articles', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    return articleService.createArticle(request.body);
  });

  server.patch('/api/me/articles/:id', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    try {
      return await articleService.updateArticle(id, request.body);
    } catch (error) {
      if (error instanceof Error && error.message.includes('was not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  server.post('/api/me/articles/:id/assets', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'Missing multipart file.' });
    const buffer = await data.toBuffer();
    const roleField = data.fields.role;
    const roleValue = roleField && 'value' in roleField ? String(roleField.value) : '';
    const role = uploadRoleSchema.parse(roleValue);
    const originalName = data.filename ?? null;
    return await articleService.uploadAsset(id, role, {
      buffer,
      mimeType: data.mimetype,
      originalName,
    });
  });

  server.delete('/api/me/articles/:id/assets/:assetId', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id, assetId } = assetParamsSchema.parse(request.params);
    try {
      await articleService.deleteAsset(id, assetId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('does not belong')) {
        return reply.code(404).send({ error: message });
      }
      throw error;
    }
    return { ok: true };
  });
}
