import type { FastifyInstance } from 'fastify';
import {
  journalIngestRequestSchema,
  journalVisibilityRequestSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { JournalIngestService } from '../ingest.js';
import type { JournalRepository } from '../repository.js';

interface InternalRoutesOptions {
  auth: JournalAuth;
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
    const input = journalVisibilityRequestSchema.parse(request.body);
    const entry = options.repository.updateVisibilityByPublicId(publicId, input.visibility);
    if (!entry) return reply.code(404).send({ error: 'Journal entry was not found.' });
    return entry;
  });
}
