import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const adminCookieName = 'journal_session';
const adminCookieValue = 'authenticated';

function secretsEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

export class JournalAuth {
  constructor(
    private readonly ingestToken: string,
    private readonly adminPassword: string,
  ) {}

  requireInternal = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    if (!secretsEqual(token, this.ingestToken)) {
      await reply.code(401).send({ error: 'Journal ingest authentication failed.' });
      return reply;
    }
  };

  requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    if (!this.isAdmin(request)) {
      await reply.code(401).send({ error: 'Journal administrator login is required.' });
      return reply;
    }
  };

  passwordMatches(password: string): boolean {
    return secretsEqual(password, this.adminPassword);
  }

  isAdmin(request: FastifyRequest): boolean {
    const signedValue = request.cookies[adminCookieName];
    if (!signedValue) return false;
    const unsigned = request.unsignCookie(signedValue);
    return unsigned.valid && unsigned.value === adminCookieValue;
  }

  setAdminCookie(reply: FastifyReply): void {
    reply.setCookie(adminCookieName, adminCookieValue, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      signed: true,
    });
  }

  clearAdminCookie(reply: FastifyReply): void {
    reply.clearCookie(adminCookieName, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
  }
}
