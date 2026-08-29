import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  journalCommentStatusRequestSchema,
  journalOwnerReplyRequestSchema,
  journalVisitorCommentRequestSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import { journalVisitorClientHash } from '../interactionIdentity.js';
import type { JournalInteractionService } from '../interactionService.js';
import type { JournalPublishedAccess, JournalRepository } from '../repository.js';

const visitorIdSchema = z.string().uuid();

const commentRateLimit = {
  max: 3,
  timeWindow: '10 minutes',
  keyGenerator: (request: FastifyRequest) => visitorIdHeader(request) ?? '',
  errorResponseBuilder: () => ({ error: '评论发送太频繁，请稍后再试。' }),
};

const reactionRateLimit = {
  max: 20,
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest) => visitorIdHeader(request) ?? '',
  errorResponseBuilder: () => ({ error: '操作太频繁，请稍后再试。' }),
};

function visitorIdHeader(request: FastifyRequest): string | null {
  const raw = request.headers['x-journal-visitor-id'];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function visitorClientHash(request: FastifyRequest, secret: string): string | null {
  const raw = visitorIdHeader(request);
  if (raw === null) return null;
  return journalVisitorClientHash(visitorIdSchema.parse(raw), secret);
}

function requireVisitorClientHash(request: FastifyRequest, secret: string): string {
  const hash = visitorClientHash(request, secret);
  if (hash === null) {
    const missing = new Error('X-Journal-Visitor-Id header is required.') as Error & {
      statusCode: number;
    };
    missing.statusCode = 400;
    throw missing;
  }
  return hash;
}

export function registerInteractionRoutes(
  server: FastifyInstance,
  options: {
    auth: JournalAuth;
    repository: JournalRepository;
    service: JournalInteractionService;
    visitorSecret: string;
  },
): void {
  const { auth, repository, service, visitorSecret } = options;

  function readAccessibleEntry(
    request: FastifyRequest,
    reply: FastifyReply,
    publicId: string,
  ): JournalPublishedAccess | null {
    const access = repository.getPublishedAccessByPublicId(publicId);
    if (!access || access.visibility === 'private') {
      void reply.code(404).send({ error: 'Public Journal entry was not found.' });
      return null;
    }
    if (access.visibility === 'public') return access;
    if (
      auth.isAdmin(request)
      || auth.hasProtectedAccess(request, access.publicId, access.accessRevision)
    ) {
      return access;
    }
    void reply.code(404).send({ error: 'Public Journal entry was not found.' });
    return null;
  }

  server.get('/api/entries/:publicId/interactions', async (request, reply) => {
    const { publicId } = z.object({ publicId: z.string().uuid() }).parse(request.params);
    const access = readAccessibleEntry(request, reply, publicId);
    if (!access) return reply;
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Vary', 'Cookie, X-Journal-Visitor-Id');
    return service.listPublic(access.entry.id, visitorClientHash(request, visitorSecret));
  });

  server.put('/api/entries/:publicId/reaction', {
    config: { rateLimit: reactionRateLimit },
  }, async (request, reply) => {
    const { publicId } = z.object({ publicId: z.string().uuid() }).parse(request.params);
    const access = readAccessibleEntry(request, reply, publicId);
    if (!access) return reply;
    const clientHash = requireVisitorClientHash(request, visitorSecret);
    reply.header('Cache-Control', 'private, no-store');
    return service.react(access.entry.id, clientHash, true);
  });

  server.delete('/api/entries/:publicId/reaction', {
    config: { rateLimit: reactionRateLimit },
  }, async (request, reply) => {
    const { publicId } = z.object({ publicId: z.string().uuid() }).parse(request.params);
    const access = readAccessibleEntry(request, reply, publicId);
    if (!access) return reply;
    const clientHash = requireVisitorClientHash(request, visitorSecret);
    reply.header('Cache-Control', 'private, no-store');
    return service.react(access.entry.id, clientHash, false);
  });

  server.post('/api/entries/:publicId/comments', {
    config: { rateLimit: commentRateLimit },
  }, async (request, reply) => {
    const { publicId } = z.object({ publicId: z.string().uuid() }).parse(request.params);
    const access = readAccessibleEntry(request, reply, publicId);
    if (!access) return reply;
    const clientHash = requireVisitorClientHash(request, visitorSecret);
    const input = journalVisitorCommentRequestSchema.parse(request.body);
    reply.header('Cache-Control', 'private, no-store');
    const response = await service.createVisitorComment(access.entry.id, clientHash, {
      authorName: input.authorName,
      content: input.content,
    });
    return reply.code(201).send(response);
  });

  server.get('/api/me/entries/:id/interactions', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    return service.listAdmin(id);
  });

  server.post('/api/me/entries/:id/comments', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const input = journalOwnerReplyRequestSchema.parse(request.body);
    return service.createOwnerReply(id, input);
  });

  server.patch('/api/me/comments/:commentId/status', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { commentId } = z.object({ commentId: z.coerce.number().int().positive() })
      .parse(request.params);
    const input = journalCommentStatusRequestSchema.parse(request.body);
    return service.setCommentStatus(commentId, input.status);
  });

  server.delete('/api/me/comments/:commentId', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { commentId } = z.object({ commentId: z.coerce.number().int().positive() })
      .parse(request.params);
    return service.deleteComment(commentId);
  });

  server.patch('/api/internal/comments/:commentId/status', {
    preHandler: auth.requireInternal,
  }, async (request) => {
    const { commentId } = z.object({ commentId: z.coerce.number().int().positive() })
      .parse(request.params);
    const input = journalCommentStatusRequestSchema.parse(request.body);
    return service.setCommentStatus(commentId, input.status);
  });
}
