import type { DatabaseHandle } from '@kaligula/db'
import { Hono, type MiddlewareHandler } from 'hono'
import { createBackupModule } from './modules/backup'
import { createGoalsModule } from './modules/goals'
import { healthRoutes } from './modules/health/routes'
import { createOwnerBootstrap, localOwnerResolver, type OwnerResolver } from './modules/identity/owner'
import { createProfileRepository, profileRoutes } from './modules/identity/profile'
import { createDrizzleLedgerRepository } from './modules/ledger/drizzle-ledger-repository'
import { createLedgerService } from './modules/ledger/ledger-service'
import { categoryRoutes, comparisonRoutes, movementRoutes, overviewRoutes } from './modules/ledger/routes'
import { createFxTicker } from './modules/market-data/application/fx-ticker'
import { createGetLatestTrm } from './modules/market-data/application/get-latest-trm'
import { createMarketMovers } from './modules/market-data/application/market-movers'
import type { FxProvider } from './modules/market-data/domain/fx-provider'
import type { CryptoMarketProvider, PriceHistoryProvider } from './modules/market-data/domain/movers-providers'
import type { TrmProvider } from './modules/market-data/domain/trm-provider'
import { marketDataRoutes } from './modules/market-data/http/routes'
import { toErrorResponse } from './shared/errors'
import type { AppEnv } from './shared/http'
import { DEFAULT_ALLOWED_HOSTS, hostGuard, sameOriginWrites } from './shared/security'

export const API_VERSION = '0.4.0'

export interface AppDependencies {
  database: DatabaseHandle
  trmProvider: TrmProvider
  fxProvider: FxProvider
  priceHistoryProvider: PriceHistoryProvider
  cryptoMarketProvider: CryptoMarketProvider
  clock?: () => Date
  ownerResolver?: OwnerResolver
  /** Host names the API answers to, or '*' to disable the check. */
  allowedHosts?: readonly string[] | '*'
  trmTtlMs?: number
  fxRefreshMs?: number
  sseHeartbeatMs?: number
}

/** Routes that read or write the owner's data. */
const OWNER_SCOPES = ['/profile', '/categories', '/movements', '/goals', '/overview', '/comparison', '/backup'] as const

/**
 * Composition root of the HTTP API. Each module receives only its dependencies,
 * so any of them can later move into its own service unchanged.
 * The result is a plain fetch handler: it runs inside Next.js, on Node (`main.node.ts`) or on Bun.
 */
export function createApp(deps: AppDependencies) {
  const clock = deps.clock ?? (() => new Date())
  const { db } = deps.database
  const resolveOwner = deps.ownerResolver ?? localOwnerResolver
  const bootstrapOwner = createOwnerBootstrap(db, clock)
  const fxTicker = createFxTicker({ provider: deps.fxProvider, refreshMs: deps.fxRefreshMs, clock })
  const ledger = createLedgerService({ repository: createDrizzleLedgerRepository(db), clock })

  const app = new Hono<AppEnv>().basePath('/api')
  app.use('*', hostGuard(deps.allowedHosts ?? DEFAULT_ALLOWED_HOSTS))
  app.use('*', sameOriginWrites())

  const withOwner: MiddlewareHandler<AppEnv> = async (c, next) => {
    const owner = resolveOwner(c)
    await bootstrapOwner(owner)
    c.set('owner', owner)
    await next()
  }
  for (const scope of OWNER_SCOPES) {
    app.use(scope, withOwner)
    app.use(`${scope}/*`, withOwner)
  }

  app.route('/health', healthRoutes({ service: 'kaligula-api', version: API_VERSION }, deps.database, clock))
  app.route('/market', marketDataRoutes({
    getLatestTrm: createGetLatestTrm({ provider: deps.trmProvider, clock, ttlMs: deps.trmTtlMs }),
    fxTicker,
    marketMovers: createMarketMovers({ prices: deps.priceHistoryProvider, crypto: deps.cryptoMarketProvider, clock }),
    heartbeatMs: deps.sseHeartbeatMs,
  }))
  app.route('/profile', profileRoutes(createProfileRepository(db), clock))
  app.route('/categories', categoryRoutes(ledger))
  app.route('/movements', movementRoutes(ledger))
  app.route('/overview', overviewRoutes(ledger))
  app.route('/comparison', comparisonRoutes(ledger))
  app.route('/goals', createGoalsModule(db, clock))
  app.route('/backup', createBackupModule(db, clock))

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Recurso no encontrado.' } }, 404))
  app.onError((error, c) => {
    const { status, body } = toErrorResponse(error)
    if (status >= 500) console.error('[kaligula-api]', error)
    return c.json(body, status)
  })

  return {
    app,
    /** Stops background work (live quote polling). */
    shutdown: () => fxTicker.stop(),
  }
}

export type KaligulaApp = ReturnType<typeof createApp>['app']
