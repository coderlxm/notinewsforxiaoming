import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface EntryStorageSession {
  tempDir: string;
  finalDir: string;
  relativeDir: string;
}

export class JournalStorage {
  private readonly assetsDir: string;
  private readonly temporaryDir: string;

  constructor(private readonly dataDir: string) {
    this.assetsDir = path.join(dataDir, 'assets');
    this.temporaryDir = path.join(this.assetsDir, '.tmp');
    fs.mkdirSync(this.temporaryDir, { recursive: true });
  }

  async begin(publicId: string, sourceCreatedAt: string): Promise<EntryStorageSession> {
    const sourceDate = new Date(sourceCreatedAt);
    const year = String(sourceDate.getUTCFullYear());
    const month = String(sourceDate.getUTCMonth() + 1).padStart(2, '0');
    const relativeDir = path.posix.join('assets', year, month, publicId);
    const tempDir = path.join(this.temporaryDir, randomUUID());
    await fs.promises.mkdir(tempDir, { recursive: true });
    return {
      tempDir,
      finalDir: path.join(this.dataDir, relativeDir),
      relativeDir,
    };
  }

  assetTarget(session: EntryStorageSession): {
    absolutePath: string;
    relativePath: string;
  } {
    const filename = randomUUID();
    return {
      absolutePath: path.join(session.tempDir, filename),
      relativePath: path.posix.join(session.relativeDir, filename),
    };
  }

  async finalize(session: EntryStorageSession): Promise<void> {
    await fs.promises.mkdir(path.dirname(session.finalDir), { recursive: true });
    await fs.promises.rename(session.tempDir, session.finalDir);
  }

  async discardTemporary(session: EntryStorageSession): Promise<void> {
    await fs.promises.rm(session.tempDir, { recursive: true });
  }

  async discardFinal(session: EntryStorageSession): Promise<void> {
    await fs.promises.rm(session.finalDir, { recursive: true });
  }
}
