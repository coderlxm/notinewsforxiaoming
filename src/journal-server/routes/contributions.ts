import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { JournalContributionError } from '../contributionError.js';
import type { JournalContributionLinkService } from '../contributionLinkService.js';
import type { ContributionUploadSource } from '../contributionMedia.js';
import type { JournalContributionNotificationService } from '../contributionNotification.js';
import type { JournalContributionService } from '../contributionService.js';
import type { JournalStorage } from '../storage.js';

const maxAssets = 30;
const maxVideos = 5;
const maxTotalBytes = 500 * 1024 * 1024;
const maxImageBytes = 40 * 1024 * 1024;
const maxVideoBytes = 90 * 1024 * 1024;
const maxImagePixels = 50_000_000;
const maxVideoDuration = 300;
const assetUploadBodyLimit = 95 * 1024 * 1024;

const uploadParamsSchema = z.object({
  uploadId: z.string().uuid(),
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

  server.post('/api/contribution-uploads/:uploadId/assets', {
    bodyLimit: assetUploadBodyLimit,
  }, async (request, reply) => {
    setContributionResponseHeaders(reply);
    const link = dependencies.links.requireValid(bearerToken(request));
    const { uploadId } = uploadParamsSchema.parse(request.params);
    dependencies.contributions.requireUpload(link, uploadId);
    if (!request.isMultipart()) {
      await dependencies.contributions.discardUpload(link, uploadId);
      throw invalidForm('投稿素材必须使用 multipart/form-data。');
    }

    const requestDir = await dependencies.storage.beginContributionRequest();
    let accepted = false;
    try {
      let source: ContributionUploadSource | null = null;
      try {
        for await (const part of request.parts({
          limits: {
            files: 1,
            fileSize: maxVideoBytes,
            fields: 0,
            parts: 1,
          },
        })) {
          if (part.type === 'field') {
            throw invalidForm(`不支持字段 ${part.fieldname}。`);
          }
          if (part.fieldname !== 'asset') {
            throw invalidForm(`不支持文件字段 ${part.fieldname}。`);
          }
          const sourceName = part.filename;
          if (!sourceName) throw invalidForm('素材缺少文件名。');

          const absolutePath = path.join(requestDir, randomUUID());
          await pipeline(
            part.file,
            fs.createWriteStream(absolutePath, { flags: 'wx' }),
          );
          const file = await fs.promises.stat(absolutePath);
          source = { absolutePath, sourceName, byteSize: file.size };
        }
      } catch (error) {
        if (error instanceof server.multipartErrors.FilesLimitError) {
          throw invalidForm('每次请求只能上传一个素材。');
        }
        if (error instanceof server.multipartErrors.RequestFileTooLargeError) {
          throw new JournalContributionError(
            'FILE_TOO_LARGE',
            '单个文件不能超过 90 MiB。',
            400,
          );
        }
        if (
          error instanceof server.multipartErrors.FieldsLimitError
          || error instanceof server.multipartErrors.PartsLimitError
        ) {
          throw invalidForm('每次请求只能上传一个素材。');
        }
        throw error;
      }

      if (!source) throw invalidForm('没有收到投稿素材。');
      const asset = await dependencies.contributions.addUploadAsset(link, uploadId, source);
      accepted = true;
      return {
        asset: {
          kind: asset.kind,
          sourceName: asset.sourceName,
          byteSize: asset.byteSize,
        },
      };
    } finally {
      await dependencies.storage.discardContributionRequest(requestDir);
      if (!accepted) {
        await dependencies.contributions.discardUpload(link, uploadId);
      }
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
