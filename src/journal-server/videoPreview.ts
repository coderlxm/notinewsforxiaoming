import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import type { JournalRepository } from './repository.js';
import type { JournalStorage } from './storage.js';

const execFileAsync = promisify(execFile);
const candidatePositions = [0.1, 0.35, 0.6] as const;

const durationProbeSchema = z.object({
  format: z.object({
    duration: z.string(),
  }),
});

interface VideoPreviewCandidate {
  path: string;
  mean: number;
  deviation: number;
  entropy: number;
}

export function isJournalVideoAsset(kind: string, mimeType: string | null): boolean {
  return kind === 'video'
    || kind === 'video_note'
    || (kind === 'animation' && mimeType?.startsWith('image/') !== true)
    || (kind === 'sticker' && mimeType?.startsWith('video/') === true);
}

export class JournalVideoPreviewService {
  async generate(sourcePath: string, previewPath: string): Promise<void> {
    const duration = await this.readDuration(sourcePath);
    const temporaryDir = `${previewPath}.${randomUUID()}.video-preview`;
    await fs.promises.mkdir(temporaryDir);

    try {
      const candidates: VideoPreviewCandidate[] = [];
      for (const [index, position] of candidatePositions.entries()) {
        const candidatePath = path.join(temporaryDir, `${index}.png`);
        await execFileAsync('ffmpeg', [
          '-v', 'error',
          '-ss', String(duration * position),
          '-i', sourcePath,
          '-frames:v', '1',
          '-f', 'image2',
          candidatePath,
        ], { maxBuffer: 1024 * 1024 });
        const stats = await sharp(candidatePath).stats();
        const [red, green, blue] = stats.channels;
        if (!red || !green || !blue) {
          throw new Error(`Video candidate ${candidatePath} has no RGB channels.`);
        }
        candidates.push({
          path: candidatePath,
          mean: red.mean * 0.2126 + green.mean * 0.7152 + blue.mean * 0.0722,
          deviation: red.stdev * 0.2126 + green.stdev * 0.7152 + blue.stdev * 0.0722,
          entropy: stats.entropy,
        });
      }

      const effectiveCandidates = candidates.filter(
        (candidate) => candidate.mean >= 18 && candidate.deviation >= 5,
      );
      const selectionPool = effectiveCandidates.length > 0
        ? effectiveCandidates
        : candidates;
      const selected = selectionPool.reduce((best, candidate) => (
        candidate.entropy > best.entropy ? candidate : best
      ));
      const temporaryPreviewPath = path.join(temporaryDir, 'preview.webp');
      await sharp(selected.path)
        .resize({
          width: 960,
          height: 960,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toColourspace('srgb')
        .webp({ quality: 82 })
        .toFile(temporaryPreviewPath);
      await fs.promises.rename(temporaryPreviewPath, previewPath);
    } finally {
      await fs.promises.rm(temporaryDir, { recursive: true });
    }
  }

  private async readDuration(sourcePath: string): Promise<number> {
    const result = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      sourcePath,
    ], { maxBuffer: 1024 * 1024 });
    const probe = durationProbeSchema.parse(JSON.parse(result.stdout));
    const duration = Number(probe.format.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Video ${sourcePath} does not expose a usable duration.`);
    }
    return duration;
  }
}

export class JournalVideoPreviewBackfillService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly storage: JournalStorage,
    private readonly previews: JournalVideoPreviewService,
  ) {}

  async run(): Promise<void> {
    for (const asset of this.repository.listVideoAssetsMissingPreview()) {
      const previewRelativePath = this.storage.previewRelativePath(asset.relativePath);
      try {
        await this.previews.generate(
          this.storage.absoluteAssetPath(asset.relativePath),
          this.storage.absoluteAssetPath(previewRelativePath),
        );
        this.repository.completeVideoPreviewBackfill(asset.id, previewRelativePath);
      } catch (error) {
        throw new Error(`Journal video preview backfill failed for asset ${asset.id}.`, {
          cause: error,
        });
      }
    }
  }
}
