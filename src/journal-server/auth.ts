import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const adminCookieName = 'journal_session';
const adminCookieValue = 'authenticated';
const adminCookieMaxAge = 30 * 24 * 60 * 60;
const protectedCookieMaxAge = 30 * 24 * 60 * 60;
const accessPasswordKeyLength = 32;

function secretsEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function hashAccessPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, accessPasswordKeyLength);
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

export function accessPasswordMatches(password: string, storedHash: string): boolean {
  const [algorithm, saltValue, hashValue] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) {
    throw new Error('Stored Journal access password hash is invalid.');
  }
  const expected = Buffer.from(hashValue, 'base64url');
  if (expected.length !== accessPasswordKeyLength) {
    throw new Error('Stored Journal access password hash has an invalid length.');
  }
  const actual = scryptSync(
    password,
    Buffer.from(saltValue, 'base64url'),
    accessPasswordKeyLength,
  );
  return timingSafeEqual(actual, expected);
}

function protectedCookieName(publicId: string): string {
  return `journal_access_${publicId}`;
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

  hasProtectedAccess(
    request: FastifyRequest,
    publicId: string,
    accessRevision: number,
  ): boolean {
    const signedValue = request.cookies[protectedCookieName(publicId)];
    if (!signedValue) return false;
    const unsigned = request.unsignCookie(signedValue);
    return unsigned.valid && unsigned.value === `${publicId}:${accessRevision}`;
  }

  setProtectedAccessCookie(
    reply: FastifyReply,
    publicId: string,
    accessRevision: number,
  ): void {
    reply.setCookie(protectedCookieName(publicId), `${publicId}:${accessRevision}`, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      signed: true,
      maxAge: protectedCookieMaxAge,
    });
  }

  setAdminCookie(reply: FastifyReply): void {
    reply.setCookie(adminCookieName, adminCookieValue, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      signed: true,
      maxAge: adminCookieMaxAge,
    });
  }

  clearAdminCookie(reply: FastifyReply): void {
    reply.clearCookie(adminCookieName, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
    });
  }
}
