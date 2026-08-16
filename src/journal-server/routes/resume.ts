import { create as contentDisposition } from 'content-disposition';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  journalResumeAccessInputSchema,
  journalResumeUnlockRequestSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import {
  JournalResumeInputError,
  JournalResumeNotFoundError,
  JournalResumePasswordError,
  type JournalResumeService,
} from '../resumeService.js';

const maxResumeUploadBytes = 10 * 1024 * 1024;

const revisionQuerySchema = z.object({
  v: z.coerce.number().int().positive().optional(),
});

const previewPageParamsSchema = z.object({
  pageNumber: z.coerce.number().int().positive(),
  theme: z.enum(['light', 'dark']),
});

export async function registerResumeRoutes(
  server: FastifyInstance,
  dependencies: {
    auth: JournalAuth;
    resumeService: JournalResumeService;
  },
): Promise<void> {
  const { auth, resumeService } = dependencies;

  server.get('/api/resume', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const content = resumeService.resolveContent(request);
    if (!content) return reply.code(404).send({ error: '简历未找到或当前不可访问。' });
    return content;
  });

  server.get('/api/resume/file', async (request, reply) => {
    revisionQuerySchema.parse(request.query);
    const record = resumeService.authorize(request);
    if (!record) return reply.code(404).send({ error: '简历未找到或当前不可访问。' });
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Disposition', contentDisposition(record.originalName, { type: 'inline' }));
    reply.type(record.format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8');
    return reply.send(record.content);
  });

  server.get('/api/resume/pages/:pageNumber/:theme', async (request, reply) => {
    revisionQuerySchema.parse(request.query);
    const { pageNumber, theme } = previewPageParamsSchema.parse(request.params);
    const content = resumeService.resolvePreviewPage(request, pageNumber, theme);
    if (!content) return reply.code(404).send({ error: '简历预览页不存在或当前不可访问。' });
    reply.header('Cache-Control', 'private, no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.type('image/webp');
    return reply.send(content);
  });

  server.get('/api/resume/download', async (request, reply) => {
    revisionQuerySchema.parse(request.query);
    const record = resumeService.authorize(request);
    if (!record) return reply.code(404).send({ error: '简历未找到或当前不可访问。' });
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header(
      'Content-Disposition',
      contentDisposition(record.originalName, { type: 'attachment' }),
    );
    reply.type(record.format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8');
    return reply.send(record.content);
  });

  server.post('/api/resume/unlock', {
    config: { rateLimit: { max: 5, timeWindow: 60_000 } },
  }, async (request, reply) => {
    const { password } = journalResumeUnlockRequestSchema.parse(request.body);
    let record;
    try {
      record = resumeService.unlock(request, reply, password);
    } catch (error) {
      if (error instanceof JournalResumeNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof JournalResumePasswordError) {
        return reply.code(401).send({ error: error.message });
      }
      throw error;
    }
    reply.header('Cache-Control', 'private, no-store');
    return resumeService.contentFor(record);
  });

  server.post('/api/resume/share-session', async (request, reply) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    const record = token ? resumeService.exchangeShareToken(reply, token) : null;
    if (!record) {
      return reply.code(401).send({ error: '分享链接无效或已过期。' });
    }
    reply.header('Cache-Control', 'private, no-store');
    return resumeService.contentFor(record);
  });

  server.put('/api/me/resume', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: maxResumeUploadBytes, files: 1 } });
    if (!data) return reply.code(400).send({ error: '缺少简历文件。' });
    if (data.fieldname !== 'resume') {
      return reply.code(400).send({ error: '简历文件必须使用 resume 字段。' });
    }
    const buffer = await data.toBuffer();
    try {
      await resumeService.upload({
        buffer,
        originalName: data.filename ?? '',
        mimeType: data.mimetype,
      });
    } catch (error) {
      if (error instanceof JournalResumeInputError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
    return resumeService.adminSummary();
  });

  server.get('/api/me/resume', {
    preHandler: auth.requireAdmin,
  }, async () => resumeService.adminSummary());

  server.put('/api/me/resume/access', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const input = journalResumeAccessInputSchema.parse(request.body);
    try {
      return resumeService.updateAccess(input);
    } catch (error) {
      if (error instanceof JournalResumeNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  server.delete('/api/me/resume', {
    preHandler: auth.requireAdmin,
  }, async (_request, reply) => {
    resumeService.delete();
    return reply.code(204).send();
  });
}
