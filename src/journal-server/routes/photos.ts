import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { z } from 'zod';
import { photoImageVariantNames } from '../../shared/photoLibraryProtocol.js';
import { decodeHeicImage } from '../photoHeicDecoder.js';
import type { JournalPhotoLibraryService } from '../photoLibraryService.js';

const publicIdSchema = z.string().regex(/^[0-9a-f]{64}$/);
const albumParamsSchema = z.object({ albumId: publicIdSchema });
const mediaParamsSchema = z.object({
  contentRevision: publicIdSchema,
  photoId: publicIdSchema,
  variant: z.enum(photoImageVariantNames),
});

export async function registerPhotoRoutes(
  server: FastifyInstance,
  service: JournalPhotoLibraryService,
): Promise<void> {
  server.get('/api/photos', async (_request, reply) => {
    reply.header('Cache-Control', 'public, no-cache');
    return await service.ensureCurrent();
  });

  server.get('/api/photos/albums/:albumId', async (request, reply) => {
    const { albumId } = albumParamsSchema.parse(request.params);
    const album = await service.getAlbum(albumId);
    if (!album) return reply.code(404).send({ error: 'Photo album was not found.' });
    reply.header('Cache-Control', 'public, no-cache');
    return album;
  });

  server.get('/media/photos/:contentRevision/:photoId/:variant', async (request, reply) => {
    const { contentRevision, photoId, variant } = mediaParamsSchema.parse(request.params);
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.raw.once('aborted', abort);
    try {
      const media = await service.openMedia(
        contentRevision,
        photoId,
        variant,
        abortController.signal,
      );
      if (!media) return reply.code(404).send({ error: 'Photo media was not found.' });

      reply.raw.setHeader('Content-Type', 'image/webp');
      reply.raw.setHeader('Content-Disposition', 'inline');
      reply.raw.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      reply.raw.setHeader('X-Content-Type-Options', 'nosniff');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.hijack();
      await media.withSource(async (source) => {
        const decoded = media.sourceFormat === 'heic'
          ? await decodeHeicImage(await buffer(source))
          : null;
        const transformer = decoded
          ? sharp(decoded.data, {
              raw: {
                width: decoded.width,
                height: decoded.height,
                channels: 4,
              },
            })
          : sharp({ animated: false }).autoOrient();
        const output = transformer
          .resize({
            ...media.resize,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: media.quality });
        if (decoded) {
          await pipeline(output, reply.raw);
        } else {
          await pipeline(source, output, reply.raw);
        }
      });
    } finally {
      request.raw.off('aborted', abort);
    }
  });
}
