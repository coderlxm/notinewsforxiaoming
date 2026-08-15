import { createHash, timingSafeEqual } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { Handler } from 'hono'
import { z } from 'zod'
import { config } from './config'

const COOKIE_NAME = 'lu_session'
const AUTHENTICATED = 'authenticated'

const cookieOptions = {
  httpOnly: true,
  sameSite: 'Strict' as const,
  secure: config.production,
  path: '/',
  maxAge: 604800,
}

const loginSchema = z.object({
  password: z.string(),
})

function digest(input: string): Buffer {
  return createHash('sha256').update(input).digest()
}

function passwordMatches(input: string): boolean {
  const expected = digest(config.password)
  const actual = digest(input)
  return timingSafeEqual(expected, actual)
}

export const requireSession = createMiddleware(async (c, next) => {
  const session = await getSignedCookie(c, config.cookieSecret, COOKIE_NAME)
  if (session !== AUTHENTICATED) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

export const getSession: Handler = async (c) => {
  const session = await getSignedCookie(c, config.cookieSecret, COOKIE_NAME)
  return c.json({ authenticated: session === AUTHENTICATED })
}

export const createSession: Handler = async (c) => {
  const body = loginSchema.parse(await c.req.json())
  if (!passwordMatches(body.password)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await setSignedCookie(c, COOKIE_NAME, AUTHENTICATED, config.cookieSecret, cookieOptions)
  return c.json({ authenticated: true })
}

export const deleteSession: Handler = async (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/', secure: config.production })
  return c.json({ authenticated: false })
}
