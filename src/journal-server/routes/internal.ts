import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  journalIngestRequestSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { JournalDeletionService } from '../deletion.js';
import type { JournalIngestService } from '../ingest.js';
import type { JournalRepository } from '../repository.js';

const publicIdParamsSchema = z.object({
  publicId: z.string().uuid(),
});

const internalVisibilityRequestSchema = z.object({
  visibility: z.enum(['private', 'public']),
});

interface InternalRoutesOptions {
  auth: JournalAuth;
  deletionService: JournalDeletionService;
  ingestService: JournalIngestService;
  repository: JournalRepository;
}

export async function registerInternalRoutes(
  server: FastifyInstance,
  options: InternalRoutesOptions,
): Promise<void> {
  server.post('/api/internal/telegram-entries', {
    preHandler: options.auth.requireInternal,
  }, async (request) => {
    const input = journalIngestRequestSchema.parse(request.body);
    return options.ingestService.ingest(input);
  });

  server.patch('/api/internal/telegram-entries/:publicId/visibility', {
    preHandler: options.auth.requireInternal,
  }, async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const input = internalVisibilityRequestSchema.parse(request.body);
    const entry = options.repository.updateVisibilityByPublicId(publicId, input.visibility);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });

  server.delete('/api/internal/telegram-entries/:publicId', {
    preHandler: options.auth.requireInternal,
  }, async (request, reply) => {
    const { publicId } = publicIdParamsSchema.parse(request.params);
    const result = await options.deletionService.deleteByPublicId(publicId);
    if (!result) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return result;
  });
}
