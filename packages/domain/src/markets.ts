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

export interface MarketAsset {
  /** Canonical ticker (exchange style, e.g. `BRK.B`). Adapters translate it to each source's format. */
  symbol: string
  name: string
}

export interface SymbolNiche {
  id: string
  label: string
  assets: readonly MarketAsset[]
}

export interface CryptoNiche {
  id: string
  label: string
  /** CoinGecko category id. */
  category: string
}

const a = (symbol: string, name: string): MarketAsset => ({ symbol, name })

export const STOCK_NICHES: readonly SymbolNiche[] = [
  { id: 'tecnologia', label: 'Tecnología', assets: [
    a('AAPL', 'Apple'), a('MSFT', 'Microsoft'), a('NVDA', 'NVIDIA'), a('GOOGL', 'Alphabet (Google)'), a('META', 'Meta Platforms'),
    a('AVGO', 'Broadcom'), a('ORCL', 'Oracle'), a('AMD', 'AMD'), a('CRM', 'Salesforce'), a('ADBE', 'Adobe'),
  ] },
  { id: 'salud', label: 'Salud', assets: [
    a('LLY', 'Eli Lilly'), a('UNH', 'UnitedHealth'), a('JNJ', 'Johnson & Johnson'), a('ABBV', 'AbbVie'), a('MRK', 'Merck'),
    a('PFE', 'Pfizer'), a('TMO', 'Thermo Fisher'), a('ISRG', 'Intuitive Surgical'), a('AMGN', 'Amgen'),
  ] },
  { id: 'finanzas', label: 'Finanzas', assets: [
    a('JPM', 'JPMorgan Chase'), a('BAC', 'Bank of America'), a('V', 'Visa'), a('MA', 'Mastercard'), a('GS', 'Goldman Sachs'),
    a('MS', 'Morgan Stanley'), a('WFC', 'Wells Fargo'), a('BRK.B', 'Berkshire Hathaway'), a('AXP', 'American Express'),
  ] },
  { id: 'energia', label: 'Energía', assets: [
    a('XOM', 'ExxonMobil'), a('CVX', 'Chevron'), a('COP', 'ConocoPhillips'), a('SLB', 'SLB'), a('OXY', 'Occidental'),
    a('EOG', 'EOG Resources'), a('PSX', 'Phillips 66'),
  ] },
  { id: 'consumo', label: 'Consumo', assets: [
    a('AMZN', 'Amazon'), a('TSLA', 'Tesla'), a('WMT', 'Walmart'), a('COST', 'Costco'), a('KO', 'Coca-Cola'),
    a('PG', 'Procter & Gamble'), a('MCD', "McDonald's"), a('NKE', 'Nike'), a('HD', 'Home Depot'),
  ] },
  { id: 'colombia', label: 'Colombia', assets: [
    a('EC', 'Ecopetrol'), a('CIB', 'Bancolombia'), a('AVAL', 'Grupo Aval'), a('TGLS', 'Tecnoglass'),
  ] },
]

export const ETF_NICHES: readonly SymbolNiche[] = [
  { id: 'indices', label: 'Índices', assets: [
    a('SPY', 'S&P 500 (SPDR)'), a('QQQ', 'Nasdaq-100 (Invesco)'), a('DIA', 'Dow Jones (SPDR)'), a('IWM', 'Russell 2000 (iShares)'),
    a('VT', 'Mercado mundial (Vanguard)'), a('VWO', 'Mercados emergentes (Vanguard)'), a('EFA', 'Desarrollados ex EE. UU. (iShares)'),
  ] },
  { id: 'sectores', label: 'Sectores', assets: [
    a('XLK', 'Tecnología (SPDR)'), a('XLE', 'Energía (SPDR)'), a('XLF', 'Financiero (SPDR)'), a('XLV', 'Salud (SPDR)'),
    a('XLY', 'Consumo discrecional (SPDR)'), a('XLI', 'Industrial (SPDR)'), a('XLU', 'Servicios públicos (SPDR)'),
    a('XLP', 'Consumo básico (SPDR)'), a('XLB', 'Materiales (SPDR)'), a('XLRE', 'Inmobiliario (SPDR)'), a('XLC', 'Comunicaciones (SPDR)'),
  ] },
  { id: 'tematicos', label: 'Temáticos', assets: [
    a('SMH', 'Semiconductores (VanEck)'), a('ARKK', 'Innovación disruptiva (ARK)'), a('ICLN', 'Energía limpia (iShares)'),
    a('TAN', 'Energía solar (Invesco)'), a('BOTZ', 'Robótica e IA (Global X)'), a('URA', 'Uranio (Global X)'),
    a('LIT', 'Litio y baterías (Global X)'), a('CIBR', 'Ciberseguridad (First Trust)'),
  ] },
  { id: 'refugio', label: 'Materias primas y bonos', assets: [
    a('GLD', 'Oro (SPDR)'), a('SLV', 'Plata (iShares)'), a('USO', 'Petróleo (USO)'), a('TLT', 'Bonos del Tesoro 20+ años (iShares)'),
    a('AGG', 'Bonos EE. UU. agregados (iShares)'), a('HYG', 'Bonos high yield (iShares)'),
  ] },
  { id: 'latam', label: 'Latinoamérica', assets: [
    a('ILF', 'Latinoamérica 40 (iShares)'), a('EWZ', 'Brasil (iShares)'), a('EWW', 'México (iShares)'), a('ECH', 'Chile (iShares)'),
  ] },
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
