import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';
import { z } from 'zod';
import type { JournalContributionAssetInput } from './repository.js';
import { JournalContributionError } from './contributionError.js';
import type { EntryStorageSession, JournalStorage } from './storage.js';

const execFileAsync = promisify(execFile);
const maxImagePixels = 50_000_000;
const maxImageBytes = 40 * 1024 * 1024;
const maxVideoBytes = 90 * 1024 * 1024;
const maxVideoDuration = 300;

const ffprobeSchema = z.object({
  format: z.object({
    format_name: z.string(),
    duration: z.string().optional(),
  }),
  streams: z.array(z.object({
    codec_type: z.string(),
    codec_name: z.string().optional(),
    codec_tag_string: z.string().optional(),
    profile: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.string().optional(),
    r_frame_rate: z.string().optional(),
    color_transfer: z.string().optional(),
    disposition: z.object({
      attached_pic: z.number().int(),
    }).optional(),
  })),
});

export interface ContributionUploadSource {
  absolutePath: string;
  sourceName: string;
  byteSize: number;
}

export class JournalContributionMediaService {
  constructor(private readonly storage: JournalStorage) {}

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
    if (source.byteSize > maxVideoBytes) {
      throw new JournalContributionError(
        'FILE_TOO_LARGE',
        `${source.sourceName} 超过 90 MiB。`,
        400,
        source.sourceName,
      );
    }
    let probe;
    try {
      const result = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries',
        'format=format_name,duration:stream=codec_type,codec_name,codec_tag_string,profile,width,height,duration,r_frame_rate,color_transfer:stream_disposition=attached_pic',
        '-of', 'json',
        source.absolutePath,
      ], { maxBuffer: 1024 * 1024 });
      probe = ffprobeSchema.parse(JSON.parse(result.stdout));
    } catch {
      throw new JournalContributionError(
        'VIDEO_FORMAT_UNSUPPORTED',
        `${source.sourceName} 不符合约定的视频格式。`,
        400,
        source.sourceName,
      );
    }

    const videoStreams = probe.streams.filter((stream) => stream.codec_type === 'video');
    const audioStreams = probe.streams.filter((stream) => stream.codec_type === 'audio');
    if (
      videoStreams.length !== 1
      || audioStreams.length > 1
      || probe.streams.length !== videoStreams.length + audioStreams.length
    ) {
      this.throwVideoFormat(source.sourceName);
    }
    const video = videoStreams[0];
    const audio = audioStreams[0];
    if (
      !video
      || !video.width
      || !video.height
      || Math.max(video.width, video.height) > 3840
      || Math.min(video.width, video.height) > 2160
      || !probe.format.format_name.split(',').some((name) => name === 'mov' || name === 'mp4')
      || (video.codec_name !== 'h264' && video.codec_name !== 'hevc')
      || video.disposition?.attached_pic === 1
      || video.codec_tag_string === 'dvhe'
      || video.codec_tag_string === 'dvh1'
      || (
        video.codec_name === 'hevc'
        && video.profile !== 'Main'
        && video.profile !== 'Main 10'
      )
      || (audio !== undefined && audio.codec_name !== 'aac')
    ) {
      this.throwVideoFormat(source.sourceName);
    }
    const duration = Number(video.duration ?? probe.format.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      this.throwVideoFormat(source.sourceName);
    }
    if (duration > maxVideoDuration) {
      throw new JournalContributionError(
        'VIDEO_DURATION_EXCEEDED',
        `${source.sourceName} 超过 5 分钟。`,
        400,
        source.sourceName,
      );
    }
    const frameRate = this.parseFrameRate(video.r_frame_rate);
    if (
      !Number.isFinite(frameRate)
      || frameRate <= 0
      || frameRate > 60
      || this.isHdr(video.color_transfer)
    ) {
      this.throwVideoFormat(source.sourceName);
    }

    const target = this.storage.contributionAssetTarget(session, '.mp4');
    const ffmpegArguments = [
      '-v', 'error',
      '-i', source.absolutePath,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c', 'copy',
      '-map_metadata', '-1',
      '-movflags', '+faststart',
    ];
    if (video.codec_name === 'hevc') {
      ffmpegArguments.push('-tag:v', 'hvc1');
    }
    ffmpegArguments.push(target.absolutePath);
    const posterPath = `${target.absolutePath}.poster.png`;
    try {
      await execFileAsync('ffmpeg', ffmpegArguments, { maxBuffer: 1024 * 1024 });
      await execFileAsync('ffmpeg', [
        '-v', 'error',
        '-i', target.absolutePath,
        '-frames:v', '1',
        posterPath,
      ], { maxBuffer: 1024 * 1024 });
      await sharp(posterPath, { limitInputPixels: maxImagePixels })
        .resize({
          width: 960,
          height: 960,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toColourspace('srgb')
        .webp({ quality: 82 })
        .toFile(target.previewAbsolutePath);
      await fs.promises.rm(posterPath);
    } catch {
      throw new JournalContributionError(
        'MEDIA_PROCESSING_FAILED',
        `${source.sourceName} 视频整理失败。`,
        400,
        source.sourceName,
      );
    }
    const output = await fs.promises.stat(target.absolutePath);
    return {
      kind: 'video',
      sourceName: source.sourceName,
      mimeType: 'video/mp4',
      byteSize: output.size,
      relativePath: target.relativePath,
      previewRelativePath: target.previewRelativePath,
      width: video.width,
      height: video.height,
      duration: Math.round(duration),
      sortOrder,
    };
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

  private parseFrameRate(value: string | undefined): number {
    if (!value) return 0;
    const [numerator, denominator] = value.split('/').map(Number);
    if (!numerator || !denominator) return Number(value);
    return numerator / denominator;
  }

  private isHdr(colorTransfer: string | undefined): boolean {
    return colorTransfer === 'smpte2084' || colorTransfer === 'arib-std-b67';
  }

  private throwVideoFormat(filename: string): never {
    throw new JournalContributionError(
      'VIDEO_FORMAT_UNSUPPORTED',
      `${filename} 不符合约定的视频格式。`,
      400,
      filename,
    );
  }
}
