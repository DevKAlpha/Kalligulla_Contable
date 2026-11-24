import { comparisonSchema, moversSchema, type CategoryDto, type ComparisonDto, type MoversDto } from '@kaligula/contracts'
import { CRYPTO_NICHES, STOCK_NICHES } from '@kaligula/domain'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMarketMovers } from './modules/market-data/application/market-movers'
import { UpstreamUnavailableError } from './modules/market-data/domain/trm-provider'
import { createCoinGeckoProvider, createYahooPriceHistoryProvider } from './modules/market-data/infrastructure/movers-providers'
import { createTestApp, fakeCryptoProvider, fakePriceHistoryProvider, history, type TestApp } from './test-support'

let api: TestApp

beforeAll(async () => {
  api = await createTestApp() // clock: 2026-11-16
})

beforeEach(() => {
  api.useOwner(globalThis.crypto.randomUUID())
})

afterAll(async () => {
  await api.close()
})

const asFetch = (impl: (url: string) => Response | Promise<Response>) =>
  vi.fn(async (input: RequestInfo | URL) => impl(String(input))) as unknown as typeof fetch

async function categoryId(type: string, name: string): Promise<string> {
  const { body } = await api.json<{ items: CategoryDto[] }>('GET', '/api/categories')
  return body.items.find((category) => category.type === type && category.name === name)!.id
}

describe('month comparison', () => {
  it('compares two months with categories, pace and insights', async () => {
    const hogar = await categoryId('expense', 'Hogar')
    const domicilios = await categoryId('expense', 'Domicilios')
    const salario = await categoryId('income', 'Salario')
    const add = (type: string, categoryId: string, amountMinor: number, occurredOn: string) =>
      api.json('POST', '/api/movements', { type, description: 'x', categoryId, amountMinor, occurredOn })
    await add('expense', hogar, 100_000, '2026-10-02')
    await add('expense', domicilios, 20_000, '2026-10-12')
    await add('income', salario, 500_000, '2026-10-01')
    await add('expense', hogar, 100_000, '2026-11-02')
    await add('expense', domicilios, 35_000, '2026-11-05')
    await add('expense', hogar, 7_000, '2025-11-03')

    const { status, body } = await api.json<ComparisonDto>('GET', '/api/comparison?base=2026-10&target=2026-11')
    expect(status).toBe(200)
    const comparison = comparisonSchema.parse(body)
    expect(comparison.base).toMatchObject({ key: '2026-10', expenseMinor: 120_000, incomeMinor: 500_000 })
    expect(comparison.target).toMatchObject({ key: '2026-11', expenseMinor: 135_000, elapsedDays: 16 })
    expect(comparison.categories.find((row) => row.category === 'Domicilios')).toMatchObject({ deltaMinor: 15_000, deltaPct: 75 })
    expect(comparison.pace).toMatchObject({ compareDay: 16, baseAtDay: 120_000, targetAtDay: 135_000 })
    expect(comparison.insights.map((insight) => insight.kind)).toContain('category_up')
    expect(comparison.range).toEqual({ first: '2025-11-03', last: '2026-11-05' })

    const yearAgo = await api.json<ComparisonDto>('GET', '/api/comparison?base=2025-11&target=2026-11')
    expect(yearAgo.body.base.expenseMinor).toBe(7_000)
  })

  it('works with no data and rejects malformed months', async () => {
    const empty = await api.json<ComparisonDto>('GET', '/api/comparison?base=2026-10&target=2026-11')
    expect(empty.body.categories).toEqual([])
    expect(empty.body.range).toEqual({ first: null, last: null })
    expect((await api.request('GET', '/api/comparison?base=2026-13&target=2026-11')).status).toBe(400)
    expect((await api.request('GET', '/api/comparison?target=2026-11')).status).toBe(400)
  })
})

describe('market movers', () => {
  it('ranks each niche by 30-day return and lists highlights', async () => {
    const { status, body } = await api.json<MoversDto>('GET', '/api/market/movers?class=stocks')
    expect(status).toBe(200)
    const movers = moversSchema.parse(body)
    expect(movers.niches.map((niche) => niche.id)).toEqual(STOCK_NICHES.map((niche) => niche.id))
    for (const niche of movers.niches) {
      const returns = niche.items.map((item) => item.changePct)
      expect(returns).toEqual([...returns].sort((a, b) => b - a))
      expect(niche.items.length).toBeLessThanOrEqual(5)
    }
    expect(movers.highlights[0].changePct).toBeGreaterThan(0)
    expect(movers.highlights[0].sparkline.length).toBeGreaterThan(10)
    expect(movers.source.official).toBe(false)
  })

  it('ranks crypto by category, skipping assets without 30-day data', async () => {
    const movers = moversSchema.parse((await api.json('GET', '/api/market/movers?class=crypto')).body)
    expect(movers.niches).toHaveLength(CRYPTO_NICHES.length)
    expect(movers.niches[0].items.map((item) => item.symbol)).toEqual(['LAYX', 'BTC'])
    expect(movers.niches[0].universe).toBe(2)
    expect(movers.highlights[0]).toMatchObject({ changePct: 12, change7dPct: 4, sparkline: [] })
  })

  it('validates the asset class', async () => {
    expect((await api.request('GET', '/api/market/movers?class=bonds')).status).toBe(400)
  })

  it('caches rankings and serves the last one as stale when sources fail', async () => {
    let now = new Date('2026-11-16T15:00:00Z')
    let fail = false
    const prices = fakePriceHistoryProvider(async (symbols) => {
      if (fail) throw new UpstreamUnavailableError('down')
      return new Map(symbols.map((symbol) => [symbol, history(symbol, 100, 1)]))
    })
    const movers = createMarketMovers({ prices, crypto: fakeCryptoProvider(), clock: () => now })
    await movers.get('etfs')
    await movers.get('etfs')
    expect(prices.history).toHaveBeenCalledTimes(1)
    fail = true
    now = new Date('2026-11-16T16:00:00Z')
    expect((await movers.get('etfs')).stale).toBe(true)

    const empty = createMarketMovers({ prices: fakePriceHistoryProvider(async () => new Map()), crypto: fakeCryptoProvider() })
    await expect(empty.get('stocks')).rejects.toBeInstanceOf(UpstreamUnavailableError)
  })
})

describe('market adapters', () => {
  it('parses Yahoo spark batches of at most 20 symbols', async () => {
    const fetchMock = asFetch((url) => {
      const symbols = new URL(url).searchParams.get('symbols')!.split(',')
      return Response.json({
        spark: {
          result: symbols.map((symbol) => ({
            symbol,
            response: [{
              meta: { regularMarketPrice: 110, longName: `${symbol} Corp.`, currency: 'USD' },
              timestamp: [1_790_000_000, 1_792_000_000, 1_794_000_000],
              indicators: { quote: [{ close: [100, null, 105] }] },
            }],
          })),
        },
      })
    })
    const provider = createYahooPriceHistoryProvider({ fetch: fetchMock })
    const symbols = Array.from({ length: 25 }, (_, index) => `S${index}`)
    const result = await provider.history(symbols)
    expect((fetchMock as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2)
    expect(result.size).toBe(25)
    expect(result.get('S0')).toMatchObject({ name: 'S0 Corp.', price: 110, points: [{ close: 100 }, { close: 105 }] })
  })

  it('fails only when every Yahoo batch fails', async () => {
    const provider = createYahooPriceHistoryProvider({ fetch: asFetch(() => new Response('blocked', { status: 429 })) })
    await expect(provider.history(['AAPL'])).rejects.toBeInstanceOf(UpstreamUnavailableError)
  })

  it('filters wrapped, staked and stable coins from CoinGecko', async () => {
    const coin = (symbol: string, name: string, price: number, change: number | null, cap = 5e9) =>
      ({ symbol, name, current_price: price, market_cap: cap, price_change_percentage_30d_in_currency: change, price_change_percentage_7d_in_currency: 1 })
    const provider = createCoinGeckoProvider({
      fetch: asFetch(() => Response.json([
        coin('eth', 'Ethereum', 3000, -20),
        coin('steth', 'Lido Staked Ether', 3000, -20),
        coin('weth', 'Wrapped Ether', 3000, -20),
        coin('usdt', 'Tether', 1.0001, 0.01),
        coin('sol', 'Solana', 150, 5),
        coin('syrupusdc', 'Syrup USDC', 1.13, 0.4),
        coin('tiny', 'Tiny Pump', 0.01, 230, 3e6),
      ])),
    })
    const assets = await provider.byCategory('layer-1', 25)
    expect(assets.map((asset) => asset.symbol)).toEqual(['ETH', 'SOL'])
  })
})
