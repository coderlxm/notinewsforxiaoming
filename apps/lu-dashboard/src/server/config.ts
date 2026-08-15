import { z } from 'zod'

const envSchema = z.object({
  LU_DASHBOARD_PASSWORD: z.string().min(1),
  LU_COOKIE_SECRET: z.string().min(32),
  LU_DATABASE_PATH: z.string().min(1),
  LU_DASHBOARD_PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const env = envSchema.parse(process.env)

export const config = {
  password: env.LU_DASHBOARD_PASSWORD,
  cookieSecret: env.LU_COOKIE_SECRET,
  databasePath: env.LU_DATABASE_PATH,
  port: env.LU_DASHBOARD_PORT,
  production: env.NODE_ENV === 'production',
}
