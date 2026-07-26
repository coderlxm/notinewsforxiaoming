import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { JournalContributionError } from '../contributionError.js';
import type { JournalContributionLinkService } from '../contributionLinkService.js';
import type { JournalContributionNotificationService } from '../contributionNotification.js';
import type { JournalContributionService } from '../contributionService.js';
import { JournalContributionUploadService } from '../contributionUploadService.js';
import type { JournalStorage } from '../storage.js';

const maxAssets = 30;
const maxVideos = 5;
const maxTotalBytes = 500 * 1024 * 1024;
const maxImageBytes = 40 * 1024 * 1024;
const maxVideoBytes = 500 * 1024 * 1024;
const maxImagePixels = 50_000_000;
const maxVideoDuration = 300;

const uploadParamsSchema = z.object({
  uploadId: z.string().uuid(),
});

const assetUploadParamsSchema = uploadParamsSchema.extend({
  assetUploadId: z.string().min(1),
});

const submissionSchema = z.object({
  uploadId: z.string().uuid(),
  senderName: z.string(),
  contentText: z.string(),
});

function bearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
}

function invalidForm(message: string): JournalContributionError {
  return new JournalContributionError('INVALID_FORM', message, 400);
}

function setContributionResponseHeaders(reply: {
  header: (name: string, value: string) => unknown;
}): void {
  reply.header('Cache-Control', 'no-store');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('X-Content-Type-Options', 'nosniff');
}

export async function registerContributionRoutes(
  server: FastifyInstance,
  dependencies: {
    links: JournalContributionLinkService;
    contributions: JournalContributionService;
    notifications: JournalContributionNotificationService;
    storage: JournalStorage;
  },
): Promise<void> {
  const uploads = new JournalContributionUploadService(
    dependencies.storage.contributionUploadDirectory(),
    dependencies.links,
    dependencies.contributions,
  );
  uploads.registerRoutes(server);

  server.get('/api/contribution-link', async (request, reply) => {
    setContributionResponseHeaders(reply);
    const link = dependencies.links.requireValid(bearerToken(request));
    return {
      expiresAt: link.expiresAt,
      limits: {
        maxAssets,
        maxVideos,
        maxTotalBytes,
        maxImageBytes,
        maxVideoBytes,
        maxImagePixels,
        maxVideoDuration,
        maxSenderNameLength: 24,
        maxContentTextLength: 2000,
      },
    };
  });

  server.post('/api/contribution-uploads', async (request, reply) => {
    setContributionResponseHeaders(reply);
    const link = dependencies.links.requireValid(bearerToken(request));
    return {
      uploadId: dependencies.contributions.createUpload(link),
    };
  });

  server.post('/api/contribution-uploads/:uploadId/assets/:assetUploadId', {
    bodyLimit: 1024,
  }, async (request, reply) => {
    setContributionResponseHeaders(reply);
    const link = dependencies.links.requireValid(bearerToken(request));
    const { uploadId, assetUploadId } = assetUploadParamsSchema.parse(request.params);
    try {
      const asset = await uploads.process(link, uploadId, assetUploadId);
      return {
        asset: {
          kind: asset.kind,
          sourceName: asset.sourceName,
          byteSize: asset.byteSize,
        },
      };
    } catch (error) {
      await dependencies.contributions.discardUpload(link, uploadId);
      await uploads.discard(uploadId);
      throw error;
    }
  });

  server.post('/api/contributions', {
    bodyLimit: 16 * 1024,
  }, async (request, reply) => {
    setContributionResponseHeaders(reply);
    const link = dependencies.links.requireValid(bearerToken(request));
    const submission = submissionSchema.parse(request.body);
    const senderName = submission.senderName.trim();
    const contentText = submission.contentText;
    const senderNameLength = [...senderName].length;
    const contentTextLength = [...contentText].length;
    if (senderNameLength < 1 || senderNameLength > 24) {
      throw invalidForm('称呼必须为 1–24 个字符。');
    }
    if (contentTextLength > 2000) {
      throw invalidForm('正文不能超过 2,000 个字符。');
    }

    const contribution = await dependencies.contributions.submit({
      uploadId: submission.uploadId,
      link,
      senderName,
      contentText,
    });

    try {
      await dependencies.notifications.notify(contribution);
    } catch (error) {
      request.log.error(
        { err: error, contributionPublicId: contribution.publicId },
        'Journal contribution Telegram notification failed after delivery.',
      );
    }

    return {
      contribution: {
        publicId: contribution.publicId,
        senderName: contribution.senderName,
        assetCount: contribution.assets.length,
        submittedAt: contribution.submittedAt,
      },
    };
  });
}
