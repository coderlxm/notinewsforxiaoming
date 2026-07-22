import { randomUUID } from 'node:crypto';
import {
  journalIngestRequestSchema,
  type JournalEntry,
  type JournalIngestRequest,
} from '../shared/journalProtocol.js';
import { JournalRepository } from './repository.js';
import {
  isJournalImageAsset,
  JournalImagePreviewService,
} from './imagePreview.js';
import { JournalStorage, type EntryStorageSession } from './storage.js';
import { parseTelegramMessage, telegramMessageChatId } from './telegramContent.js';
import { TelegramFileDownloader } from './telegramFiles.js';
import type { StoredAssetInput } from './types.js';

export class JournalIngestService {
  constructor(
    private readonly allowedChatId: string,
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly downloader: TelegramFileDownloader,
    private readonly previews: JournalImagePreviewService,
  ) {}

  async ingest(rawRequest: JournalIngestRequest): Promise<JournalEntry> {
    const request = journalIngestRequestSchema.parse(rawRequest);
    const parsed = parseTelegramMessage(request.message);
    this.assertSource(request, parsed.sourceMessageId);

    const existing = this.repository.findBySource(request.chatId, parsed.sourceMessageId);
    if (existing) {
      const updated = this.repository.updateVisibilityByPublicId(
        existing.publicId,
        request.visibility,
      );
      if (!updated) throw new Error('The existing Journal entry could not be updated.');
      return updated;
    }

    if (parsed.contentText === '' && parsed.assets.length === 0 && parsed.structuredContent === null) {
      throw new Error('This Telegram message does not contain supported journal content.');
    }

    const publicId = randomUUID();
    const capturedAt = new Date().toISOString();
    let storageSession: EntryStorageSession | null = null;
    let storedAssets: StoredAssetInput[] = [];

    if (parsed.assets.length > 0) {
      storageSession = await this.storage.begin(publicId, parsed.sourceCreatedAt);
      try {
        storedAssets = [];
        for (const source of parsed.assets) {
          const target = this.storage.assetTarget(storageSession);
          const downloaded = await this.downloader.download(source, target.absolutePath);
          const dimensions = isJournalImageAsset(source.kind, downloaded.mimeType)
            ? await this.previews.generate(target.absolutePath, target.previewAbsolutePath)
            : null;
          storedAssets.push({
            ...source,
            relativePath: target.relativePath,
            previewRelativePath: dimensions ? target.previewRelativePath : null,
            byteSize: downloaded.byteSize,
            mimeType: downloaded.mimeType,
            width: dimensions?.width ?? source.width,
            height: dimensions?.height ?? source.height,
          });
        }
        await this.storage.finalize(storageSession);
      } catch (error) {
        await this.storage.discardTemporary(storageSession);
        throw error;
      }
    }

    try {
      return this.repository.create({
        publicId,
        chatId: request.chatId,
        visibility: request.visibility,
        message: request.message,
        parsed,
        capturedAt,
        assets: storedAssets,
      });
    } catch (error) {
      if (storageSession) await this.storage.discardFinal(storageSession);
      throw error;
    }
  }

  private assertSource(request: JournalIngestRequest, sourceMessageId: number): void {
    if (request.chatId !== this.allowedChatId) {
      throw new Error('The source chat is not allowed to write Journal entries.');
    }
    if (telegramMessageChatId(request.message) !== request.chatId) {
      throw new Error('The Telegram message chat does not match chatId.');
    }
    if (request.requestId !== `${request.chatId}:${sourceMessageId}`) {
      throw new Error('requestId must match chat_id:source_message_id.');
    }
  }
}
