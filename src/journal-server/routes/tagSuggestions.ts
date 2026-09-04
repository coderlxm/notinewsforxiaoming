import type { FastifyInstance } from 'fastify';
import { journalTagSuggestionRequestSchema } from '../../shared/journalProtocol.js';
import type { JournalAiSuggestionService } from '../aiSuggestionService.js';
import type { JournalAuth } from '../auth.js';
import type { JournalSiteProfileService } from '../siteProfileService.js';

export async function registerTagSuggestionRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  aiSuggestions: JournalAiSuggestionService,
  siteProfile: JournalSiteProfileService,
): Promise<void> {
  server.post('/api/me/tag-suggestions', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    const input = journalTagSuggestionRequestSchema.parse(request.body);
    const attributionCandidates = siteProfile.getProfile().channelTags[input.channel];
    return await aiSuggestions.suggestTags(input, attributionCandidates);
  });
}
