import { createDefaultApp } from '@kaligula/api'

/**
 * Next.js hosts the Hono API under /api. The same app can run on its own
 * (`packages/api/src/main.node.ts`) when it becomes a separate service.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const app = createDefaultApp()
const handler = (request: Request) => app.fetch(request)

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }
