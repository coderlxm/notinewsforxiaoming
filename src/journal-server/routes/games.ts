import { create as contentDisposition } from 'content-disposition';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { gameImageRoleSchema } from '../../shared/gameProtocol.js';
import type { JournalAuth } from '../auth.js';
import type { GameRepository } from '../gameRepository.js';
import type { GameService } from '../gameService.js';
import { maxWebImageBytes } from '../webImage.js';

const gameParamsSchema = z.object({ id: z.string().uuid() });
const gameImageParamsSchema = z.object({ assetId: z.string().uuid() });

const gameImageFieldsSchema = z.object({
  role: gameImageRoleSchema,
  caption: z.string().trim().max(200).optional(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
});

async function readGameImageMultipart(request: FastifyRequest): Promise<{
  buffer: Buffer;
  mimeType: string;
  originalName: string | null;
  role: z.infer<typeof gameImageRoleSchema>;
  caption?: string;
  takenAt?: string;
}> {
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; mimeType: string; originalName: string | null } | null = null;

  for await (const part of request.parts({
    limits: { fields: 3, files: 1, parts: 4, fileSize: maxWebImageBytes },
  })) {
    if (part.type === 'file') {
      if (part.fieldname !== 'file') {
        throw new Error(`Unexpected multipart file field ${part.fieldname}.`);
      }
      file = {
        buffer: await part.toBuffer(),
        mimeType: part.mimetype,
        originalName: part.filename ?? null,
      };
      continue;
    }
    if (part.fieldname !== 'role' && part.fieldname !== 'caption' && part.fieldname !== 'takenAt') {
      throw new Error(`Unexpected multipart field ${part.fieldname}.`);
    }
    fields[part.fieldname] = String(part.value);
  }

  if (!file) throw new Error('Missing game image file.');
  const parsed = gameImageFieldsSchema.parse(fields);
  return { ...file, ...parsed };
}

export async function registerGameRoutes(
  server: FastifyInstance,
  dependencies: {
    auth: JournalAuth;
    repository: GameRepository;
    service: GameService;
    dataDir: string;
  },
): Promise<void> {
  server.get('/api/games', async (_request, reply) => {
    reply.header('Cache-Control', 'no-cache');
    return dependencies.service.list();
  });

  server.get('/api/games/:id', async (request, reply) => {
    const { id } = gameParamsSchema.parse(request.params);
    const game = dependencies.service.get(id);
    if (!game) return reply.code(404).send({ error: 'Game was not found.' });
    reply.header('Cache-Control', 'no-cache');
    return game;
  });

  server.post('/api/me/games', {
    preHandler: dependencies.auth.requireAdmin,
  }, async (request, reply) => {
    reply.code(201);
    return dependencies.service.create(request.body);
  });

  server.put('/api/me/games/:id', {
    preHandler: dependencies.auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = gameParamsSchema.parse(request.params);
    const game = dependencies.service.update(id, request.body);
    if (!game) return reply.code(404).send({ error: 'Game was not found.' });
    return game;
  });

  server.post('/api/me/games/:id/images', {
    preHandler: dependencies.auth.requireAdmin,
  }, async (request, reply) => {
    const { id } = gameParamsSchema.parse(request.params);
    const game = await dependencies.service.uploadImage(id, await readGameImageMultipart(request));
    if (!game) return reply.code(404).send({ error: 'Game was not found.' });
    return game;
  });

  server.get('/game-media/:assetId', async (request, reply) => {
    const { assetId } = gameImageParamsSchema.parse(request.params);
    const asset = dependencies.repository.getImageAsset(assetId);
    if (!asset) return reply.code(404).send({ error: 'Game image was not found.' });
    reply.header(
      'Content-Disposition',
      contentDisposition(asset.originalName ?? `game-image-${asset.id}`, { type: 'inline' }),
    );
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    reply.type(asset.mimeType);
    return reply.sendFile(asset.relativePath, dependencies.dataDir, {
      acceptRanges: true,
      cacheControl: false,
      contentType: false,
    });
  });
}
