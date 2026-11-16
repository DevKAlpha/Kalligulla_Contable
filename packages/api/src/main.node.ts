/**
 * Standalone Node entry point. The web app already mounts the same API under /api,
 * so this is only needed to run the API as its own service (`npm run api:dev`).
 * A future `main.bun.ts` would be `export default { port, fetch: runtime.app.fetch }`.
 */
import { serve } from '@hono/node-server'
import { createRuntime } from './runtime'

const port = Number(process.env.PORT ?? 4000)
const runtime = await createRuntime()

const server = serve({ fetch: runtime.app.fetch, port, hostname: process.env.HOSTNAME ?? '127.0.0.1' }, (info) => {
  console.log(`[kaligula-api] ${runtime.database.engine} · http://${info.address}:${info.port}/api`)
})

const shutdown = () => {
  server.close()
  void runtime.close().finally(() => process.exit(0))
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
