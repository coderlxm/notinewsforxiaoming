import { create as contentDisposition } from 'content-disposition';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { journalContributionPublishRequestSchema } from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { JournalContributionLinkService } from '../contributionLinkService.js';
import type { JournalContributionService } from '../contributionService.js';
import type { JournalRepository } from '../repository.js';

const contributionParamsSchema = z.object({
  publicId: z.string().uuid(),
});

const contributionAssetParamsSchema = contributionParamsSchema.extend({
  assetId: z.coerce.number().int().positive(),
});

const contributionLinkCreateSchema = z.object({
  lifetime: z.enum(['temporary', 'permanent']),
});

export async function registerPrivateContributionRoutes(
  server: FastifyInstance,
  dependencies: {
    auth: JournalAuth;
    links: JournalContributionLinkService;
    contributions: JournalContributionService;
    repository: JournalRepository;
    dataDir: string;
  },
): Promise<void> {
  const adminOnly = { preHandler: dependencies.auth.requireAdmin };

  server.get('/api/private/contribution-link', adminOnly, async () => ({
    link: dependencies.links.current(),
  }));

  server.post('/api/private/contribution-link', adminOnly, async (request) => {
    const { lifetime } = contributionLinkCreateSchema.parse(request.body);
    return {
      link: dependencies.links.create(lifetime),
    };
  });

  server.delete('/api/private/contribution-link', adminOnly, async (_request, reply) => {
    dependencies.links.revoke();
    return reply.code(204).send();
  });

  server.get('/api/private/contributions', adminOnly, async () => (
    dependencies.repository.listContributions()
  ));

  server.get('/api/private/contributions/:publicId', adminOnly, async (request, reply) => {
    const { publicId } = contributionParamsSchema.parse(request.params);
    const contribution = dependencies.repository.getContribution(publicId);
    if (!contribution) {
      return reply.code(404).send({ error: 'Journal contribution was not found.' });
    }
    return contribution;
  });

  server.get(
    '/api/private/contributions/:publicId/assets/:assetId/preview',
    adminOnly,
    async (request, reply) => {
      const { publicId, assetId } = contributionAssetParamsSchema.parse(request.params);
      const asset = dependencies.repository.findContributionStoredAsset(publicId, assetId);
      if (!asset) {
        return reply.code(404).send({ error: 'Journal contribution asset was not found.' });
      }
      reply.header('Cache-Control', 'private, no-store');
      reply.type('image/webp');
      return reply.sendFile(asset.previewRelativePath, dependencies.dataDir, {
        acceptRanges: true,
        cacheControl: false,
        contentType: false,
      });
    },
  );

  server.get(
    '/api/private/contributions/:publicId/assets/:assetId',
    adminOnly,
    async (request, reply) => {
      const { publicId, assetId } = contributionAssetParamsSchema.parse(request.params);
      const storedAsset = dependencies.repository.findContributionStoredAsset(publicId, assetId);
      const contribution = dependencies.repository.getContribution(publicId);
      const asset = contribution?.assets.find((item) => item.id === assetId);
      if (!storedAsset || !asset) {
        return reply.code(404).send({ error: 'Journal contribution asset was not found.' });
      }
      reply.header('Content-Disposition', contentDisposition(asset.sourceName, { type: 'inline' }));
      reply.header('Cache-Control', 'private, no-store');
      reply.type(asset.mimeType);
      return reply.sendFile(storedAsset.relativePath, dependencies.dataDir, {
        acceptRanges: true,
        cacheControl: false,
        contentType: false,
      });
    },
  );

  server.delete(
    '/api/private/contributions/:publicId/assets/:assetId',
    adminOnly,
    async (request, reply) => {
      const { publicId, assetId } = contributionAssetParamsSchema.parse(request.params);
      const contribution = await dependencies.contributions.deleteAsset(publicId, assetId);
      if (!contribution) {
        return reply.code(404).send({ error: 'Journal contribution asset was not found.' });
      }
      return contribution;
    },
  );

  server.post(
    '/api/private/contributions/:publicId/publish',
    adminOnly,
    async (request, reply) => {
      const { publicId } = contributionParamsSchema.parse(request.params);
      const input = journalContributionPublishRequestSchema.parse(request.body);
      const entry = await dependencies.contributions.publish(publicId, input);
      if (!entry) {
        return reply.code(404).send({ error: 'Journal contribution was not found.' });
      }
      return entry;
    },
  );

  server.delete(
    '/api/private/contributions/:publicId',
    adminOnly,
    async (request, reply) => {
      const { publicId } = contributionParamsSchema.parse(request.params);
      const deleted = await dependencies.contributions.delete(publicId);
      if (!deleted) {
        return reply.code(404).send({ error: 'Journal contribution was not found.' });
      }
      return reply.code(204).send();
    },
  );
}
