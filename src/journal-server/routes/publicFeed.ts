import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  journalChannelSchema,
  journalUnlockRequestSchema,
  type JournalProtectedEntryPreview,
} from '../../shared/journalProtocol.js';
import { accessPasswordMatches, type JournalAuth } from '../auth.js';
import { journalVisitorClientHash } from '../interactionIdentity.js';
import type { JournalPublishedAccess, JournalRepository } from '../repository.js';

const publicFeedQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  channel: journalChannelSchema.default('life'),
});

const visitorIdSchema = z.string().uuid();

function visitorClientHash(request: { headers: Record<string, unknown> }, secret: string): string | null {
  const raw = request.headers['x-journal-visitor-id'];
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return journalVisitorClientHash(visitorIdSchema.parse(raw), secret);
}

export async function registerPublicFeedRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  repository: JournalRepository,
  visitorSecret: string,
): Promise<void> {
  server.get('/api/feed', async (request, reply) => {
    const query = publicFeedQuerySchema.parse(request.query);
    reply.header('Vary', 'Cookie, X-Journal-Visitor-Id');
    reply.header('Cache-Control', 'private, no-store');
    const administrator = auth.isAdmin(request);
    return repository.listPublicFeed({
      channel: query.channel,
      limit: 20,
      visitorClientHash: visitorClientHash(request, visitorSecret),
      canReadProtectedContent: (publicId, accessRevision) => administrator
        || auth.hasProtectedAccess(request, publicId, accessRevision),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
    });
  });

  server.get('/api/entries/:publicId', async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const access = repository.getPublishedAccessByPublicId(
      publicId,
      visitorClientHash(request, visitorSecret),
    );
    if (!access || access.visibility === 'private') {
      return reply.code(404).send({ error: 'Public Journal entry was not found.' });
    }
    if (access.visibility === 'public') {
      reply.header('Vary', 'Cookie, X-Journal-Visitor-Id');
      reply.header('Cache-Control', 'private, no-store');
      return access.entry;
    }

    reply.header('Vary', 'Cookie, X-Journal-Visitor-Id');
    reply.header('Cache-Control', 'private, no-store');
    if (
      auth.isAdmin(request)
      || auth.hasProtectedAccess(request, access.publicId, access.accessRevision)
    ) {
      return access.entry;
    }
    return protectedPreview(access);
  });

  server.post('/api/entries/:publicId/unlock', async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const { password } = journalUnlockRequestSchema.parse(request.body);
    const access = repository.getPublishedAccessByPublicId(
      publicId,
      visitorClientHash(request, visitorSecret),
    );
    if (!access || access.visibility !== 'protected' || !access.accessPasswordHash) {
      return reply.code(404).send({ error: 'Protected Journal entry was not found.' });
    }
    if (!accessPasswordMatches(password, access.accessPasswordHash)) {
      return reply.code(401).send({ error: 'Journal access password is incorrect.' });
    }
    auth.setProtectedAccessCookie(reply, access.publicId, access.accessRevision);
    reply.header('Cache-Control', 'private, no-store');
    return access.entry;
  });
}

function protectedPreview(access: JournalPublishedAccess): JournalProtectedEntryPreview {
  return {
    kind: 'protected',
    publicId: access.publicId,
    channel: access.entry.channel,
    entryType: access.entry.bodyFormat === 'rich' ? 'article' : 'record',
    sourceCreatedAt: access.entry.sourceCreatedAt,
  };
}
