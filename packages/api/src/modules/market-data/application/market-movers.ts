import type { MoverDto, MoversDto } from '@kaligula/contracts'
import {
  CRYPTO_NICHES, ETF_NICHES, PERFORMANCE_DAYS, periodReturn, rankByReturn, STOCK_NICHES, windowPoints,
  type AssetClass, type SymbolNiche,
} from '@kaligula/domain'
import type { CryptoMarketProvider, PriceHistoryProvider } from '../domain/movers-providers'
import { UpstreamUnavailableError } from '../domain/trm-provider'

export interface MarketMoversOptions {
  prices: PriceHistoryProvider
  crypto: CryptoMarketProvider
  clock?: () => Date
  /** How long a ranking is reused before asking the sources again. */
  ttlMs?: Partial<Record<AssetClass, number>>
  perNiche?: number
}

/** Crypto rankings are reused for 10 minutes (CoinGecko's public tier is rate limited). Stocks and ETFs follow their provider. */
const CRYPTO_TTL = 10 * 60_000

/** Coins fetched per CoinGecko category before ranking. */
const CRYPTO_CANDIDATES = 25

/**
 * Use case: best performers of the last 30 days per niche, for stocks, ETFs and crypto.
 * Each class is cached separately; on failure the last ranking is served as `stale`.
 */
export function createMarketMovers({ prices, crypto, clock = () => new Date(), ttlMs = {}, perNiche = 5 }: MarketMoversOptions) {
  type Entry = { value: MoversDto; at: number }
  const cache = new Map<AssetClass, Entry>()
  const inFlight = new Map<AssetClass, Promise<MoversDto>>()

  async function symbolMovers(assetClass: 'stocks' | 'etfs', niches: readonly SymbolNiche[]): Promise<Omit<MoversDto, 'fetchedAt' | 'stale'>> {
    const symbols = [...new Set(niches.flatMap((niche) => niche.assets.map((asset) => asset.symbol)))]
    const histories = await prices.history(symbols)
    const ranked = niches.map((niche) => {
      const movers = niche.assets.flatMap(({ symbol, name }): MoverDto[] => {
        const history = histories.get(symbol)
        const performance = history ? periodReturn(history.points, history.price) : null
        if (!history || !performance) return []
        return [{
          symbol,
          name,
          niche: niche.label,
          priceUsd: history.price,
          priceTime: history.priceTime ? new Date(history.priceTime).toISOString() : null,
          changePct: performance.changePct,
          change7dPct: null,
          sparkline: [...windowPoints(history.points), history.price],
        }]
      })
      return { id: niche.id, label: niche.label, universe: movers.length, items: rankByReturn(movers, perNiche) }
    })
    if (ranked.every((niche) => niche.universe === 0)) throw new UpstreamUnavailableError('No hay precios disponibles en este momento.')
    return { assetClass, periodDays: PERFORMANCE_DAYS, highlights: highlights(ranked), niches: ranked, source: prices.source }
  }

  async function cryptoMovers(): Promise<Omit<MoversDto, 'fetchedAt' | 'stale'>> {
    const ranked: MoversDto['niches'] = []
    // Sequential on purpose: CoinGecko's public tier allows only a few calls per minute.
    for (const niche of CRYPTO_NICHES) {
      const assets = await crypto.byCategory(niche.category, CRYPTO_CANDIDATES)
      const movers = assets.flatMap((asset): MoverDto[] => (asset.change30dPct === null ? [] : [{
        symbol: asset.symbol,
        name: asset.name,
        niche: niche.label,
        priceUsd: asset.priceUsd,
        priceTime: null,
        changePct: asset.change30dPct,
        change7dPct: asset.change7dPct,
        sparkline: [],
      }]))
      ranked.push({ id: niche.id, label: niche.label, universe: movers.length, items: rankByReturn(movers, perNiche) })
    }
    return { assetClass: 'crypto', periodDays: PERFORMANCE_DAYS, highlights: highlights(ranked), niches: ranked, source: crypto.source }
  }

  /** Best performers across all niches, each asset once. */
  function highlights(niches: MoversDto['niches']): MoverDto[] {
    const unique = new Map<string, MoverDto>()
    for (const niche of niches) for (const item of niche.items) if (!unique.has(item.symbol)) unique.set(item.symbol, item)
    return rankByReturn([...unique.values()], perNiche)
  }

  async function load(assetClass: AssetClass): Promise<MoversDto> {
    const previous = cache.get(assetClass)
    try {
      const ranking = assetClass === 'crypto'
        ? await cryptoMovers()
        : await symbolMovers(assetClass, assetClass === 'stocks' ? STOCK_NICHES : ETF_NICHES)
      const now = clock()
      const value: MoversDto = { ...ranking, fetchedAt: now.toISOString(), stale: false }
      cache.set(assetClass, { value, at: now.getTime() })
      return value
    } catch (error) {
      if (previous) return { ...previous.value, stale: true }
      throw error
    }
  }

  return {
    get(assetClass: AssetClass): Promise<MoversDto> {
      const cached = cache.get(assetClass)
      const ttl = ttlMs[assetClass] ?? (assetClass === 'crypto' ? CRYPTO_TTL : prices.refreshMs)
      if (cached && clock().getTime() - cached.at < ttl) return Promise.resolve(cached.value)
      let pending = inFlight.get(assetClass)
      if (!pending) {
        pending = load(assetClass).finally(() => inFlight.delete(assetClass))
        inFlight.set(assetClass, pending)
      }
      return pending
    },
  }
}

export type MarketMovers = ReturnType<typeof createMarketMovers>
