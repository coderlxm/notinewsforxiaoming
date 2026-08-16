import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type {
  JournalRepository,
  JournalResumePreviewPageRecord,
} from './repository.js';

const execFileAsync = promisify(execFile);
const previewDpi = 216;
const previewFilePattern = /^page-(\d+)\.png$/;

export class JournalResumePreviewService {
  async generate(pdf: Buffer): Promise<JournalResumePreviewPageRecord[]> {
    const temporaryDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'journal-resume-preview-'),
    );
    try {
      const sourcePath = path.join(temporaryDirectory, 'resume.pdf');
      const outputPrefix = path.join(temporaryDirectory, 'page');
      await fs.promises.writeFile(sourcePath, pdf);
      await execFileAsync('pdftocairo', [
        '-png',
        '-r', String(previewDpi),
        sourcePath,
        outputPrefix,
      ], { maxBuffer: 4 * 1024 * 1024 });

      const sourcePages = (await fs.promises.readdir(temporaryDirectory))
        .flatMap((filename) => {
          const match = previewFilePattern.exec(filename);
          return match ? [{ filename, pageNumber: Number(match[1]) }] : [];
        })
        .sort((left, right) => left.pageNumber - right.pageNumber);
      if (sourcePages.length === 0) {
        throw new Error('PDF preview conversion did not produce any pages.');
      }

      const pages: JournalResumePreviewPageRecord[] = [];
      for (const [index, sourcePage] of sourcePages.entries()) {
        const expectedPageNumber = index + 1;
        if (sourcePage.pageNumber !== expectedPageNumber) {
          throw new Error(`PDF preview page ${expectedPageNumber} is missing.`);
        }
        const result = await sharp(path.join(temporaryDirectory, sourcePage.filename))
          .toColourspace('srgb')
          .webp({ lossless: true, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        pages.push({
          pageNumber: sourcePage.pageNumber,
          contentWebp: result.data,
          width: result.info.width,
          height: result.info.height,
        });
      }
      return pages;
    } finally {
      await fs.promises.rm(temporaryDirectory, { recursive: true });
    }
  }
}

export class JournalResumePreviewBackfillService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly previews: JournalResumePreviewService,
  ) {}

  async run(): Promise<void> {
    const resume = this.repository.getResumeOrNull();
    if (
      resume?.format !== 'pdf'
      || this.repository.listResumePreviewPageMetadata().length > 0
    ) return;
    const pages = await this.previews.generate(resume.content);
    this.repository.replaceResumePreviewPages(pages);
  }
}
