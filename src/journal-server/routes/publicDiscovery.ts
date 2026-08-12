import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { JournalAuth } from '../auth.js';
import type { JournalRepository } from '../repository.js';

const normalizedSearchQuerySchema = z.string()
  .transform(value => value.trim().replace(/\s+/gu, ' '))
  .refine(value => value.length > 0, 'Search query must not be empty.')
  .refine(
    value => [...value].length <= 80,
    'Search query must not exceed 80 Unicode characters.',
  );

const discoverySearchQuerySchema = z.object({
  q: normalizedSearchQuerySchema,
  cursor: z.string().min(1).optional(),
});

const discoveryArchiveMonthParamsSchema = z.object({
  year: z.string().regex(/^\d{4}$/u).transform(Number),
  month: z.string().regex(/^(?:0[1-9]|1[0-2])$/u).transform(Number),
});

const discoveryArchiveMonthQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
});

function setDiscoveryResponseHeaders(reply: FastifyReply): void {
  reply.header('Vary', 'Cookie');
  reply.header('Cache-Control', 'private, no-store');
}

function canReadProtectedContent(
  request: FastifyRequest,
  auth: JournalAuth,
): (publicId: string, accessRevision: number) => boolean {
  const administrator = auth.isAdmin(request);
  return (publicId, accessRevision) => administrator
    || auth.hasProtectedAccess(request, publicId, accessRevision);
}

export async function registerPublicDiscoveryRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  repository: JournalRepository,
): Promise<void> {
  server.get('/api/discovery/search', async (request, reply) => {
    setDiscoveryResponseHeaders(reply);
    const query = discoverySearchQuerySchema.parse(request.query);
    return repository.searchDiscovery({
      query: query.q,
      limit: 20,
      canReadProtectedContent: canReadProtectedContent(request, auth),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
  });

  server.get('/api/discovery/archive', async (_request, reply) => {
    setDiscoveryResponseHeaders(reply);
    return repository.getDiscoveryArchiveOverview();
  });

  server.get('/api/discovery/archive/:year/:month', async (request, reply) => {
    setDiscoveryResponseHeaders(reply);
    const params = discoveryArchiveMonthParamsSchema.parse(request.params);
    const query = discoveryArchiveMonthQuerySchema.parse(request.query);
    return repository.listDiscoveryArchiveMonth({
      year: params.year,
      month: params.month,
      limit: 20,
      canReadProtectedContent: canReadProtectedContent(request, auth),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
  });
}
