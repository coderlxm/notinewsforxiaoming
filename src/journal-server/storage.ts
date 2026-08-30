import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { JournalDeletionTargetEntry } from './types.js';

export interface EntryStorageSession {
  tempDir: string;
  finalDir: string;
  relativeDir: string;
}

export interface ContributionAssetTarget {
  absolutePath: string;
  relativePath: string;
  previewAbsolutePath: string;
  previewRelativePath: string;
  posterAbsolutePath: string;
  posterRelativePath: string;
}

export class JournalStorage {
  private readonly assetsDir: string;
  private readonly temporaryDir: string;
  private readonly contributionUploadsDir = '/tmp/journal-contribution-uploads';

  constructor(private readonly dataDir: string) {
    this.assetsDir = path.join(dataDir, 'assets');
    this.temporaryDir = path.join(this.assetsDir, '.tmp');
    fs.mkdirSync(this.temporaryDir, { recursive: true });
  }

  async initializeContributionStorage(): Promise<void> {
    await fs.promises.rm(this.contributionUploadsDir, { recursive: true, force: true });
    await fs.promises.rm(this.temporaryDir, { recursive: true, force: true });
    await fs.promises.mkdir(this.contributionUploadsDir, { recursive: true });
    await fs.promises.mkdir(this.temporaryDir, { recursive: true });
  }

  contributionUploadDirectory(): string {
    return this.contributionUploadsDir;
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
    previewAbsolutePath: string;
    previewRelativePath: string;
    posterAbsolutePath: string;
    posterRelativePath: string;
  } {
    const filename = randomUUID();
    const absolutePath = path.join(session.tempDir, filename);
    const relativePath = path.posix.join(session.relativeDir, filename);
    return {
      absolutePath,
      relativePath,
      previewAbsolutePath: `${absolutePath}.preview.webp`,
      previewRelativePath: this.previewRelativePath(relativePath),
      posterAbsolutePath: `${absolutePath}.poster.webp`,
      posterRelativePath: this.posterRelativePath(relativePath),
    };
  }

  contributionAssetTarget(
    session: EntryStorageSession,
    extension: '.webp' | '.mp4',
  ): ContributionAssetTarget {
    const filename = `${randomUUID()}${extension}`;
    const absolutePath = path.join(session.tempDir, filename);
    const relativePath = path.posix.join(session.relativeDir, filename);
    return {
      absolutePath,
      relativePath,
      previewAbsolutePath: `${absolutePath}.preview.webp`,
      previewRelativePath: this.previewRelativePath(relativePath),
      posterAbsolutePath: `${absolutePath}.poster.webp`,
      posterRelativePath: this.posterRelativePath(relativePath),
    };
  }

  previewRelativePath(relativePath: string): string {
    return `${relativePath}.preview.webp`;
  }

  posterRelativePath(relativePath: string): string {
    return `${relativePath}.poster.webp`;
  }

  absoluteAssetPath(relativePath: string): string {
    const absolutePath = path.resolve(this.dataDir, relativePath);
    const assetsRoot = path.resolve(this.assetsDir);
    if (!absolutePath.startsWith(`${assetsRoot}${path.sep}`)) {
      throw new Error(`Asset ${relativePath} is outside the assets root.`);
    }
    return absolutePath;
  }

  async finalize(session: EntryStorageSession): Promise<void> {
    await fs.promises.mkdir(path.dirname(session.finalDir), { recursive: true });
    try {
      await fs.promises.rename(session.tempDir, session.finalDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') throw error;
      await fs.promises.mkdir(session.finalDir, { recursive: true });
      const files = await fs.promises.readdir(session.tempDir);
      for (const file of files) {
        await fs.promises.rename(
          path.join(session.tempDir, file),
          path.join(session.finalDir, file),
        );
      }
      await fs.promises.rm(session.tempDir, { recursive: true });
    }
  }

  async appendToFinal(session: EntryStorageSession): Promise<void> {
    await fs.promises.mkdir(session.finalDir, { recursive: true });
    const filenames = await fs.promises.readdir(session.tempDir);
    for (const filename of filenames) {
      await fs.promises.rename(
        path.join(session.tempDir, filename),
        path.join(session.finalDir, filename),
      );
    }
    await fs.promises.rm(session.tempDir, { recursive: true });
  }

  async discardTemporary(session: EntryStorageSession): Promise<void> {
    await fs.promises.rm(session.tempDir, { recursive: true });
  }

  async discardFinal(session: EntryStorageSession): Promise<void> {
    await fs.promises.rm(session.finalDir, { recursive: true });
  }

  async deleteEntryAssets(entries: JournalDeletionTargetEntry[]): Promise<void> {
    const directories: string[] = [];

    for (const entry of entries) {
      if (entry.assetRelativePaths.length === 0) continue;
      const relativeDirectories = new Set(
        entry.assetRelativePaths.map((relativePath) => path.posix.dirname(relativePath)),
      );
      if (relativeDirectories.size !== 1) {
        throw new Error(`Journal entry ${entry.id} assets do not share one directory.`);
      }

      const relativeDirectory = [...relativeDirectories][0] as string;
      const segments = relativeDirectory.split('/');
      const [root, year, month, publicId] = segments;
      if (
        segments.length !== 4
        || root !== 'assets'
        || !year
        || !month
        || !/^\d{4}$/.test(year)
        || !/^(?:0[1-9]|1[0-2])$/.test(month)
        || publicId !== entry.publicId
      ) {
        throw new Error(`Journal entry ${entry.id} asset directory is invalid.`);
      }
      const absoluteDirectory = path.resolve(this.dataDir, ...segments);
      const assetsRoot = path.resolve(this.assetsDir);
      if (!absoluteDirectory.startsWith(`${assetsRoot}${path.sep}`)) {
        throw new Error(`Journal entry ${entry.id} asset directory is outside the assets root.`);
      }
      directories.push(absoluteDirectory);
    }

    for (const directory of directories) {
      await fs.promises.rm(directory, { recursive: true });
    }
  }

  async writeWebAsset(
    publicId: string,
    sourceCreatedAt: string,
    data: Buffer,
  ): Promise<string> {
    const sourceDate = new Date(sourceCreatedAt);
    const year = String(sourceDate.getUTCFullYear());
    const month = String(sourceDate.getUTCMonth() + 1).padStart(2, '0');
    const relativeDir = path.posix.join('assets', year, month, publicId);
    const absoluteDir = path.join(this.assetsDir, year, month, publicId);
    await fs.promises.mkdir(absoluteDir, { recursive: true });
    const filename = randomUUID();
    const absolutePath = path.join(absoluteDir, filename);
    await fs.promises.writeFile(absolutePath, data, { flag: 'wx' });
    return path.posix.join(relativeDir, filename);
  }

  async writeGameImage(gameId: string, assetId: string, data: Buffer): Promise<string> {
    const relativeDir = path.posix.join('assets', 'games', gameId);
    const absoluteDir = path.join(this.assetsDir, 'games', gameId);
    await fs.promises.mkdir(absoluteDir, { recursive: true });
    const absolutePath = path.join(absoluteDir, assetId);
    await fs.promises.writeFile(absolutePath, data, { flag: 'wx' });
    return path.posix.join(relativeDir, assetId);
  }

  async deleteAsset(relativePath: string): Promise<void> {
    await fs.promises.rm(this.absoluteAssetPath(relativePath));
  }

  async deleteAssetFiles(
    relativePath: string,
    previewRelativePath: string,
    posterRelativePath: string | null,
  ): Promise<void> {
    await fs.promises.rm(this.absoluteAssetPath(previewRelativePath));
    if (posterRelativePath !== null) {
      await fs.promises.rm(this.absoluteAssetPath(posterRelativePath));
    }
    await fs.promises.rm(this.absoluteAssetPath(relativePath));
  }

  async deleteContributionDirectory(
    publicId: string,
    submittedAt: string,
  ): Promise<void> {
    const submittedDate = new Date(submittedAt);
    const year = String(submittedDate.getUTCFullYear());
    const month = String(submittedDate.getUTCMonth() + 1).padStart(2, '0');
    const absoluteDirectory = path.join(this.assetsDir, year, month, publicId);
    await fs.promises.rm(absoluteDirectory, { recursive: true });
  }
}
