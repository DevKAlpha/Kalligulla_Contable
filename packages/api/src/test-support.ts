import { migrate, openDatabase, type DatabaseHandle } from '@kaligula/db'
import { vi } from 'vitest'
import { createApp, type AppDependencies } from './app'
import type { FxProvider, FxReading } from './modules/market-data/domain/fx-provider'
import type { CryptoAsset, CryptoMarketProvider, PriceHistory, PriceHistoryProvider } from './modules/market-data/domain/movers-providers'
import type { TrmProvider, TrmReading } from './modules/market-data/domain/trm-provider'

export const TRM_READING: TrmReading = {
  rate: 3316.7, currency: 'COP', base: 'USD', validFrom: '2026-11-14', validTo: '2026-11-17', source: 'test',
}

export const FX_READING: FxReading = {
  quotes: [
    { currency: 'USD', copPerUnit: 3317.52, changePct: -0.07, asOf: '2026-11-16T19:54:31.000Z' },
    { currency: 'EUR', copPerUnit: 3650.1, changePct: -0.27, asOf: '2026-11-16T19:54:31.000Z' },
    { currency: 'KRW', copPerUnit: 2.48, changePct: -0.02, asOf: '2026-11-16T19:54:31.000Z' },
  ],
  source: { name: 'test', url: 'https://example.com', cadence: 'intraday' },
}

export function fakeTrmProvider(impl: () => Promise<TrmReading> = async () => TRM_READING): TrmProvider {
  return { name: 'fake-trm', latest: vi.fn(impl) }
}

export function fakeFxProvider(impl: () => Promise<FxReading> = async () => FX_READING): FxProvider {
  return { name: 'fake-fx', latest: vi.fn(impl) }
}

const DAY = 86_400_000
/** Daily closes for 40 days ending 2026-11-16, growing by `step` per day. */
export function history(symbol: string, start: number, step: number): PriceHistory {
  const end = Date.UTC(2026, 10, 16)
  const points = Array.from({ length: 40 }, (_, index) => ({ time: end - (39 - index) * DAY, close: start + step * index }))
  return { symbol, name: `${symbol} Inc.`, price: points[39].close, priceTime: end, points }
}

export function fakePriceHistoryProvider(impl?: (symbols: readonly string[]) => Promise<Map<string, PriceHistory>>): PriceHistoryProvider {
  return {
    source: { name: 'fake-prices', url: 'https://example.com', official: false, realtime: false, note: 'test' },
    refreshMs: 15 * 60_000,
    history: vi.fn(impl ?? (async (symbols: readonly string[]) => new Map<string, PriceHistory>(symbols.map((symbol, index) => [symbol, history(symbol, 100, (index % 7) - 3)])))),
  }
}

export function fakeCryptoProvider(impl?: (category: string) => Promise<CryptoAsset[]>): CryptoMarketProvider {
  return {
    source: { name: 'fake-crypto', url: 'https://example.com', official: true, realtime: false, note: 'test' },
    byCategory: vi.fn(impl ?? (async (category) => [
      { symbol: 'BTC', name: 'Bitcoin', priceUsd: 61_000, change30dPct: -24.5, change7dPct: -3 },
      { symbol: `${category.slice(0, 3).toUpperCase()}X`, name: 'Alpha', priceUsd: 2, change30dPct: 12, change7dPct: 4 },
      { symbol: 'NUL', name: 'No data', priceUsd: 1.5, change30dPct: null, change7dPct: null },
    ])),
  }
}

export interface TestApp {
  database: DatabaseHandle
  /** Data owner used by the next requests. Tests isolate themselves by switching to a fresh owner. */
  useOwner(owner: string): void
  request(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>
  json<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }>
  close(): Promise<void>
}

/**
 * API backed by an in-memory PGlite database. Every row is scoped by owner, so tests share one
 * database (fast) and isolate themselves with `useOwner(randomUUID())`.
 */
export async function createTestApp(overrides: Partial<AppDependencies> = {}): Promise<TestApp> {
  const database = await openDatabase()
  await migrate(database.db)
  let owner = 'local'
  const { app, shutdown } = createApp({
    database,
    trmProvider: fakeTrmProvider(),
    fxProvider: fakeFxProvider(),
    priceHistoryProvider: fakePriceHistoryProvider(),
    cryptoMarketProvider: fakeCryptoProvider(),
    clock: () => new Date('2026-11-16T15:00:00.000Z'),
    ownerResolver: () => owner,
    ...overrides,
  })

  const request = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, {
      method,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  return {
    database,
    useOwner(next) {
      owner = next
    },
    request,
    async json(method, path, body) {
      const response = await request(method, path, body)
      const text = await response.text()
      return { status: response.status, body: text ? JSON.parse(text) : undefined }
    },
    async close() {
      shutdown()
      await database.close()
    },
  }
}
