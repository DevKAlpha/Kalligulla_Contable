/**
 * Standalone Node entry point. The web app already mounts the same API under /api,
 * so this is only needed to run the API as its own service (`npm run api:dev`).
 * A future `main.bun.ts` would be `export default { port, fetch: app.fetch }`.
 */
import { serve } from '@hono/node-server'
import { createDefaultApp } from './app'

const port = Number(process.env.PORT ?? 4000)
const app = createDefaultApp()

serve({ fetch: app.fetch, port, hostname: process.env.HOSTNAME ?? '127.0.0.1' }, (info) => {
  console.log(`[kaligula-api] listening on http://${info.address}:${info.port}/api`)
})
