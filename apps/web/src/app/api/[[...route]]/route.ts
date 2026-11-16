import { getRuntime } from '@kaligula/api'

/**
 * Next.js hosts the Hono API under /api. The same app can run on its own
 * (`packages/api/src/main.node.ts`) when it becomes a separate service.
 * The runtime (database connection + migrations) starts on the first request.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handler(request: Request): Promise<Response> {
  try {
    const { app } = await getRuntime()
    return await app.fetch(request)
  } catch (error) {
    console.error('[kaligula-api] startup failed', error)
    return Response.json(
      { error: { code: 'unavailable', message: 'La base de datos no está disponible. Intenta de nuevo en unos segundos.' } },
      { status: 503 },
    )
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }
