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
  server.get('/media/:assetId/preview', async (request, reply) => {
    const { assetId } = assetParamsSchema.parse(request.params);
    const asset = repository.getAssetAccess(assetId);
    if (!asset) return reply.code(404).send({ error: 'Journal asset was not found.' });
    if (asset.visibility === 'private' && !auth.isAdmin(request)) {
      return reply.code(401).send({ error: 'Journal administrator login is required.' });
    }
    if (
      asset.visibility === 'protected'
      && !auth.isAdmin(request)
      && !auth.hasProtectedAccess(request, asset.publicId, asset.accessRevision)
    ) {
      return reply.code(401).send({ error: 'Journal access password is required.' });
    }
    if (asset.previewRelativePath === null) {
      return reply.code(404).send({ error: 'Journal asset preview was not found.' });
    }

    reply.header(
      'Cache-Control',
      asset.visibility === 'public' ? 'public, no-cache' : 'private, no-store',
    );
    reply.type('image/webp');
    return reply.sendFile(asset.previewRelativePath, dataDir, {
      acceptRanges: true,
      cacheControl: false,
      contentType: false,
    });
  });

  server.get('/media/:assetId', async (request, reply) => {
    const { assetId } = assetParamsSchema.parse(request.params);
    const asset = repository.getAssetAccess(assetId);
    if (!asset) return reply.code(404).send({ error: 'Journal asset was not found.' });
    if (asset.visibility === 'private' && !auth.isAdmin(request)) {
      return reply.code(401).send({ error: 'Journal administrator login is required.' });
    }
    if (
      asset.visibility === 'protected'
      && !auth.isAdmin(request)
      && !auth.hasProtectedAccess(request, asset.publicId, asset.accessRevision)
    ) {
      return reply.code(401).send({ error: 'Journal access password is required.' });
    }

    const filename = asset.originalName ?? `journal-asset-${asset.id}`;
    const dispositionType = asset.kind === 'document' ? 'attachment' : 'inline';
    reply.header('Content-Disposition', contentDisposition(filename, { type: dispositionType }));
    reply.header(
      'Cache-Control',
      asset.visibility === 'public' ? 'public, no-cache' : 'private, no-store',
    );
    if (asset.mimeType) reply.type(asset.mimeType);

    return reply.sendFile(asset.relativePath, dataDir, {
      acceptRanges: true,
      cacheControl: false,
      contentType: false,
    });
  });
}
