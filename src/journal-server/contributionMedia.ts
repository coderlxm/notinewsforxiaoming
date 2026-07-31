import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';
import type { JournalContributionAssetInput } from './repository.js';
import { JournalContributionError } from './contributionError.js';
import type { EntryStorageSession, JournalStorage } from './storage.js';
import {
  JournalVideoNormalizationError,
  type JournalVideoNormalizationService,
} from './videoNormalization.js';

const execFileAsync = promisify(execFile);
const maxImagePixels = 50_000_000;
const maxImageBytes = 40 * 1024 * 1024;

export interface ContributionUploadSource {
  absolutePath: string;
  sourceName: string;
  byteSize: number;
}

export class JournalContributionMediaService {
  constructor(
    private readonly storage: JournalStorage,
    private readonly videos: JournalVideoNormalizationService,
  ) {}

  async process(
    source: ContributionUploadSource,
    session: EntryStorageSession,
    sortOrder: number,
  ): Promise<JournalContributionAssetInput> {
    const detected = await fileTypeFromFile(source.absolutePath);
    if (
      detected?.mime === 'image/jpeg'
      || detected?.mime === 'image/png'
      || detected?.mime === 'image/webp'
    ) {
      return this.processSharpImage(source, session, sortOrder);
    }
    if (detected?.mime === 'image/heic' || detected?.mime === 'image/heif') {
      return this.processHeifImage(source, session, sortOrder);
    }
    if (detected?.mime === 'video/mp4' || detected?.mime === 'video/quicktime') {
      return this.processVideo(source, session, sortOrder);
    }
    if (detected?.mime?.startsWith('image/')) {
      throw new JournalContributionError(
        'IMAGE_FORMAT_UNSUPPORTED',
        `${source.sourceName} 不符合约定的图片格式。`,
        400,
        source.sourceName,
      );
    }
    throw new JournalContributionError(
      'VIDEO_FORMAT_UNSUPPORTED',
      `${source.sourceName} 不符合约定的视频格式。`,
      400,
      source.sourceName,
    );
  }

  private async processSharpImage(
    source: ContributionUploadSource,
    session: EntryStorageSession,
    sortOrder: number,
  ): Promise<JournalContributionAssetInput> {
    this.assertImageSize(source);
    const target = this.storage.contributionAssetTarget(session, '.webp');
    let metadata;
    try {
      metadata = await sharp(source.absolutePath, {
        animated: true,
        limitInputPixels: false,
      }).metadata();
    } catch {
      throw new JournalContributionError(
        'IMAGE_FORMAT_UNSUPPORTED',
        `${source.sourceName} 不符合约定的图片格式。`,
        400,
        source.sourceName,
      );
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new JournalContributionError(
        'IMAGE_FORMAT_UNSUPPORTED',
        `${source.sourceName} 必须是单张静态图片。`,
        400,
        source.sourceName,
      );
    }
    const width = metadata.autoOrient.width;
    const height = metadata.autoOrient.height;
    this.assertImageDimensions(source.sourceName, width, height);

    try {
      await this.writeJournalImage(source.absolutePath, target.absolutePath, 2560, 82);
      await this.writeJournalImage(source.absolutePath, target.previewAbsolutePath, 320, 60);
    } catch (error) {
      if (error instanceof JournalContributionError) throw error;
      throw new JournalContributionError(
        'MEDIA_PROCESSING_FAILED',
        `${source.sourceName} 图片整理失败。`,
        400,
        source.sourceName,
      );
    }
    const output = await fs.promises.stat(target.absolutePath);
    return {
      kind: 'photo',
      sourceName: source.sourceName,
      mimeType: 'image/webp',
      byteSize: output.size,
      relativePath: target.relativePath,
      previewRelativePath: target.previewRelativePath,
      width: width as number,
      height: height as number,
      duration: null,
      sortOrder,
    };
  }

  private async processHeifImage(
    source: ContributionUploadSource,
    session: EntryStorageSession,
    sortOrder: number,
  ): Promise<JournalContributionAssetInput> {
    this.assertImageSize(source);
    let info;
    try {
      info = await execFileAsync('heif-info', [source.absolutePath], {
        maxBuffer: 1024 * 1024,
      });
    } catch {
      throw new JournalContributionError(
        'IMAGE_FORMAT_UNSUPPORTED',
        `${source.sourceName} 不符合约定的 HEIC/HEIF 图片格式。`,
        400,
        source.sourceName,
      );
    }
    const imageMatches = [...info.stdout.matchAll(/image:\s*(\d+)x(\d+)/gi)];
    if (imageMatches.length !== 1) {
      throw new JournalContributionError(
        'IMAGE_FORMAT_UNSUPPORTED',
        `${source.sourceName} 必须是单张 HEIC/HEIF 图片。`,
        400,
        source.sourceName,
      );
    }
    this.assertImageDimensions(
      source.sourceName,
      Number(imageMatches[0]?.[1]),
      Number(imageMatches[0]?.[2]),
    );

    const convertedPath = path.join(
      path.dirname(source.absolutePath),
      `${path.basename(source.absolutePath)}.jpg`,
    );
    try {
      await execFileAsync('heif-convert', [source.absolutePath, convertedPath], {
        maxBuffer: 1024 * 1024,
      });
    } catch {
      throw new JournalContributionError(
        'MEDIA_PROCESSING_FAILED',
        `${source.sourceName} HEIC/HEIF 图片整理失败。`,
        400,
        source.sourceName,
      );
    }
    const processed = await this.processSharpImage(
      {
        absolutePath: convertedPath,
        sourceName: source.sourceName,
        byteSize: source.byteSize,
      },
      session,
      sortOrder,
    );
    await fs.promises.rm(convertedPath);
    return processed;
  }

  private async processVideo(
    source: ContributionUploadSource,
    session: EntryStorageSession,
    sortOrder: number,
  ): Promise<JournalContributionAssetInput> {
    try {
      const asset = await this.videos.normalize(source, session);
      return {
        kind: 'video',
        sourceName: source.sourceName,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        relativePath: asset.relativePath,
        previewRelativePath: asset.previewRelativePath,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        sortOrder,
      };
    } catch (error) {
      if (error instanceof JournalVideoNormalizationError) {
        throw new JournalContributionError(
          error.code,
          error.message,
          400,
          error.filename,
        );
      }
      throw error;
    }
  }

  private async writeJournalImage(
    sourcePath: string,
    destinationPath: string,
    longestEdge: number,
    quality: number,
  ): Promise<void> {
    await sharp(sourcePath, {
      animated: false,
      limitInputPixels: maxImagePixels,
    })
      .autoOrient()
      .resize({
        width: longestEdge,
        height: longestEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toColourspace('srgb')
      .webp({ quality })
      .toFile(destinationPath);
  }

  private assertImageSize(source: ContributionUploadSource): void {
    if (source.byteSize > maxImageBytes) {
      throw new JournalContributionError(
        'FILE_TOO_LARGE',
        `${source.sourceName} 图片超过 40 MiB。`,
        400,
        source.sourceName,
      );
    }
  }

  private assertImageDimensions(
    filename: string,
    width: number | undefined,
    height: number | undefined,
  ): void {
    if (!width || !height) {
      throw new JournalContributionError(
        'IMAGE_FORMAT_UNSUPPORTED',
        `${filename} 没有可用的图片尺寸。`,
        400,
        filename,
      );
    }
    if (width * height > maxImagePixels) {
      throw new JournalContributionError(
        'IMAGE_PIXEL_LIMIT_EXCEEDED',
        `${filename} 超过 50 MP。`,
        400,
        filename,
      );
    }
  }
}
