import type { FxQuote } from '@kaligula/contracts'
import type { FxCurrency } from '@kaligula/domain'
import { z } from 'zod'
import type { FxProvider, FxReading } from '../domain/fx-provider'
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
    throw new UpstreamUnavailableError('No fue posible consultar las divisas.', { cause: error })
  }
}

const positive = (value: number) => Number.isFinite(value) && value > 0

/* ---------- AwesomeAPI: intraday market quotes ---------- */

const awesomeQuote = z.object({
  bid: z.coerce.number(),
  ask: z.coerce.number(),
  pctChange: z.coerce.number(),
  timestamp: z.coerce.number(),
})

/**
 * Intraday quotes from AwesomeAPI. COP crosses for EUR or KRW are thin at most sources,
 * so every currency is priced through the liquid USD legs: COP per X = (USD→COP) ÷ (USD→X).
 */
export function createAwesomeApiFxProvider(options: HttpOptions & { apiKey?: string; endpoint?: string } = {}): FxProvider {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const endpoint = options.endpoint ?? 'https://economia.awesomeapi.com.br/json/last/'
  const timeoutMs = options.timeoutMs ?? 8_000

  return {
    name: 'AwesomeAPI',
    async latest(currencies): Promise<FxReading> {
      const legs = ['USD-COP', ...currencies.filter((code) => code !== 'USD').map((code) => `USD-${code}`)]
      const body = await getJson(fetchImpl, `${endpoint}${legs.join(',')}`, timeoutMs, options.apiKey ? { 'x-api-key': options.apiKey } : {})
      const parsed = z.record(z.string(), awesomeQuote).safeParse(body)
      if (!parsed.success) throw new UpstreamUnavailableError('La respuesta de divisas no tiene el formato esperado.')

      const leg = (code: string) => {
        const quote = parsed.data[`USD${code}`]
        if (!quote) throw new UpstreamUnavailableError(`La fuente no cotizó USD/${code}.`)
        const mid = positive(quote.ask) && positive(quote.bid) ? (quote.bid + quote.ask) / 2 : quote.bid
        if (!positive(mid) || !positive(quote.timestamp)) throw new UpstreamUnavailableError(`Cotización USD/${code} inválida.`)
        return { mid, change: quote.pctChange / 100, at: quote.timestamp * 1000 }
      }

      const usdCop = leg('COP')
      const quotes = currencies.map((code): FxQuote => {
        if (code === 'USD') {
          return { currency: code, copPerUnit: usdCop.mid, changePct: usdCop.change * 100, asOf: new Date(usdCop.at).toISOString() }
        }
        const usdX = leg(code)
        return {
          currency: code,
          copPerUnit: usdCop.mid / usdX.mid,
          changePct: ((1 + usdCop.change) / (1 + usdX.change) - 1) * 100,
          // A cross is only as fresh as its oldest leg.
          asOf: new Date(Math.min(usdCop.at, usdX.at)).toISOString(),
        }
      })
      return { quotes, source: { name: 'AwesomeAPI', url: 'https://docs.awesomeapi.com.br/api-de-moedas', cadence: 'intraday' } }
    },
  }
}

/* ---------- ExchangeRate-API (open access): daily fallback ---------- */

const erApiResponse = z.object({
  result: z.literal('success'),
  time_last_update_unix: z.number(),
  rates: z.record(z.string(), z.number()),
})

/** Daily reference rates. Used only when the intraday source fails. Attribution to ExchangeRate-API is required. */
export function createErApiFxProvider(options: HttpOptions & { endpoint?: string } = {}): FxProvider {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const endpoint = options.endpoint ?? 'https://open.er-api.com/v6/latest/USD'
  const timeoutMs = options.timeoutMs ?? 8_000

  return {
    name: 'ExchangeRate-API',
    async latest(currencies): Promise<FxReading> {
      const parsed = erApiResponse.safeParse(await getJson(fetchImpl, endpoint, timeoutMs))
      if (!parsed.success) throw new UpstreamUnavailableError('La respuesta de divisas no tiene el formato esperado.')
      const { rates, time_last_update_unix: updated } = parsed.data
      const asOf = new Date(updated * 1000).toISOString()
      const quotes = currencies.map((code: FxCurrency): FxQuote => {
        const copPerUnit = (rates.COP ?? Number.NaN) / (rates[code] ?? Number.NaN)
        if (!positive(copPerUnit)) throw new UpstreamUnavailableError(`La fuente no cotizó ${code}.`)
        return { currency: code, copPerUnit, changePct: null, asOf }
      })
      return { quotes, source: { name: 'ExchangeRate-API', url: 'https://www.exchangerate-api.com', cadence: 'daily' } }
    },
  }
}

/* ---------- Fallback chain ---------- */

/** Tries each provider in order and returns the first successful reading. */
export function createFallbackFxProvider(providers: readonly FxProvider[]): FxProvider {
  return {
    name: providers.map((provider) => provider.name).join(' → '),
    async latest(currencies) {
      let lastError: unknown = new UpstreamUnavailableError('Sin fuentes de divisas configuradas.')
      for (const provider of providers) {
        try {
          return await provider.latest(currencies)
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    },
  }
}
