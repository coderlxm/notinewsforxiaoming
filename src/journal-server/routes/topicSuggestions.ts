import type { FastifyInstance } from 'fastify';
import { journalTopicSuggestionRequestSchema } from '../../shared/journalProtocol.js';
import type { JournalAiSuggestionService } from '../aiSuggestionService.js';
import type { JournalAuth } from '../auth.js';

export async function registerTopicSuggestionRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  aiSuggestions: JournalAiSuggestionService,
): Promise<void> {
  server.post('/api/me/topic-suggestion', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const { contentText } = journalTopicSuggestionRequestSchema.parse(request.body);
    return await aiSuggestions.suggestTopic(contentText);
  });
}
