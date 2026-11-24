import { describe, expect, it, vi } from 'vitest'
import { UpstreamUnavailableError } from './modules/market-data/domain/trm-provider'
import { createAlpacaPriceHistoryProvider } from './modules/market-data/infrastructure/alpaca-provider'
import { createYahooPriceHistoryProvider } from './modules/market-data/infrastructure/movers-providers'
import { createPriceHistoryProvider } from './runtime'

const NOW = new Date('2026-11-23T16:00:00Z')

function bars(closes: number[]) {
  return closes.map((close, index) => ({ t: new Date(Date.UTC(2026, 9, 10 + index)).toISOString(), o: close, h: close, l: close, c: close, v: 100 }))
}

type Call = { url: URL; headers: Record<string, string> }

function alpacaFetch(handler: (url: URL) => Response) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url, headers: init?.headers as Record<string, string> })
    return handler(url)
  }) as unknown as typeof fetch
  return { fetchMock, calls }
}

describe('Alpaca provider', () => {
  it('combines consolidated daily closes with the live IEX trade', async () => {
    const { fetchMock, calls } = alpacaFetch((url) => {
      if (url.pathname === '/v2/stocks/bars') {
        // Two pages: the token is followed until exhausted.
        return url.searchParams.get('page_token')
          ? Response.json({ bars: { MSFT: bars([400, 410, 420]) }, next_page_token: null })
          : Response.json({ bars: { AAPL: bars([100, 105, 110]), 'BRK.B': bars([500]) }, next_page_token: 'next' })
      }
      return Response.json({
        AAPL: { latestTrade: { t: '2026-11-23T15:59:58.123456789Z', p: 112.5 }, dailyBar: null, prevDailyBar: null },
        MSFT: { latestTrade: null, dailyBar: null, prevDailyBar: null },
        'BRK.B': { latestTrade: { t: '2026-11-23T15:59:00Z', p: 501 } },
      })
    })
    const provider = createAlpacaPriceHistoryProvider({ keyId: 'id', secretKey: 'secret', fetch: fetchMock, clock: () => NOW })
    const result = await provider.history(['AAPL', 'MSFT', 'BRK.B'])

    expect(provider.source).toMatchObject({ official: true, realtime: true })
    expect(result.get('AAPL')).toMatchObject({ price: 112.5, priceTime: Date.parse('2026-11-23T15:59:58.123Z') })
    expect(result.get('AAPL')!.points.map((point) => point.close)).toEqual([100, 105, 110])
    expect(result.get('MSFT')).toMatchObject({ price: 420, priceTime: null })
    expect(result.has('BRK.B')).toBe(false) // a single close cannot give a 30-day return

    const barsCall = calls.find((call) => call.url.pathname === '/v2/stocks/bars')!
    expect(barsCall.headers['APCA-API-KEY-ID']).toBe('id')
    expect(barsCall.headers['APCA-API-SECRET-KEY']).toBe('secret')
    expect(barsCall.url.searchParams.get('feed')).toBe('sip')
    expect(barsCall.url.searchParams.get('symbols')).toBe('AAPL,MSFT,BRK.B')
    // The newest 15 minutes of SIP data are off-limits on the free plan.
    expect(barsCall.url.searchParams.get('end')).toBe('2026-11-23T15:44:00Z')
    expect(calls.find((call) => call.url.pathname === '/v2/stocks/snapshots')!.url.searchParams.get('feed')).toBe('iex')
    expect(calls.filter((call) => call.url.pathname === '/v2/stocks/bars')).toHaveLength(2)
  })

  it('falls back to IEX bars when the plan refuses consolidated data', async () => {
    const { fetchMock, calls } = alpacaFetch((url) => {
      if (url.pathname === '/v2/stocks/bars') {
        return url.searchParams.get('feed') === 'sip'
          ? new Response('{"message":"subscription does not permit querying recent SIP data"}', { status: 403 })
          : Response.json({ bars: { SPY: bars([600, 610]) }, next_page_token: null })
      }
      return Response.json({ SPY: { latestTrade: { t: '2026-11-23T15:59:00Z', p: 612 } } })
    })
    const provider = createAlpacaPriceHistoryProvider({ keyId: 'id', secretKey: 'secret', fetch: fetchMock, clock: () => NOW })
    expect((await provider.history(['SPY'])).get('SPY')).toMatchObject({ price: 612 })
    expect(calls.filter((call) => call.url.pathname === '/v2/stocks/bars').map((call) => call.url.searchParams.get('feed'))).toEqual(['sip', 'iex'])
  })

  it('reports invalid credentials clearly', async () => {
    const { fetchMock } = alpacaFetch(() => new Response('Unauthorized', { status: 401 }))
    const provider = createAlpacaPriceHistoryProvider({ keyId: 'bad', secretKey: 'bad', fetch: fetchMock })
    await expect(provider.history(['AAPL'])).rejects.toThrow(/ALPACA_API_KEY_ID/)
    await expect(provider.history(['AAPL'])).rejects.toBeInstanceOf(UpstreamUnavailableError)
  })
})

describe('provider selection', () => {
  it('uses Alpaca only when both free keys are configured', () => {
    expect(createPriceHistoryProvider({ ALPACA_API_KEY_ID: 'id', ALPACA_API_SECRET_KEY: 'secret' }).source.name).toBe('Alpaca Markets')
    expect(createPriceHistoryProvider({ ALPACA_API_KEY_ID: 'id' }).source).toMatchObject({ name: 'Yahoo Finance', official: false })
    expect(createPriceHistoryProvider({}).source.realtime).toBe(false)
  })

  it('translates share-class symbols for Yahoo', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).searchParams.get('symbols')).toBe('BRK-B')
      return Response.json({
        spark: { result: [{ symbol: 'BRK-B', response: [{ meta: { regularMarketPrice: 500, regularMarketTime: 1_795_000_000 }, timestamp: [1, 2], indicators: { quote: [{ close: [490, 495] }] } }] }] },
      })
    }) as unknown as typeof fetch
    const result = await createYahooPriceHistoryProvider({ fetch: fetchMock }).history(['BRK.B'])
    expect(result.get('BRK.B')).toMatchObject({ price: 500, priceTime: 1_795_000_000_000 })
  })
})
