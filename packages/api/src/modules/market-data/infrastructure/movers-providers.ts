import { z } from 'zod'
import type { CryptoAsset, CryptoMarketProvider, PriceHistory, PriceHistoryProvider } from '../domain/movers-providers'
import { UpstreamUnavailableError } from '../domain/trm-provider'

interface HttpOptions {
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

async function getJson(fetchImpl: typeof globalThis.fetch, url: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<unknown> {
  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    throw new UpstreamUnavailableError('No fue posible consultar los precios del mercado.', { cause: error })
  }
}

/* ---------- Yahoo Finance (stocks and ETFs) ---------- */

const sparkResponse = z.object({
  spark: z.object({
    result: z.array(z.object({
      symbol: z.string(),
      response: z.array(z.object({
        meta: z.object({
          regularMarketPrice: z.number().optional(),
          regularMarketTime: z.number().optional(),
          longName: z.string().optional(),
          shortName: z.string().optional(),
          currency: z.string().optional(),
        }),
        timestamp: z.array(z.number()).optional(),
        indicators: z.object({ quote: z.array(z.object({ close: z.array(z.number().nullable()).optional() })) }),
      })).optional(),
    })).nullable(),
  }),
})

/** Yahoo's batch endpoint accepts at most 20 symbols per call. */
const YAHOO_BATCH = 20

/** Yahoo writes share classes with a dash (`BRK-B`); Kaligula uses the exchange form (`BRK.B`). */
const toYahoo = (symbol: string) => symbol.replace('.', '-')

/**
 * Daily closes from Yahoo Finance's public chart data. It is not an official API:
 * it may change or throttle without notice, so it sits behind a port and the result is cached.
 * Used only when no official provider (Alpaca) is configured.
 */
export function createYahooPriceHistoryProvider(options: HttpOptions & { endpoint?: string } = {}): PriceHistoryProvider {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const endpoint = options.endpoint ?? 'https://query1.finance.yahoo.com/v7/finance/spark'
  const timeoutMs = options.timeoutMs ?? 10_000

  return {
    source: {
      name: 'Yahoo Finance',
      url: 'https://finance.yahoo.com',
      official: false,
      realtime: false,
      note: 'Fuente pública no oficial; puede tener retraso.',
    },
    refreshMs: 15 * 60_000,
    async history(symbols) {
      const canonical = new Map(symbols.map((symbol) => [toYahoo(symbol), symbol]))
      const found = new Map<string, PriceHistory>()
      let failures = 0
      const batches = Math.ceil(symbols.length / YAHOO_BATCH)
      for (let index = 0; index < symbols.length; index += YAHOO_BATCH) {
        const batch = symbols.slice(index, index + YAHOO_BATCH)
        const url = `${endpoint}?symbols=${batch.map((symbol) => encodeURIComponent(toYahoo(symbol))).join(',')}&range=2mo&interval=1d`
        try {
          const parsed = sparkResponse.safeParse(await getJson(fetchImpl, url, timeoutMs, { 'user-agent': 'Mozilla/5.0 (compatible; Kaligula)' }))
          if (!parsed.success) throw new UpstreamUnavailableError('Formato de precios inesperado.')
          for (const result of parsed.data.spark.result ?? []) {
            const data = result.response?.[0]
            if (!data || (data.meta.currency && data.meta.currency !== 'USD')) continue
            const closes = data.indicators.quote[0]?.close ?? []
            const points = (data.timestamp ?? []).flatMap((time, at) => {
              const close = closes[at]
              return close !== null && close !== undefined && close > 0 ? [{ time: time * 1000, close }] : []
            })
            if (points.length < 2) continue
            const symbol = canonical.get(result.symbol) ?? result.symbol
            found.set(symbol, {
              symbol,
              name: data.meta.longName ?? data.meta.shortName,
              price: data.meta.regularMarketPrice && data.meta.regularMarketPrice > 0 ? data.meta.regularMarketPrice : points[points.length - 1].close,
              priceTime: data.meta.regularMarketTime ? data.meta.regularMarketTime * 1000 : null,
              points,
            })
          }
        } catch {
          failures += 1
        }
      }
      if (batches > 0 && failures === batches) throw new UpstreamUnavailableError('No fue posible consultar los precios del mercado.')
      return found
    },
  }
}

/* ---------- CoinGecko (crypto) ---------- */

const coinMarket = z.object({
  symbol: z.string(),
  name: z.string(),
  current_price: z.number().nullable(),
  market_cap: z.number().nullable().optional(),
  price_change_percentage_30d_in_currency: z.number().nullable().optional(),
  price_change_percentage_7d_in_currency: z.number().nullable().optional(),
})

/** Only established assets are ranked: tiny caps can move hundreds of percent on thin trading. */
export const MIN_CRYPTO_MARKET_CAP_USD = 200_000_000

/**
 * Wrapped, staked or bridged tokens mirror another asset; stablecoins and fiat-backed yield tokens are pegged.
 * None of them belongs in a performance ranking.
 */
function isDerivativeOrStable(coin: z.infer<typeof coinMarket>): boolean {
  if (/wrapped|staked|bridged|restak|liquid staking|binance-peg/i.test(coin.name)) return true
  if (/usd|eur|gbp|chf|jpy/i.test(coin.symbol)) return true
  const price = coin.current_price ?? 0
  return price > 0.97 && price < 1.03 && Math.abs(coin.price_change_percentage_30d_in_currency ?? 0) < 1.5
}

/** CoinGecko public API (attribution required). An optional demo key raises the rate limit. */
export function createCoinGeckoProvider(options: HttpOptions & { apiKey?: string; endpoint?: string } = {}): CryptoMarketProvider {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const endpoint = options.endpoint ?? 'https://api.coingecko.com/api/v3/coins/markets'
  const timeoutMs = options.timeoutMs ?? 10_000

  return {
    source: {
      name: 'CoinGecko',
      url: 'https://www.coingecko.com',
      official: true,
      realtime: false,
      note: 'Precios agregados de los principales exchanges; se actualizan cada pocos minutos.',
    },
    async byCategory(category, limit) {
      const url = new URL(endpoint)
      url.search = new URLSearchParams({
        vs_currency: 'usd',
        category,
        order: 'market_cap_desc',
        per_page: String(limit),
        page: '1',
        price_change_percentage: '7d,30d',
        sparkline: 'false',
      }).toString()
      const body = await getJson(fetchImpl, url.toString(), timeoutMs, options.apiKey ? { 'x-cg-demo-api-key': options.apiKey } : {})
      const parsed = z.array(coinMarket).safeParse(body)
      if (!parsed.success) throw new UpstreamUnavailableError('Formato de criptoactivos inesperado.')
      return parsed.data
        .filter((coin) => coin.current_price !== null && coin.current_price > 0 && (coin.market_cap ?? 0) >= MIN_CRYPTO_MARKET_CAP_USD && !isDerivativeOrStable(coin))
        .map((coin): CryptoAsset => ({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          priceUsd: coin.current_price!,
          change30dPct: coin.price_change_percentage_30d_in_currency ?? null,
          change7dPct: coin.price_change_percentage_7d_in_currency ?? null,
        }))
    },
  }
}
