import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const projectDirectory = '/opt/x-liked-video-downloader';

const syncResultSchema = z.object({
  discovered: z.number(),
  downloaded: z.number(),
  uploaded: z.number(),
  errors: z.number(),
});

export type XLikedVideoSyncResult = z.infer<typeof syncResultSchema>;

let running = false;

export function isXLikedVideoSyncRunning(): boolean {
  return running;
}

export async function runXLikedVideoSync(): Promise<XLikedVideoSyncResult> {
  running = true;
  try {
    const { stdout } = await execFileAsync('/usr/bin/docker', [
      'compose',
      '--project-directory', projectDirectory,
      '--env-file', `${projectDirectory}/.env`,
      '-f', `${projectDirectory}/current/compose.yml`,
      'run', '--rm', 'app', 'sync',
    ], {
      cwd: projectDirectory,
      timeout: 30 * 60 * 1000,
      maxBuffer: 1024 * 1024,
    });

    return syncResultSchema.parse(JSON.parse(stdout));
  } finally {
    running = false;
  }
}
