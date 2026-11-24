import type { PricePoint } from '@kaligula/domain'

export interface MarketSource {
  name: string
  url: string
  /** False when the source is an undocumented public endpoint rather than an official API. */
  official: boolean
  /** True when the latest price is a live trade (not a delayed or end-of-day value). */
  realtime: boolean
  /** One line telling the user where prices come from. */
  note: string
}

export interface PriceHistory {
  symbol: string
  /** Name reported by the source, when it has one. */
  name?: string
  /** Latest traded price in USD (may be newer than the last daily close). */
  price: number
  /** When `price` was traded (Unix ms), when the source says. */
  priceTime: number | null
  points: PricePoint[]
}

/** Port: daily price history (plus latest price) for stocks and ETFs. */
export interface PriceHistoryProvider {
  readonly source: MarketSource
  /** How often a ranking built from this source should be refreshed. */
  readonly refreshMs: number
  /** Returns the symbols it could load; missing symbols are simply absent from the map. */
  history(symbols: readonly string[]): Promise<Map<string, PriceHistory>>
}

export interface CryptoAsset {
  symbol: string
  name: string
  priceUsd: number
  change30dPct: number | null
  change7dPct: number | null
}

/** Port: crypto assets of a market category, largest first. */
export interface CryptoMarketProvider {
  readonly source: MarketSource
  byCategory(category: string, limit: number): Promise<CryptoAsset[]>
}
