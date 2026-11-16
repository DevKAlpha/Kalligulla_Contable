import { trmQuoteSchema } from '@kaligula/contracts'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app'
import { UpstreamUnavailableError, type TrmProvider } from './modules/market-data/domain/trm-provider'
import { createDatosGovTrmProvider } from './modules/market-data/infrastructure/datos-gov-trm-provider'

const reading = {
  rate: 3316.7, currency: 'COP', base: 'USD', validFrom: '2026-11-14', validTo: '2026-11-17', source: 'test',
} as const

function fakeProvider(impl: () => Promise<typeof reading>): TrmProvider {
  return { name: 'fake', latest: vi.fn(impl) }
}

describe('api', () => {
  it('reports health', async () => {
    const app = createApp({ trmProvider: fakeProvider(async () => reading), clock: () => new Date('2026-11-15T12:00:00Z') })
    const response = await app.request('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', time: '2026-11-15T12:00:00.000Z' })
  })

  it('serves the TRM and caches it within the TTL', async () => {
    const provider = fakeProvider(async () => reading)
    const app = createApp({ trmProvider: provider })
    const first = await app.request('/api/market/trm')
    await app.request('/api/market/trm')
    expect(first.status).toBe(200)
    expect(trmQuoteSchema.parse(await first.json())).toMatchObject({ rate: 3316.7, stale: false })
    expect(provider.latest).toHaveBeenCalledTimes(1)
  })

  it('falls back to the last good TRM when upstream fails', async () => {
    let now = new Date('2026-11-15T12:00:00Z')
    let fail = false
    const provider = fakeProvider(async () => {
      if (fail) throw new UpstreamUnavailableError('down')
      return reading
    })
    const app = createApp({ trmProvider: provider, clock: () => now, trmTtlMs: 1000 })
    await app.request('/api/market/trm')
    fail = true
    now = new Date('2026-11-15T13:00:00Z')
    const response = await app.request('/api/market/trm')
    expect(await response.json()).toMatchObject({ rate: 3316.7, stale: true })
  })

  it('returns 503 when upstream fails and nothing is cached', async () => {
    const app = createApp({ trmProvider: fakeProvider(async () => { throw new UpstreamUnavailableError('down') }) })
    const response = await app.request('/api/market/trm')
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: { code: 'upstream_unavailable' } })
  })

  it('returns JSON 404 for unknown routes', async () => {
    const app = createApp({ trmProvider: fakeProvider(async () => reading) })
    expect((await app.request('/api/nope')).status).toBe(404)
  })
})

describe('datos.gov.co adapter', () => {
  it('maps the Socrata row', async () => {
    const fetchMock = vi.fn(async () => Response.json([
      { valor: '3316.7', unidad: 'COP', vigenciadesde: '2026-11-14T00:00:00.000', vigenciahasta: '2026-11-17T00:00:00.000' },
    ]))
    const provider = createDatosGovTrmProvider({ fetch: fetchMock as unknown as typeof fetch })
    await expect(provider.latest()).resolves.toMatchObject({ rate: 3316.7, validFrom: '2026-11-14', validTo: '2026-11-17' })
  })

  it('rejects unexpected payloads', async () => {
    const provider = createDatosGovTrmProvider({ fetch: (async () => Response.json({ nope: true })) as unknown as typeof fetch })
    await expect(provider.latest()).rejects.toBeInstanceOf(UpstreamUnavailableError)
  })
})
