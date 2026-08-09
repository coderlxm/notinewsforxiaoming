import { createHash, randomBytes } from 'node:crypto';
import { JournalContributionError } from './contributionError.js';
import type {
  JournalContributionLinkRecord,
  JournalRepository,
} from './repository.js';

const contributionLinkLifetimeMs = 72 * 60 * 60 * 1000;

export type JournalContributionLinkLifetime = 'temporary' | 'permanent';

interface JournalContributionLinkSummary {
  expiresAt: string | null;
  createdAt: string;
}

export class JournalContributionLinkService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly publicBaseUrl: string,
  ) {}

  requireValid(token: string): JournalContributionLinkRecord {
    const link = this.repository.findContributionLinkByTokenHash(this.hashToken(token));
    if (!link || link.revokedAt !== null) {
      throw new JournalContributionError(
        'LINK_REVOKED',
        '这条投稿链接已经失效，请向小明索取新链接。',
        401,
      );
    }
    if (link.expiresAt !== null && link.expiresAt <= new Date().toISOString()) {
      throw new JournalContributionError(
        'LINK_EXPIRED',
        '这条投稿链接已经过期，请向小明索取新链接。',
        401,
      );
    }
    return link;
  }

  current(): JournalContributionLinkSummary | null {
    const link = this.repository.getActiveContributionLink(new Date().toISOString());
    return link ? {
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    } : null;
  }

  create(lifetime: JournalContributionLinkLifetime): JournalContributionLinkSummary & {
    url: string;
  } {
    const token = randomBytes(32).toString('base64url');
    const createdAt = new Date().toISOString();
    const expiresAt = lifetime === 'temporary'
      ? new Date(Date.now() + contributionLinkLifetimeMs).toISOString()
      : null;
    this.repository.createContributionLink(this.hashToken(token), expiresAt, createdAt);
    return {
      url: `${this.publicBaseUrl}/contribute#token=${token}`,
      expiresAt,
      createdAt,
    };
  }

  revoke(): boolean {
    return this.repository.revokeActiveContributionLink(new Date().toISOString());
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
