import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import sharp from 'sharp';
import type { JournalRepository } from './repository.js';
import type { JournalStorage } from './storage.js';

export interface JournalImageDimensions {
  width: number;
  height: number;
}

export function isJournalImageAsset(kind: string, mimeType: string | null): boolean {
  return kind === 'photo'
    || ((kind === 'sticker' || kind === 'animation') && mimeType?.startsWith('image/') === true);
}

export function isJournalAnimatedImageAsset(kind: string, mimeType: string | null): boolean {
  return kind === 'animation' && mimeType?.startsWith('image/') === true;
}

export class JournalImagePreviewService {
  async generate(sourcePath: string, previewPath: string): Promise<JournalImageDimensions> {
    const metadata = await sharp(sourcePath, { animated: false }).metadata();
    const width = metadata.autoOrient.width;
    const height = metadata.autoOrient.height;
    if (!width || !height) {
      throw new Error(`Image ${sourcePath} does not expose usable dimensions.`);
    }

    const temporaryPath = `${previewPath}.${randomUUID()}.tmp`;
    try {
      await sharp(sourcePath, { animated: false })
        .autoOrient()
        .resize({ width: 64, withoutEnlargement: true })
        .webp({ quality: 35 })
        .toFile(temporaryPath);
      await fs.promises.rename(temporaryPath, previewPath);
    } catch (error) {
      await fs.promises.rm(temporaryPath, { force: true });
      throw error;
    }

    return { width, height };
  }

  async generatePoster(sourcePath: string, posterPath: string): Promise<void> {
    const temporaryPath = `${posterPath}.${randomUUID()}.tmp`;
    try {
      await sharp(sourcePath, { animated: false })
        .autoOrient()
        .webp({ lossless: true })
        .toFile(temporaryPath);
      await fs.promises.rename(temporaryPath, posterPath);
    } catch (error) {
      await fs.promises.rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

export class JournalImagePreviewBackfillService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly previews: JournalImagePreviewService,
  ) {}

  async run(): Promise<void> {
    for (const asset of this.repository.listImageAssetsMissingPreview()) {
      const previewRelativePath = this.storage.previewRelativePath(asset.relativePath);
      try {
        const dimensions = await this.previews.generate(
          this.storage.absoluteAssetPath(asset.relativePath),
          this.storage.absoluteAssetPath(previewRelativePath),
        );
        this.repository.completeImagePreviewBackfill(
          asset.id,
          previewRelativePath,
          dimensions.width,
          dimensions.height,
        );
      } catch (error) {
        throw new Error(`Journal image preview backfill failed for asset ${asset.id}.`, {
          cause: error,
        });
      }
    }

    for (const asset of this.repository.listAnimatedAssetsMissingPoster()) {
      const posterRelativePath = this.storage.posterRelativePath(asset.relativePath);
      try {
        await this.previews.generatePoster(
          this.storage.absoluteAssetPath(asset.relativePath),
          this.storage.absoluteAssetPath(posterRelativePath),
        );
        this.repository.completePosterBackfill(asset.id, posterRelativePath);
      } catch (error) {
        throw new Error(`Journal animated image poster backfill failed for asset ${asset.id}.`, {
          cause: error,
        });
      }
    }
  }
}
