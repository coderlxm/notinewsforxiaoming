import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { JournalContributionError } from '../contributionError.js';
import type { JournalContributionLinkService } from '../contributionLinkService.js';
import type { ContributionUploadSource } from '../contributionMedia.js';
import type { JournalContributionNotificationService } from '../contributionNotification.js';
import type { JournalContributionService } from '../contributionService.js';
import type { JournalStorage } from '../storage.js';

const maxAssets = 12;
const maxVideos = 2;
const maxTotalBytes = 80 * 1024 * 1024;
const maxImageBytes = 20 * 1024 * 1024;
const maxVideoBytes = 70 * 1024 * 1024;
const contributionBodyLimit = 85 * 1024 * 1024;

const assetOrderSchema = z.array(z.number().int().nonnegative()).max(maxAssets);

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
        maxSenderNameLength: 24,
        maxContentTextLength: 2000,
      },
    };
  });

  server.post('/api/contributions', {
    bodyLimit: contributionBodyLimit,
  }, async (request, reply) => {
    setContributionResponseHeaders(reply);
    const link = dependencies.links.requireValid(bearerToken(request));
    if (!request.isMultipart()) {
      throw invalidForm('投稿必须使用 multipart/form-data。');
    }
    const requestDir = await dependencies.storage.beginContributionRequest();
    try {
      const fields: Record<string, string> = {};
      const files: ContributionUploadSource[] = [];
      let totalBytes = 0;

      try {
        for await (const part of request.parts({
          limits: {
            files: maxAssets,
            fileSize: maxVideoBytes,
            fields: 3,
            fieldSize: 8 * 1024,
            parts: maxAssets + 3,
          },
        })) {
          if (part.type === 'field') {
            if (!['senderName', 'contentText', 'assetOrder'].includes(part.fieldname)) {
              throw invalidForm(`不支持字段 ${part.fieldname}。`);
            }
            if (fields[part.fieldname] !== undefined) {
              throw invalidForm(`字段 ${part.fieldname} 不能重复。`);
            }
            if (part.valueTruncated) {
              throw invalidForm(`字段 ${part.fieldname} 过长。`);
            }
            fields[part.fieldname] = String(part.value);
            continue;
          }

          if (part.fieldname !== 'assets[]') {
            throw invalidForm(`不支持文件字段 ${part.fieldname}。`);
          }
          const sourceName = part.filename;
          if (!sourceName) throw invalidForm('素材缺少文件名。');

          const absolutePath = path.join(requestDir, randomUUID());
          let byteSize = 0;
          const sizeCounter = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              byteSize += chunk.length;
              totalBytes += chunk.length;
              if (totalBytes > maxTotalBytes) {
                callback(new JournalContributionError(
                  'CONTRIBUTION_TOO_LARGE',
                  '一份投稿的全部文件不能超过 80 MiB。',
                  400,
                  sourceName,
                ));
                return;
              }
              callback(null, chunk);
            },
          });
          await pipeline(
            part.file,
            sizeCounter,
            fs.createWriteStream(absolutePath, { flags: 'wx' }),
          );
          files.push({ absolutePath, sourceName, byteSize });
        }
      } catch (error) {
        if (error instanceof server.multipartErrors.FilesLimitError) {
          throw new JournalContributionError(
            'TOO_MANY_ASSETS',
            '一份投稿最多包含 12 项素材。',
            400,
          );
        }
        if (error instanceof server.multipartErrors.RequestFileTooLargeError) {
          throw new JournalContributionError(
            'FILE_TOO_LARGE',
            '单个文件不能超过 70 MiB。',
            400,
          );
        }
        if (
          error instanceof server.multipartErrors.FieldsLimitError
          || error instanceof server.multipartErrors.PartsLimitError
        ) {
          throw invalidForm('投稿字段或素材数量超过约定限制。');
        }
        throw error;
      }

      const senderName = (fields.senderName ?? '').trim();
      const contentText = fields.contentText ?? '';
      const senderNameLength = [...senderName].length;
      const contentTextLength = [...contentText].length;
      if (senderNameLength < 1 || senderNameLength > 24) {
        throw invalidForm('称呼必须为 1–24 个字符。');
      }
      if (contentTextLength > 2000) {
        throw invalidForm('正文不能超过 2,000 个字符。');
      }
      if (contentText.trim() === '' && files.length === 0) {
        throw invalidForm('正文和素材至少填写一项。');
      }

      let assetOrder: number[];
      try {
        assetOrder = assetOrderSchema.parse(JSON.parse(fields.assetOrder ?? ''));
      } catch {
        throw invalidForm('素材顺序无效。');
      }
      if (
        assetOrder.length !== files.length
        || new Set(assetOrder).size !== files.length
        || assetOrder.some((index) => index >= files.length)
      ) {
        throw invalidForm('素材顺序必须完整对应本次上传的文件。');
      }
      const orderedFiles = assetOrder.map((index) => files[index] as ContributionUploadSource);
      const contribution = await dependencies.contributions.submit({
        link,
        senderName,
        contentText,
        files: orderedFiles,
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
    } finally {
      await dependencies.storage.discardContributionRequest(requestDir);
    }
  });
}
