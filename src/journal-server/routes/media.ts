import { create as contentDisposition } from 'content-disposition';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { JournalAuth } from '../auth.js';
import type { JournalRepository } from '../repository.js';

const assetParamsSchema = z.object({
  assetId: z.coerce.number().int().positive(),
});

export async function registerMediaRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  repository: JournalRepository,
  dataDir: string,
): Promise<void> {
  server.get('/media/:assetId', async (request, reply) => {
    const { assetId } = assetParamsSchema.parse(request.params);
    const asset = repository.getAssetAccess(assetId);
    if (!asset) return reply.code(404).send({ error: 'Journal asset was not found.' });
    if (asset.visibility === 'private' && !auth.isAdmin(request)) {
      return reply.code(401).send({ error: 'Journal administrator login is required.' });
    }

    const filename = asset.originalName ?? `journal-asset-${asset.id}`;
    const dispositionType = asset.kind === 'document' ? 'attachment' : 'inline';
    reply.header('Content-Disposition', contentDisposition(filename, { type: dispositionType }));
    reply.header(
      'Cache-Control',
      asset.visibility === 'public' ? 'public, max-age=86400' : 'private, no-store',
    );
    if (asset.mimeType) reply.type(asset.mimeType);

    return reply.sendFile(asset.relativePath, dataDir, {
      acceptRanges: true,
      cacheControl: false,
      contentType: false,
    });
  });
}
