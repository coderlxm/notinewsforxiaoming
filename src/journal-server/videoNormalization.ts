import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { WebEntryAssetInput } from './repository.js';
import type { EntryStorageSession, JournalStorage } from './storage.js';
import type { JournalVideoPreviewService } from './videoPreview.js';

const execFileAsync = promisify(execFile);
const maxVideoBytes = 500 * 1024 * 1024;
const maxVideoDuration = 300;

const ffprobeSchema = z.object({
  format: z.object({
    format_name: z.string(),
    duration: z.string().optional(),
  }),
  streams: z.array(z.object({
    index: z.number().int().nonnegative(),
    codec_type: z.string(),
    codec_name: z.string().optional(),
    profile: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.string().optional(),
    r_frame_rate: z.string().optional(),
    disposition: z.object({
      attached_pic: z.number().int(),
    }).optional(),
  })),
});

export interface VideoNormalizationSource {
  absolutePath: string;
  sourceName: string;
  byteSize: number;
}

export type JournalVideoNormalizationErrorCode =
  | 'FILE_TOO_LARGE'
  | 'VIDEO_FORMAT_UNSUPPORTED'
  | 'VIDEO_DURATION_EXCEEDED'
  | 'MEDIA_PROCESSING_FAILED';

export class JournalVideoNormalizationError extends Error {
  constructor(
    readonly code: JournalVideoNormalizationErrorCode,
    message: string,
    readonly filename?: string,
  ) {
    super(message);
  }
}

export interface NormalizedVideoAsset extends WebEntryAssetInput {
  kind: 'video';
  mimeType: 'video/mp4';
  duration: number;
}

export class JournalVideoNormalizationService {
  constructor(
    private readonly storage: JournalStorage,
    private readonly videoPreviews: JournalVideoPreviewService,
  ) {}

  async normalize(
    source: VideoNormalizationSource,
    session: EntryStorageSession,
  ): Promise<NormalizedVideoAsset> {
    if (source.byteSize > maxVideoBytes) {
      throw new JournalVideoNormalizationError(
        'FILE_TOO_LARGE',
        `${source.sourceName} 超过 500 MiB。`,
        source.sourceName,
      );
    }
    let probe;
    try {
      const result = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries',
        'format=format_name,duration:stream=index,codec_type,codec_name,profile,width,height,duration,r_frame_rate:stream_disposition=attached_pic',
        '-of', 'json',
        source.absolutePath,
      ], { maxBuffer: 1024 * 1024 });
      probe = ffprobeSchema.parse(JSON.parse(result.stdout));
    } catch {
      this.throwFormat(source.sourceName);
    }

    const videoStreams = probe.streams.filter(
      (stream) => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1,
    );
    const audioStreams = probe.streams.filter((stream) => stream.codec_type === 'audio');
    const video = videoStreams[0];
    const audio = audioStreams.find((stream) => stream.codec_name === 'aac');
    if (
      !video
      || !video.width
      || !video.height
      || Math.max(video.width, video.height) > 3840
      || Math.min(video.width, video.height) > 2160
      || !probe.format.format_name.split(',').some((name) => name === 'mov' || name === 'mp4')
      || (video.codec_name !== 'h264' && video.codec_name !== 'hevc')
      || (
        video.codec_name === 'hevc'
        && video.profile !== 'Main'
        && video.profile !== 'Main 10'
      )
      || (audioStreams.length > 0 && audio === undefined)
    ) {
      this.throwFormat(source.sourceName);
    }
    const duration = Number(video.duration ?? probe.format.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      this.throwFormat(source.sourceName);
    }
    if (duration > maxVideoDuration) {
      throw new JournalVideoNormalizationError(
        'VIDEO_DURATION_EXCEEDED',
        `${source.sourceName} 超过 5 分钟。`,
        source.sourceName,
      );
    }
    const frameRate = this.parseFrameRate(video.r_frame_rate);
    if (
      !Number.isFinite(frameRate)
      || frameRate <= 0
      || frameRate > 60
    ) {
      this.throwFormat(source.sourceName);
    }

    const target = this.storage.contributionAssetTarget(session, '.mp4');
    const ffmpegArguments = [
      '-v', 'error',
      '-i', source.absolutePath,
      '-map', `0:${video.index}`,
    ];
    if (audio) {
      ffmpegArguments.push('-map', `0:${audio.index}`);
    }
    ffmpegArguments.push(
      '-c', 'copy',
      '-map_metadata', '-1',
      '-movflags', '+faststart',
    );
    if (video.codec_name === 'hevc') {
      ffmpegArguments.push('-tag:v', 'hvc1');
    }
    ffmpegArguments.push(target.absolutePath);
    try {
      await execFileAsync('ffmpeg', ffmpegArguments, { maxBuffer: 1024 * 1024 });
      await this.videoPreviews.generate(target.absolutePath, target.previewAbsolutePath);
    } catch {
      throw new JournalVideoNormalizationError(
        'MEDIA_PROCESSING_FAILED',
        `${source.sourceName} 视频整理失败。`,
        source.sourceName,
      );
    }
    const output = await fs.promises.stat(target.absolutePath);
    return {
      relativePath: target.relativePath,
      previewRelativePath: target.previewRelativePath,
      kind: 'video',
      mimeType: 'video/mp4',
      originalName: source.sourceName,
      byteSize: output.size,
      width: video.width,
      height: video.height,
      duration: Math.round(duration),
    };
  }

  private parseFrameRate(value: string | undefined): number {
    if (!value) return 0;
    const [numerator, denominator] = value.split('/').map(Number);
    if (!numerator || !denominator) return Number(value);
    return numerator / denominator;
  }

  private throwFormat(filename: string): never {
    throw new JournalVideoNormalizationError(
      'VIDEO_FORMAT_UNSUPPORTED',
      `${filename} 不符合约定的视频格式。`,
      filename,
    );
  }
}
