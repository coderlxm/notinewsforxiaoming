import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { fileTypeFromBuffer } from 'file-type';
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type {
  JournalAdminResumeSummary,
  JournalPublicResume,
  JournalResumeAccessInput,
  JournalResumeFormat,
  JournalResumeSummary,
} from '../shared/journalProtocol.js';
import { accessPasswordMatches, hashAccessPassword, type JournalAuth } from './auth.js';
import type {
  JournalRepository,
  JournalResumeRecord,
} from './repository.js';
import type { JournalResumePreviewService } from './resumePreview.js';

const resumeAccessCookieName = 'journal_resume_access';
const maxMarkdownBytes = 1024 * 1024;
const maxPdfBytes = 10 * 1024 * 1024;
const maxTemporaryShareMs = 30 * 24 * 60 * 60 * 1000;
const allowedMarkdownExtensions = new Set(['.md', '.markdown']);

const resumeAllowedTags = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li',
  'blockquote', 'hr', 'br', 'strong', 'em', 's', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a',
];

const resumeSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: resumeAllowedTags,
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
  },
};

export class JournalResumeInputError extends Error {
  readonly statusCode = 400;
}

export class JournalResumeNotFoundError extends Error {
  readonly statusCode = 404;
}

export class JournalResumePasswordError extends Error {
  readonly statusCode = 401;
}

export class JournalResumeService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly auth: JournalAuth,
    private readonly publicBaseUrl: string,
    private readonly previews: JournalResumePreviewService,
  ) {}

  resolveContent(request: FastifyRequest): JournalPublicResume | null {
    const record = this.repository.getResumeOrNull();
    if (!record) return null;
    if (
      record.accessMode === 'protected'
      && !this.auth.isAdmin(request)
      && !this.hasAccessCookie(request, record)
    ) {
      return { kind: 'locked', accessMode: 'protected' };
    }
    if (!this.authorize(request)) return null;
    return this.contentFor(record);
  }

  contentFor(record: JournalResumeRecord): JournalPublicResume {
    if (record.format === 'markdown') {
      if (record.renderedHtml === null) {
        throw new Error('Stored Markdown resume is missing rendered HTML.');
      }
      return {
        kind: 'resume',
        format: 'markdown',
        accessMode: record.accessMode,
        originalName: record.originalName,
        updatedAt: record.updatedAt,
        renderedHtml: record.renderedHtml,
        downloadUrl: this.downloadUrl(record.revision),
      };
    }
    const previewPages = this.repository.listResumePreviewPageMetadata();
    if (previewPages.length === 0) {
      throw new Error('Stored PDF resume is missing preview pages.');
    }
    return {
      kind: 'resume',
      format: 'pdf',
      accessMode: record.accessMode,
      originalName: record.originalName,
      updatedAt: record.updatedAt,
      contentUrl: this.fileUrl(record.revision),
      downloadUrl: this.downloadUrl(record.revision),
      previewPages: previewPages.map(page => ({
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        lightUrl: this.previewPageUrl(page.pageNumber, 'light', record.revision),
        darkUrl: this.previewPageUrl(page.pageNumber, 'dark', record.revision),
      })),
    };
  }

  resolvePreviewPage(
    request: FastifyRequest,
    pageNumber: number,
    theme: 'light' | 'dark',
  ): Buffer | null {
    const record = this.authorize(request);
    if (!record || record.format !== 'pdf') return null;
    const page = this.repository.getResumePreviewPageOrNull(pageNumber);
    if (!page) return null;
    return theme === 'dark' ? page.contentDarkWebp : page.contentLightWebp;
  }

  authorize(request: FastifyRequest): JournalResumeRecord | null {
    const record = this.repository.getResumeOrNull();
    if (!record) return null;
    if (this.auth.isAdmin(request)) return record;
    if (record.accessMode === 'public') return record;
    if (record.accessMode === 'private') return null;
    if (this.hasAccessCookie(request, record)) return record;
    return null;
  }

  publicSummary(): JournalResumeSummary | null {
    const record = this.repository.getResumeOrNull();
    if (!record) return null;
    if (record.accessMode !== 'protected' && record.accessMode !== 'public') return null;
    return {
      format: record.format,
      originalName: record.originalName,
      updatedAt: record.updatedAt,
      viewUrl: '/resume',
      accessMode: record.accessMode === 'protected' ? 'protected' : 'public',
    };
  }

  adminSummary(): JournalAdminResumeSummary | null {
    const record = this.repository.getResumeOrNull();
    return record ? this.toAdminSummary(record) : null;
  }

  delete(): void {
    this.repository.deleteResume();
  }

  unlock(request: FastifyRequest, reply: FastifyReply, password: string): JournalResumeRecord {
    const record = this.repository.getResumeOrNull();
    if (!record || record.accessMode !== 'protected' || !record.accessPasswordHash) {
      throw new JournalResumeNotFoundError('这份简历当前不可访问。');
    }
    if (!accessPasswordMatches(password, record.accessPasswordHash)) {
      throw new JournalResumePasswordError('简历访问口令不正确。');
    }
    this.setAccessCookie(reply, record, null);
    return record;
  }

  exchangeShareToken(
    reply: FastifyReply,
    token: string,
  ): JournalResumeRecord | null {
    const record = this.repository.getResumeOrNull();
    const link = this.repository.getResumeShareLinkOrNull();
    if (
      !record
      || record.accessMode !== 'temporary'
      || !link
      || link.tokenHash !== createHash('sha256').update(token).digest('hex')
    ) {
      return null;
    }
    if (link.expiresAt <= new Date().toISOString()) return null;
    const remainingSeconds = Math.max(
      1,
      Math.floor((new Date(link.expiresAt).getTime() - Date.now()) / 1000),
    );
    this.setAccessCookie(reply, record, link.expiresAt, remainingSeconds);
    return record;
  }

  async upload(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<JournalResumeRecord> {
    const format = this.detectFormat(input);
    if (format === 'pdf') {
      await this.assertPdfBytes(input.buffer);
    }
    const renderedHtml = format === 'markdown'
      ? this.renderMarkdown(input.buffer)
      : null;
    const previewPages = format === 'pdf'
      ? await this.previews.generate(input.buffer)
      : [];
    return this.repository.saveResume({
      format,
      originalName: input.originalName,
      content: input.buffer,
      renderedHtml,
      previewPages,
      accessGrantId: randomBytes(32).toString('base64url'),
      updatedAt: new Date().toISOString(),
    });
  }

  updateAccess(input: JournalResumeAccessInput): {
    summary: JournalAdminResumeSummary;
    shareUrl: string | null;
  } {
    const existing = this.repository.getResumeOrNull();
    if (!existing) throw new JournalResumeNotFoundError('简历尚未上传。');
    let accessPasswordHash: string | null = null;
    let token: string | null = null;
    let tokenHash: string | null = null;
    let shareExpiresAt: string | null = null;
    if (input.accessMode === 'protected') {
      accessPasswordHash = hashAccessPassword(input.password);
    }
    if (input.accessMode === 'temporary') {
      const expiresAt = new Date(input.expiresAt).getTime();
      const now = Date.now();
      if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + maxTemporaryShareMs) {
        throw new JournalResumeInputError('限时链接到期时间必须在未来 30 天内。');
      }
      token = randomBytes(32).toString('base64url');
      tokenHash = createHash('sha256').update(token).digest('hex');
      shareExpiresAt = new Date(input.expiresAt).toISOString();
    }
    const updated = this.repository.updateResumeAccess({
      accessMode: input.accessMode,
      accessPasswordHash,
      accessGrantId: randomBytes(32).toString('base64url'),
      tokenHash,
      shareExpiresAt,
      updatedAt: new Date().toISOString(),
    });
    return {
      summary: this.toAdminSummary(updated),
      shareUrl: token === null ? null : `${this.publicBaseUrl}/resume#token=${token}`,
    };
  }

  private toAdminSummary(record: JournalResumeRecord): JournalAdminResumeSummary {
    const link = this.repository.getResumeShareLinkOrNull();
    return {
      format: record.format,
      originalName: record.originalName,
      updatedAt: record.updatedAt,
      accessMode: record.accessMode,
      temporaryShare: link ? {
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
      } : null,
    };
  }

  private detectFormat(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): JournalResumeFormat {
    const originalName = input.originalName.split(/[\\/]/).pop() ?? '';
    const extension = originalName.toLowerCase().endsWith('.markdown')
      ? '.markdown'
      : path.extname(originalName.toLowerCase());
    if (allowedMarkdownExtensions.has(extension)) {
      if (input.buffer.byteLength > maxMarkdownBytes) {
        throw new JournalResumeInputError('Markdown 简历不能超过 1 MB。');
      }
      this.assertUtf8(input.buffer);
      return 'markdown';
    }
    if (extension === '.pdf') {
      if (input.mimeType !== 'application/pdf') {
        throw new JournalResumeInputError('PDF 简历的声明 MIME 必须是 application/pdf。');
      }
      if (input.buffer.byteLength > maxPdfBytes) {
        throw new JournalResumeInputError('PDF 简历不能超过 10 MB。');
      }
      return 'pdf';
    }
    throw new JournalResumeInputError('简历仅支持 Markdown（.md / .markdown）或 PDF 文件。');
  }

  private async assertPdfBytes(buffer: Buffer): Promise<void> {
    const detected = await fileTypeFromBuffer(buffer);
    if (detected?.mime !== 'application/pdf') {
      throw new JournalResumeInputError('文件内容不是有效的 PDF。');
    }
  }

  private assertUtf8(buffer: Buffer): void {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new JournalResumeInputError('Markdown 简历必须使用有效的 UTF-8 编码。');
    }
  }

  private renderMarkdown(buffer: Buffer): string {
    const marked = new Marked();
    const rendered = marked.parse(buffer.toString('utf8'));
    const html = sanitizeHtml(String(rendered), resumeSanitizeOptions);
    if (html.trim() === '') {
      throw new JournalResumeInputError('Markdown 简历渲染后没有可展示的内容。');
    }
    return html;
  }

  private hasAccessCookie(request: FastifyRequest, record: JournalResumeRecord): boolean {
    const signedValue = request.cookies[resumeAccessCookieName];
    if (!signedValue) return false;
    const unsigned = request.unsignCookie(signedValue);
    if (!unsigned.valid) return false;
    const [mode, accessRevision, accessGrantId, expiresAtValue] = unsigned.value.split(':');
    if (
      mode !== record.accessMode
      || accessRevision !== String(record.accessRevision)
      || accessGrantId !== record.accessGrantId
    ) return false;
    if (mode === 'protected') return expiresAtValue === undefined;
    if (mode !== 'temporary' || expiresAtValue === undefined) return false;
    const link = this.repository.getResumeShareLinkOrNull();
    if (!link) return false;
    const expiresAt = Number(expiresAtValue);
    return Number.isSafeInteger(expiresAt)
      && expiresAt === new Date(link.expiresAt).getTime()
      && expiresAt > Date.now();
  }

  private setAccessCookie(
    reply: FastifyReply,
    record: JournalResumeRecord,
    expiresAt: string | null,
    maxAge?: number,
  ): void {
    const value = expiresAt === null
      ? `protected:${record.accessRevision}:${record.accessGrantId}`
      : `temporary:${record.accessRevision}:${record.accessGrantId}:${new Date(expiresAt).getTime()}`;
    reply.setCookie(resumeAccessCookieName, value, {
      path: '/api/resume',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      signed: true,
      ...(maxAge === undefined ? {} : { maxAge }),
    });
  }

  private fileUrl(revision: number): string {
    return `/api/resume/file?v=${revision}`;
  }

  private downloadUrl(revision: number): string {
    return `/api/resume/download?v=${revision}`;
  }

  private previewPageUrl(
    pageNumber: number,
    theme: 'light' | 'dark',
    revision: number,
  ): string {
    return `/api/resume/pages/${pageNumber}/${theme}?v=${revision}`;
  }
}
