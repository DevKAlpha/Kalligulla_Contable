import { Hono } from 'hono'
import { createGetLatestTrm } from './modules/market-data/application/get-latest-trm'
import type { TrmProvider } from './modules/market-data/domain/trm-provider'
import { createDatosGovTrmProvider } from './modules/market-data/infrastructure/datos-gov-trm-provider'
import { marketDataRoutes } from './modules/market-data/http/routes'
import { healthRoutes } from './modules/health/routes'

export const API_VERSION = '0.3.0'

export interface AppDependencies {
  trmProvider: TrmProvider
  clock?: () => Date
  trmTtlMs?: number
}

/**
 * Composition root of the HTTP API. Modules only receive their dependencies here,
 * so any of them can later be moved into its own service without changes.
 * The app is a plain fetch handler: it runs inside Next.js, on Node (`main.node.ts`) or on Bun.
 */
export function createApp({ trmProvider, clock = () => new Date(), trmTtlMs }: AppDependencies) {
  const app = new Hono().basePath('/api')

  app.route('/health', healthRoutes({ service: 'kaligula-api', version: API_VERSION }, clock))
  app.route('/market', marketDataRoutes(createGetLatestTrm({ provider: trmProvider, clock, ttlMs: trmTtlMs })))

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Recurso no encontrado.' } }, 404))
  app.onError((error, c) => {
    console.error('[kaligula-api]', error)
    return c.json({ error: { code: 'internal_error', message: 'Ocurrió un error inesperado.' } }, 500)
  })

  return app
}

export function createDefaultApp() {
  return createApp({ trmProvider: createDatosGovTrmProvider() })
}

export type KaligulaApp = ReturnType<typeof createApp>
