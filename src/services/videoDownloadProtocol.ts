import { z } from 'zod';

export const videoDownloadRequestSchema = z.object({
  url: z.string().url(),
});

export const videoSelectedFormatSchema = z.object({
  formatId: z.string(),
  description: z.string(),
  resolution: z.string(),
  fps: z.number().nullable(),
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  container: z.string(),
  dynamicRange: z.string().nullable(),
});

export const videoDownloadEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stage'),
    stage: z.enum(['downloading', 'uploading']),
  }),
  z.object({
    type: z.literal('result'),
    fileName: z.string(),
    byteSize: z.number().int().nonnegative(),
    drivePath: z.string(),
    elapsedMs: z.number().int().positive(),
    selectedFormat: videoSelectedFormatSchema,
  }),
]);

export type VideoDownloadRequest = z.infer<typeof videoDownloadRequestSchema>;
export type VideoDownloadEvent = z.infer<typeof videoDownloadEventSchema>;
export type VideoDownloadResult = Extract<VideoDownloadEvent, { type: 'result' }>;
export type VideoDownloadStage = Extract<VideoDownloadEvent, { type: 'stage' }>['stage'];

export async function readVideoDownloadRequest(): Promise<VideoDownloadRequest> {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
  }
  return videoDownloadRequestSchema.parse(JSON.parse(input));
}

export function writeVideoDownloadEvent(event: VideoDownloadEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}
