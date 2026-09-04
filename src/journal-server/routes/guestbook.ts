import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  guestbookOwnerReplyRequestSchema,
  guestbookPinnedRequestSchema,
  guestbookStatusRequestSchema,
  guestbookVisitorCreateRequestSchema,
} from '../../shared/guestbookProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { GuestbookService } from '../guestbookService.js';

const visitorIdSchema = z.string().uuid();

const guestbookRateLimit = {
  max: 3,
  timeWindow: '10 minutes',
  keyGenerator: (request: FastifyRequest) => visitorIdHeader(request) ?? '',
  errorResponseBuilder: () => ({ error: '留言发送太频繁，请稍后再试。' }),
};

function visitorIdHeader(request: FastifyRequest): string | null {
  const raw = request.headers['x-journal-visitor-id'];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function registerGuestbookRoutes(
  server: FastifyInstance,
  options: {
    auth: JournalAuth;
    service: GuestbookService;
  },
): void {
  const { auth, service } = options;

  server.get('/api/guestbook', async (_request, reply) => {
    reply.header('Cache-Control', 'no-cache');
    return service.listPublic();
  });

  server.post('/api/guestbook', {
    config: { rateLimit: guestbookRateLimit },
  }, async (request, reply) => {
    const visitorId = visitorIdHeader(request);
    if (visitorId === null || !visitorIdSchema.safeParse(visitorId).success) {
      return reply.code(400).send({ error: '需要有效的访客标识。' });
    }
    const input = guestbookVisitorCreateRequestSchema.parse(request.body);
    reply.header('Cache-Control', 'private, no-store');
    const response = await service.createVisitor(input);
    return reply.code(201).send(response);
  });

  server.get('/api/me/guestbook', {
    preHandler: auth.requireAdmin,
  }, async (_request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return service.listAdmin();
  });

  server.post('/api/me/guestbook/:id/replies', {
    preHandler: auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const input = guestbookOwnerReplyRequestSchema.parse(request.body);
    const response = service.createOwnerReply(id, input);
    return reply.code(201).send(response);
  });

  server.patch('/api/me/guestbook/:id/status', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const input = guestbookStatusRequestSchema.parse(request.body);
    return service.setStatus(id, input.status);
  });

  server.patch('/api/me/guestbook/:id/pinned', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const input = guestbookPinnedRequestSchema.parse(request.body);
    return service.setPinned(id, input.pinned);
  });

  server.delete('/api/me/guestbook/:id', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    return service.delete(id);
  });

  server.patch('/api/internal/guestbook/:id/status', {
    preHandler: auth.requireInternal,
  }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const input = guestbookStatusRequestSchema.parse(request.body);
    return service.setStatus(id, input.status);
  });
}
