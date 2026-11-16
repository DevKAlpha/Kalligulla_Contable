import { Hono } from 'hono'
import type { GetLatestTrm } from '../application/get-latest-trm'
import { UpstreamUnavailableError } from '../domain/trm-provider'

export function marketDataRoutes(getLatestTrm: GetLatestTrm) {
  return new Hono().get('/trm', async (c) => {
    try {
      const quote = await getLatestTrm()
      c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
      return c.json(quote)
    } catch (error) {
      if (error instanceof UpstreamUnavailableError) {
        return c.json({ error: { code: 'upstream_unavailable', message: error.message } }, 503)
      }
      throw error
    }
  })
}
