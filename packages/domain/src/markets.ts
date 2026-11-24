/**
 * Curated market universe for the "best performers" ranking. Rankings are computed
 * inside each niche's list, so the result is "the best of these leaders", not the whole market.
 * Edit these lists to change what Kaligula watches.
 */

export const ASSET_CLASSES = ['stocks', 'etfs', 'crypto'] as const
export type AssetClass = (typeof ASSET_CLASSES)[number]

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  stocks: 'Acciones',
  etfs: 'ETF',
  crypto: 'Cripto',
}

export interface SymbolNiche {
  id: string
  label: string
  symbols: readonly string[]
}

export interface CryptoNiche {
  id: string
  label: string
  /** CoinGecko category id. */
  category: string
}

export const STOCK_NICHES: readonly SymbolNiche[] = [
  { id: 'tecnologia', label: 'Tecnología', symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ORCL', 'AMD', 'CRM', 'ADBE'] },
  { id: 'salud', label: 'Salud', symbols: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO', 'ISRG', 'AMGN'] },
  { id: 'finanzas', label: 'Finanzas', symbols: ['JPM', 'BAC', 'V', 'MA', 'GS', 'MS', 'WFC', 'BRK-B', 'AXP'] },
  { id: 'energia', label: 'Energía', symbols: ['XOM', 'CVX', 'COP', 'SLB', 'OXY', 'EOG', 'PSX'] },
  { id: 'consumo', label: 'Consumo', symbols: ['AMZN', 'TSLA', 'WMT', 'COST', 'KO', 'PG', 'MCD', 'NKE', 'HD'] },
  { id: 'colombia', label: 'Colombia', symbols: ['EC', 'CIB', 'AVAL', 'TGLS'] },
]

export const ETF_NICHES: readonly SymbolNiche[] = [
  { id: 'indices', label: 'Índices', symbols: ['SPY', 'QQQ', 'DIA', 'IWM', 'VT', 'VWO', 'EFA'] },
  { id: 'sectores', label: 'Sectores', symbols: ['XLK', 'XLE', 'XLF', 'XLV', 'XLY', 'XLI', 'XLU', 'XLP', 'XLB', 'XLRE', 'XLC'] },
  { id: 'tematicos', label: 'Temáticos', symbols: ['SMH', 'ARKK', 'ICLN', 'TAN', 'BOTZ', 'URA', 'LIT', 'CIBR'] },
  { id: 'refugio', label: 'Materias primas y bonos', symbols: ['GLD', 'SLV', 'USO', 'TLT', 'AGG', 'HYG'] },
  { id: 'latam', label: 'Latinoamérica', symbols: ['ILF', 'EWZ', 'EWW', 'ECH'] },
]

export const CRYPTO_NICHES: readonly CryptoNiche[] = [
  { id: 'capa-1', label: 'Capa 1', category: 'layer-1' },
  { id: 'defi', label: 'DeFi', category: 'decentralized-finance-defi' },
  { id: 'ia', label: 'Inteligencia artificial', category: 'artificial-intelligence' },
  { id: 'memes', label: 'Memes', category: 'meme-token' },
]

/** Days covered by the performance ranking. */
export const PERFORMANCE_DAYS = 30

export interface PricePoint {
  /** Unix time in milliseconds. */
  time: number
  close: number
}

/**
 * Return over the last `days` days: latest price against the last close on or before the start date.
 * Uses the first available close when the history is shorter. `null` without enough data.
 */
export function periodReturn(points: readonly PricePoint[], latestPrice?: number, days = PERFORMANCE_DAYS): { changePct: number; start: number; end: number } | null {
  const valid = points.filter((point) => Number.isFinite(point.close) && point.close > 0).sort((a, b) => a.time - b.time)
  const hasLatest = latestPrice !== undefined && Number.isFinite(latestPrice) && latestPrice > 0
  // One close and no live price: there is nothing to compare.
  if (valid.length === 0 || (valid.length === 1 && !hasLatest)) return null
  const last = valid[valid.length - 1]
  const end = hasLatest ? latestPrice : last.close
  const startTime = last.time - days * 86_400_000
  const before = valid.filter((point) => point.time <= startTime)
  const start = (before.length ? before[before.length - 1] : valid[0]).close
  return { changePct: ((end - start) / start) * 100, start, end }
}

/** Points inside the performance window, for a sparkline. */
export function windowPoints(points: readonly PricePoint[], days = PERFORMANCE_DAYS): number[] {
  const valid = points.filter((point) => Number.isFinite(point.close) && point.close > 0).sort((a, b) => a.time - b.time)
  if (valid.length === 0) return []
  const startTime = valid[valid.length - 1].time - days * 86_400_000
  const startIndex = Math.max(0, valid.findIndex((point) => point.time > startTime) - 1)
  return valid.slice(startIndex).map((point) => point.close)
}

/** Highest return first; ties keep the original order. */
export function rankByReturn<T extends { changePct: number }>(items: readonly T[], limit?: number): T[] {
  const sorted = [...items].sort((a, b) => b.changePct - a.changePct)
  return limit ? sorted.slice(0, limit) : sorted
}
