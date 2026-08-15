import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { fileURLToPath } from 'node:url'
import { config } from './server/config'
import { app } from './server/routes'

if (config.production) {
  const clientRoot = fileURLToPath(new URL('../client', import.meta.url))
  app.use('/assets/*', serveStatic({ root: clientRoot }))
  app.get('/', serveStatic({ root: clientRoot, path: 'index.html' }))
}

serve({ fetch: app.fetch, port: config.port })
