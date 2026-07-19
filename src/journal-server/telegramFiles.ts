import fs from 'node:fs';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import { lookup } from 'mime-types';
import { z } from 'zod';
import type { TelegramAssetSource } from './types.js';

const telegramFileLimit = 20 * 1024 * 1024;

const telegramGetFileResponseSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    file_id: z.string().min(1),
    file_unique_id: z.string().min(1),
    file_size: z.number().int().nonnegative().optional(),
    file_path: z.string().min(1),
  }),
});

export interface DownloadedTelegramFile {
  byteSize: number;
  mimeType: string | null;
}

export class TelegramFileDownloader {
  constructor(private readonly token: string) {}

  async download(source: TelegramAssetSource, destination: string): Promise<DownloadedTelegramFile> {
    if (source.declaredByteSize !== null && source.declaredByteSize > telegramFileLimit) {
      throw new Error(`Telegram ${source.kind} attachment exceeds the 20 MB Bot API limit.`);
    }

    const file = await this.getFile(source);
    if (file.file_size !== undefined && file.file_size > telegramFileLimit) {
      throw new Error(`Telegram ${source.kind} attachment exceeds the 20 MB Bot API limit.`);
    }

    const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
    let response;
    try {
      response = await axios.get<Readable>(downloadUrl, { responseType: 'stream' });
    } catch (error) {
      throw new Error(
        `Telegram ${source.kind} attachment download failed${this.httpStatusSuffix(error)}.`,
      );
    }

    const contentLength = Number(response.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > telegramFileLimit) {
      response.data.destroy();
      throw new Error(`Telegram ${source.kind} attachment exceeds the 20 MB Bot API limit.`);
    }

    let byteSize = 0;
    const sizeLimiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteSize += chunk.length;
        if (byteSize > telegramFileLimit) {
          callback(new Error('Telegram attachment exceeds the 20 MB Bot API limit.'));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(response.data, sizeLimiter, fs.createWriteStream(destination, { flags: 'wx' }));
    } catch (error) {
      await fs.promises.rm(destination);
      if (error instanceof Error && error.message.includes('20 MB')) throw error;
      throw new Error(`Telegram ${source.kind} attachment could not be written to storage.`);
    }

    const inferredMime = lookup(source.originalName ?? file.file_path);
    return {
      byteSize,
      mimeType: source.mimeType ?? (inferredMime || null),
    };
  }

  private async getFile(source: TelegramAssetSource) {
    const url = `https://api.telegram.org/bot${this.token}/getFile`;
    try {
      const response = await axios.get(url, { params: { file_id: source.fileId } });
      return telegramGetFileResponseSchema.parse(response.data).result;
    } catch (error) {
      throw new Error(`Telegram getFile failed for ${source.kind}${this.httpStatusSuffix(error)}.`);
    }
  }

  private httpStatusSuffix(error: unknown): string {
    return axios.isAxiosError(error) && error.response
      ? ` (HTTP ${error.response.status})`
      : '';
  }
}
