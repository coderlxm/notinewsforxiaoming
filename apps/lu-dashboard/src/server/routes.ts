import { Hono } from 'hono'
import { z } from 'zod'
import { createSession, deleteSession, getSession, requireSession } from './auth'
import { loadRecords } from './db'

export const app = new Hono()

const dashboardResponseSchema = z.object({
  generatedAt: z.string(),
  timezone: z.literal('Asia/Shanghai'),
  records: z.array(z.object({
    id: z.number().int(),
    occurredAt: z.string(),
  })),
})

app.get('/api/session', getSession)
app.post('/api/session', createSession)
app.delete('/api/session', deleteSession)

app.get('/api/dashboard', requireSession, (c) => {
  const response = dashboardResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Shanghai',
    records: loadRecords(),
  })
  return c.json(response)
})
