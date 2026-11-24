import type { PricePoint } from '@kaligula/domain'

export interface MarketSource {
  name: string
  url: string
  /** False when the source is an undocumented public endpoint rather than an official API. */
  official: boolean
}

export interface PriceHistory {
  symbol: string
  name: string
  /** Latest traded price in USD (may be newer than the last daily close). */
  price: number
  points: PricePoint[]
}

/** Port: daily price history for stocks and ETFs. */
export interface PriceHistoryProvider {
  readonly source: MarketSource
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
