import path from 'node:path'
import { migrate, openDatabase, type DatabaseHandle } from '@kaligula/db'
import { createApp, type KaligulaApp } from './app'
import { createAwesomeApiFxProvider, createErApiFxProvider, createFallbackFxProvider } from './modules/market-data/infrastructure/fx-providers'
import { createDatosGovTrmProvider } from './modules/market-data/infrastructure/datos-gov-trm-provider'
import type { PriceHistoryProvider } from './modules/market-data/domain/movers-providers'
import { createAlpacaPriceHistoryProvider } from './modules/market-data/infrastructure/alpaca-provider'
import { createCoinGeckoProvider, createYahooPriceHistoryProvider } from './modules/market-data/infrastructure/movers-providers'
import { DEFAULT_ALLOWED_HOSTS } from './shared/security'

export interface Runtime {
  app: KaligulaApp
  database: DatabaseHandle
  close(): Promise<void>
}

type Env = Record<string, string | undefined>

function allowedHosts(env: Env): readonly string[] | '*' {
  const extra = (env.KALIGULA_ALLOWED_HOSTS ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)
  return extra.includes('*') ? '*' : [...DEFAULT_ALLOWED_HOSTS, ...extra]
}

/**
 * Builds the API from environment variables:
 * - DATABASE_URL: PostgreSQL connection string (Docker, servers). Without it, PGlite is used.
 * - KALIGULA_DATA_DIR: folder of the embedded PGlite database (default: ./.data/pglite).
 * - KALIGULA_ALLOWED_HOSTS: extra host names, comma separated ('*' disables the check).
 * - FX_REFRESH_SECONDS: live quote refresh interval (default 60, minimum 15).
 * - AWESOMEAPI_KEY: optional key for higher AwesomeAPI quotas.
 * - COINGECKO_API_KEY: optional CoinGecko demo key for higher rate limits.
 * - ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY: free Alpaca keys for official, real-time stock and ETF prices.
 */
/**
 * Stock and ETF prices: Alpaca (official, real-time IEX trades) when its free keys are configured;
 * otherwise Yahoo Finance's public chart data, which the UI labels as unofficial and possibly delayed.
 */
export function createPriceHistoryProvider(env: Env): PriceHistoryProvider {
  const keyId = env.ALPACA_API_KEY_ID?.trim()
  const secretKey = env.ALPACA_API_SECRET_KEY?.trim()
  if (keyId && secretKey) return createAlpacaPriceHistoryProvider({ keyId, secretKey, dataUrl: env.ALPACA_DATA_URL || undefined })
  return createYahooPriceHistoryProvider()
}

export async function createRuntime(env: Env = process.env): Promise<Runtime> {
  const database = await openDatabase(
    env.DATABASE_URL ? { url: env.DATABASE_URL } : { dataDir: env.KALIGULA_DATA_DIR || path.resolve(process.cwd(), '.data', 'pglite') },
  )
  try {
    await migrate(database.db)
  } catch (error) {
    await database.close().catch(() => undefined)
    throw error
  }
  const { app, shutdown } = createApp({
    database,
    trmProvider: createDatosGovTrmProvider(),
    fxProvider: createFallbackFxProvider([createAwesomeApiFxProvider({ apiKey: env.AWESOMEAPI_KEY }), createErApiFxProvider()]),
    priceHistoryProvider: createPriceHistoryProvider(env),
    cryptoMarketProvider: createCoinGeckoProvider({ apiKey: env.COINGECKO_API_KEY }),
    fxRefreshMs: Math.max(15, Number(env.FX_REFRESH_SECONDS) || 60) * 1000,
    allowedHosts: allowedHosts(env),
  })
  return {
    app,
    database,
    async close() {
      shutdown()
      await database.close()
    },
  }
}

const RUNTIME_KEY = Symbol.for('kaligula.api.runtime')
type GlobalWithRuntime = typeof globalThis & { [RUNTIME_KEY]?: Promise<Runtime> }

/**
 * Process-wide runtime, created on first use. Stored on globalThis so hot reloads in development
 * reuse the same database (an embedded database must never be opened twice). A failed start is retried on the next call.
 */
export function getRuntime(): Promise<Runtime> {
  const store = globalThis as GlobalWithRuntime
  store[RUNTIME_KEY] ??= createRuntime().catch((error) => {
    delete store[RUNTIME_KEY]
    throw error
  })
  return store[RUNTIME_KEY]
}
