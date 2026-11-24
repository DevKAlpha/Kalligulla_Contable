import { z } from 'zod'
import type { PriceHistory, PriceHistoryProvider } from '../domain/movers-providers'
import { UpstreamUnavailableError } from '../domain/trm-provider'

/*
 * Alpaca Market Data API (official, regulated US broker). Free "Basic" plan:
 * - live prices from the IEX exchange (`feed=iex`): real trades, in real time;
 * - historical bars from the consolidated tape (`feed=sip`), except the latest 15 minutes.
 * Docs: https://docs.alpaca.markets/docs/about-market-data-api
 */

export interface AlpacaOptions {
  keyId: string
  secretKey: string
  /** Market data base URL. */
  dataUrl?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  clock?: () => Date
}

const bar = z.object({ t: z.string(), c: z.number() })
const barsResponse = z.object({
  bars: z.record(z.string(), z.array(bar)).nullable(),
  next_page_token: z.string().nullable().optional(),
})
const snapshot = z.object({
  latestTrade: z.object({ t: z.string(), p: z.number() }).nullable().optional(),
  dailyBar: bar.nullable().optional(),
  prevDailyBar: bar.nullable().optional(),
}).nullable()
const snapshotsResponse = z.record(z.string(), snapshot)

/** Free plans cannot query the newest 15 minutes of consolidated (SIP) data. */
const SIP_EMBARGO_MS = 16 * 60_000
/** Enough calendar days to cover 30 days plus weekends and holidays. */
const HISTORY_DAYS = 50
const SYMBOLS_PER_CALL = 100

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
  }
}

/** RFC-3339 without fractional seconds (Alpaca rejects them). */
const rfc3339 = (date: Date) => `${date.toISOString().slice(0, 19)}Z`

export function createAlpacaPriceHistoryProvider(options: AlpacaOptions): PriceHistoryProvider {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const dataUrl = (options.dataUrl ?? 'https://data.alpaca.markets').replace(/\/$/, '')
  const timeoutMs = options.timeoutMs ?? 10_000
  const clock = options.clock ?? (() => new Date())
  const headers = {
    accept: 'application/json',
    'APCA-API-KEY-ID': options.keyId,
    'APCA-API-SECRET-KEY': options.secretKey,
  }

  async function get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = `${dataUrl}${path}?${new URLSearchParams(params)}`
    let response: Response
    try {
      response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    } catch (error) {
      throw new UpstreamUnavailableError('No fue posible conectar con Alpaca.', { cause: error })
    }
    if (response.status === 401 || response.status === 403) throw new HttpStatusError(response.status)
    if (!response.ok) throw new UpstreamUnavailableError(`Alpaca respondió HTTP ${response.status}.`)
    return response.json()
  }

  /** Daily closes, following pagination. Prefers the consolidated tape; falls back to IEX if the plan refuses SIP. */
  async function dailyBars(symbols: readonly string[], feed: 'sip' | 'iex'): Promise<Map<string, { time: number; close: number }[]>> {
    const now = clock()
    const result = new Map<string, { time: number; close: number }[]>()
    let pageToken: string | undefined
    do {
      const params: Record<string, string> = {
        symbols: symbols.join(','),
        timeframe: '1Day',
        start: rfc3339(new Date(now.getTime() - HISTORY_DAYS * 86_400_000)),
        limit: '10000',
        adjustment: 'all',
        feed,
      }
      if (feed === 'sip') params.end = rfc3339(new Date(now.getTime() - SIP_EMBARGO_MS))
      if (pageToken) params.page_token = pageToken
      const parsed = barsResponse.safeParse(await get('/v2/stocks/bars', params))
      if (!parsed.success) throw new UpstreamUnavailableError('Formato de barras de Alpaca inesperado.')
      for (const [symbol, list] of Object.entries(parsed.data.bars ?? {})) {
        const points = result.get(symbol) ?? []
        points.push(...list.map((item) => ({ time: Date.parse(item.t), close: item.c })))
        result.set(symbol, points)
      }
      pageToken = parsed.data.next_page_token ?? undefined
    } while (pageToken)
    return result
  }

  async function barsWithFallback(symbols: readonly string[]) {
    try {
      return await dailyBars(symbols, 'sip')
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 403) return dailyBars(symbols, 'iex')
      throw error
    }
  }

  return {
    source: {
      name: 'Alpaca Markets',
      url: 'https://alpaca.markets/data',
      official: true,
      realtime: true,
      note: 'Precio en vivo de la bolsa IEX; cierres históricos del consolidado de EE. UU.',
    },
    refreshMs: 60_000,
    async history(symbols) {
      const found = new Map<string, PriceHistory>()
      try {
        for (let index = 0; index < symbols.length; index += SYMBOLS_PER_CALL) {
          const batch = symbols.slice(index, index + SYMBOLS_PER_CALL)
          const [bars, snapshotsBody] = await Promise.all([
            barsWithFallback(batch),
            get('/v2/stocks/snapshots', { symbols: batch.join(','), feed: 'iex' }),
          ])
          const snapshots = snapshotsResponse.safeParse(snapshotsBody)
          if (!snapshots.success) throw new UpstreamUnavailableError('Formato de cotizaciones de Alpaca inesperado.')
          for (const symbol of batch) {
            const points = (bars.get(symbol) ?? []).filter((point) => Number.isFinite(point.time) && point.close > 0)
            const live = snapshots.data[symbol]?.latestTrade
            const price = live && live.p > 0 ? live.p : points[points.length - 1]?.close
            if (!price || points.length < 2) continue
            found.set(symbol, { symbol, price, priceTime: live ? Date.parse(live.t) : null, points })
          }
        }
      } catch (error) {
        if (error instanceof HttpStatusError) {
          throw new UpstreamUnavailableError('Alpaca rechazó las credenciales. Revisa ALPACA_API_KEY_ID y ALPACA_API_SECRET_KEY.')
        }
        throw error
      }
      return found
    },
  }
}
