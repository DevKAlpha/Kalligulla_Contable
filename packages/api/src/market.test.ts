import { fxSnapshotSchema, healthSchema, trmQuoteSchema } from '@kaligula/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFxTicker } from './modules/market-data/application/fx-ticker'
import { UpstreamUnavailableError } from './modules/market-data/domain/trm-provider'
import { createDatosGovTrmProvider } from './modules/market-data/infrastructure/datos-gov-trm-provider'
import { createAwesomeApiFxProvider, createErApiFxProvider, createFallbackFxProvider } from './modules/market-data/infrastructure/fx-providers'
import { createTestApp, fakeFxProvider, fakeTrmProvider, FX_READING, TRM_READING, type TestApp } from './test-support'

let api: TestApp | undefined

afterEach(async () => {
  await api?.close()
  api = undefined
  vi.useRealTimers()
})

const asFetch = (impl: (url: string) => Response | Promise<Response>) =>
  vi.fn(async (input: RequestInfo | URL) => impl(String(input))) as unknown as typeof fetch

describe('health', () => {
  it('reports database status', async () => {
    api = await createTestApp()
    const response = await api.json('GET', '/api/health')
    expect(response.status).toBe(200)
    expect(healthSchema.parse(response.body)).toMatchObject({ status: 'ok', database: { status: 'ok', engine: 'pglite' } })
  })
})

describe('TRM', () => {
  it('serves the TRM and caches it within the TTL', async () => {
    const provider = fakeTrmProvider()
    api = await createTestApp({ trmProvider: provider })
    const first = await api.json('GET', '/api/market/trm')
    await api.json('GET', '/api/market/trm')
    expect(trmQuoteSchema.parse(first.body)).toMatchObject({ rate: 3316.7, stale: false })
    expect(provider.latest).toHaveBeenCalledTimes(1)
  })

  it('falls back to the last good TRM, and answers 503 when nothing is cached', async () => {
    let now = new Date('2026-11-15T12:00:00Z')
    let fail = false
    api = await createTestApp({
      trmProvider: fakeTrmProvider(async () => {
        if (fail) throw new UpstreamUnavailableError('down')
        return TRM_READING
      }),
      clock: () => now,
      trmTtlMs: 1000,
    })
    await api.json('GET', '/api/market/trm')
    fail = true
    now = new Date('2026-11-15T13:00:00Z')
    expect((await api.json('GET', '/api/market/trm')).body).toMatchObject({ stale: true })

    const empty = await createTestApp({ trmProvider: fakeTrmProvider(async () => { throw new UpstreamUnavailableError('down') }) })
    expect((await empty.json('GET', '/api/market/trm')).status).toBe(503)
    await empty.close()
  })

  it('maps the datos.gov.co row', async () => {
    const provider = createDatosGovTrmProvider({
      fetch: asFetch(() => Response.json([{ valor: '3316.7', unidad: 'COP', vigenciadesde: '2026-11-14T00:00:00.000', vigenciahasta: '2026-11-17T00:00:00.000' }])),
    })
    await expect(provider.latest()).resolves.toMatchObject({ rate: 3316.7, validFrom: '2026-11-14', validTo: '2026-11-17' })
  })
})

describe('FX providers', () => {
  const awesome = {
    USDCOP: { bid: '3315.77', ask: '3319.27', pctChange: '-0.074437', timestamp: '1794858871' },
    USDEUR: { bid: '0.9087', ask: '0.9089', pctChange: '0.194061', timestamp: '1794859000' },
    USDKRW: { bid: '1334.26', ask: '1336.26', pctChange: '-0.055431', timestamp: '1794859006' },
  }

  it('prices EUR and KRW through the USD legs (AwesomeAPI)', async () => {
    const fetchMock = asFetch(() => Response.json(awesome))
    const provider = createAwesomeApiFxProvider({ fetch: fetchMock, apiKey: 'k' })
    const reading = await provider.latest(['USD', 'EUR', 'KRW'])
    const [usd, eur, krw] = reading.quotes
    expect(String((fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])).toContain('USD-COP,USD-EUR,USD-KRW')
    expect(usd.copPerUnit).toBeCloseTo(3317.52, 2)
    expect(eur.copPerUnit).toBeCloseTo(3317.52 / 0.9088, 2)
    expect(krw.copPerUnit).toBeCloseTo(3317.52 / 1335.26, 4)
    expect(eur.changePct).toBeCloseTo(((1 - 0.00074437) / (1 + 0.00194061) - 1) * 100, 6)
    expect(eur.asOf).toBe(new Date(1794858871 * 1000).toISOString())
    expect(reading.source.cadence).toBe('intraday')
  })

  it('uses daily rates as a fallback (ExchangeRate-API)', async () => {
    const failing = createAwesomeApiFxProvider({ fetch: asFetch(() => new Response('busy', { status: 429 })) })
    const daily = createErApiFxProvider({
      fetch: asFetch(() => Response.json({ result: 'success', time_last_update_unix: 1794787351, rates: { USD: 1, COP: 3316, EUR: 0.908, KRW: 1334.9 } })),
    })
    const reading = await createFallbackFxProvider([failing, daily]).latest(['USD', 'EUR', 'KRW'])
    expect(reading.source).toMatchObject({ name: 'ExchangeRate-API', cadence: 'daily' })
    expect(reading.quotes.map((quote) => Number(quote.copPerUnit.toFixed(4)))).toEqual([3316, Number((3316 / 0.908).toFixed(4)), Number((3316 / 1334.9).toFixed(4))])
    expect(reading.quotes[0].changePct).toBeNull()
  })

  it('rejects malformed payloads', async () => {
    const provider = createAwesomeApiFxProvider({ fetch: asFetch(() => Response.json({ USDCOP: { bid: 'x' } })) })
    await expect(provider.latest(['USD'])).rejects.toBeInstanceOf(UpstreamUnavailableError)
  })
})

describe('FX ticker', () => {
  it('caches readings, polls only while subscribed and serves stale data on failure', async () => {
    vi.useFakeTimers()
    let fail = false
    const provider = fakeFxProvider(async () => {
      if (fail) throw new UpstreamUnavailableError('down')
      return FX_READING
    })
    const ticker = createFxTicker({ provider, refreshMs: 30_000 })
    await ticker.current()
    await ticker.current()
    expect(provider.latest).toHaveBeenCalledTimes(1)

    const received: boolean[] = []
    const unsubscribe = ticker.subscribe((snapshot) => received.push(snapshot.stale))
    await vi.advanceTimersByTimeAsync(30_000)
    fail = true
    await vi.advanceTimersByTimeAsync(30_000)
    expect(received).toEqual([false, true])

    unsubscribe()
    expect(ticker.subscribers).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(provider.latest).toHaveBeenCalledTimes(3)
  })
})

describe('FX HTTP', () => {
  it('serves a snapshot and a live Server-Sent Events stream', async () => {
    api = await createTestApp()
    const snapshot = await api.json('GET', '/api/market/fx')
    expect(fxSnapshotSchema.parse(snapshot.body).quotes.map((quote) => quote.currency)).toEqual(['USD', 'EUR', 'KRW'])

    const response = await api.request('GET', '/api/market/fx/stream')
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const reader = response.body!.getReader()
    const { value } = await reader.read()
    const chunk = new TextDecoder().decode(value)
    expect(chunk).toContain('event: snapshot')
    const data = chunk.split('\n').find((line) => line.startsWith('data: '))!.slice(6)
    expect(fxSnapshotSchema.parse(JSON.parse(data)).base).toBe('COP')
    await reader.cancel()
  })

  it('answers 503 when no source is available', async () => {
    api = await createTestApp({ fxProvider: fakeFxProvider(async () => { throw new UpstreamUnavailableError('down') }) })
    expect((await api.json('GET', '/api/market/fx')).status).toBe(503)
  })
})
