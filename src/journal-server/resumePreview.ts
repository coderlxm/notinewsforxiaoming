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
const darkPageBackground = [39, 39, 37] as const;
const darkPageText = [242, 241, 237] as const;
const neutralChromaThreshold = 18;

async function createDarkPreview(sourcePath: string): Promise<Buffer> {
  const source = await sharp(sourcePath)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = source.data;
  for (let index = 0; index < pixels.length; index += source.info.channels) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (chroma > neutralChromaThreshold) continue;

    const luminance = (red * 54 + green * 183 + blue * 19) / 256;
    const darkness = 1 - luminance / 255;
    pixels[index] = Math.round(
      darkPageBackground[0] + (darkPageText[0] - darkPageBackground[0]) * darkness,
    );
    pixels[index + 1] = Math.round(
      darkPageBackground[1] + (darkPageText[1] - darkPageBackground[1]) * darkness,
    );
    pixels[index + 2] = Math.round(
      darkPageBackground[2] + (darkPageText[2] - darkPageBackground[2]) * darkness,
    );
  }
  return sharp(pixels, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels: source.info.channels,
    },
  })
    .webp({ lossless: true, effort: 4 })
    .toBuffer();
}

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
        const sourcePagePath = path.join(temporaryDirectory, sourcePage.filename);
        const lightPreview = await sharp(sourcePagePath)
          .toColourspace('srgb')
          .webp({ lossless: true, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        pages.push({
          pageNumber: sourcePage.pageNumber,
          contentLightWebp: lightPreview.data,
          contentDarkWebp: await createDarkPreview(sourcePagePath),
          width: lightPreview.info.width,
          height: lightPreview.info.height,
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
      || this.repository.hasCompleteResumePreviewPages()
    ) return;
    const pages = await this.previews.generate(resume.content);
    this.repository.replaceResumePreviewPages(pages);
  }
}
