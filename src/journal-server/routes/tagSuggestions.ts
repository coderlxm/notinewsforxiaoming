import type { FastifyInstance } from 'fastify';
import { journalTagSuggestionRequestSchema } from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { JournalTagSuggestionService } from '../tagSuggestionService.js';

export async function registerTagSuggestionRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  tagSuggestions: JournalTagSuggestionService,
): Promise<void> {
  server.post('/api/me/tag-suggestions', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const input = journalTagSuggestionRequestSchema.parse(request.body);
    return await tagSuggestions.suggest(input);
  });
}
