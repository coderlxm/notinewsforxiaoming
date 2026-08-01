import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { journalChannelSchema } from '../../shared/journalProtocol.js';
import type { JournalRepository } from '../repository.js';

const publicFeedQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  channel: journalChannelSchema.default('life'),
});

export async function registerPublicFeedRoutes(
  server: FastifyInstance,
  repository: JournalRepository,
): Promise<void> {
  server.get('/api/feed', async (request) => {
    const query = publicFeedQuerySchema.parse(request.query);
    return repository.list({
      visibility: 'public',
      channel: query.channel,
      limit: 20,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
    });
  });

  server.get('/api/entries/:publicId', async (request, reply) => {
    const { publicId } = request.params as { publicId: string };
    const entry = repository.getPublicByPublicId(publicId);
    if (!entry) return reply.code(404).send({ error: 'Public Journal entry was not found.' });
    return entry;
  });
}
