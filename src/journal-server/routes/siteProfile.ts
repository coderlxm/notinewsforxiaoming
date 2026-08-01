import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { JournalChannelTags } from '../../shared/journalProtocol.js';
import {
  journalChannelTagsSchema,
  journalSiteProfileBioSchema,
} from '../../shared/journalProtocol.js';
import type { JournalAuth } from '../auth.js';
import {
  type JournalSiteProfileAvatarUpload,
  JournalSiteProfileInputError,
  type JournalSiteProfileService,
  maxSiteProfileAvatarBytes,
} from '../siteProfileService.js';

const siteProfileFieldsSchema = z.object({
  bio: journalSiteProfileBioSchema,
  weatherEnabled: z.enum(['true', 'false']).transform(value => value === 'true'),
  channelTags: z.string().transform(value => (
    journalChannelTagsSchema.parse(JSON.parse(value))
  )),
});

async function readSiteProfileMultipart(request: FastifyRequest): Promise<{
  bio: string;
  avatar: JournalSiteProfileAvatarUpload | null;
  weatherEnabled: boolean;
  channelTags: JournalChannelTags;
}> {
  const fields: Record<string, string> = {};
  let avatar: JournalSiteProfileAvatarUpload | null = null;

  for await (const part of request.parts({
    limits: {
      fieldSize: 4096,
      fields: 3,
      fileSize: maxSiteProfileAvatarBytes,
      files: 1,
      parts: 4,
    },
  })) {
    if (part.type === 'file') {
      if (part.fieldname !== 'avatar') {
        throw new JournalSiteProfileInputError(
          `Unexpected multipart file field ${part.fieldname}.`,
        );
      }
      avatar = {
        buffer: await part.toBuffer(),
        mimeType: part.mimetype,
      };
      continue;
    }
    if (
      part.fieldname !== 'bio'
      && part.fieldname !== 'weatherEnabled'
      && part.fieldname !== 'channelTags'
    ) {
      throw new JournalSiteProfileInputError(
        `Unexpected multipart field ${part.fieldname}.`,
      );
    }
    if (part.valueTruncated) {
      throw new JournalSiteProfileInputError(
        `${part.fieldname} exceeds the multipart field limit.`,
      );
    }
    fields[part.fieldname] = String(part.value);
  }

  const { bio, weatherEnabled, channelTags } = siteProfileFieldsSchema.parse(fields);
  return { bio, avatar, weatherEnabled, channelTags };
}

export async function registerSiteProfileRoutes(
  server: FastifyInstance,
  auth: JournalAuth,
  service: JournalSiteProfileService,
): Promise<void> {
  server.get('/api/site-profile', async (_request, reply) => {
    reply.header('Cache-Control', 'no-cache');
    return service.getProfile();
  });

  server.get('/api/site-profile/avatar', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    reply.type('image/webp');
    return reply.send(service.getAvatarWebp());
  });

  server.patch('/api/me/site-profile', {
    preHandler: auth.requireAdmin,
  }, async (request) => {
    return await service.update(await readSiteProfileMultipart(request));
  });
}
