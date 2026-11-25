/*
 * News relevance for the currencies Kaligula tracks (COP, USD, EUR, KRW).
 * Pure, explainable keyword rules in Spanish and English; no external service decides what is shown.
 */

export const NEWS_CURRENCIES = ['COP', 'USD', 'EUR', 'KRW'] as const
export type NewsCurrency = (typeof NEWS_CURRENCIES)[number]

export const NEWS_TOPICS = ['monetary', 'inflation', 'commodities', 'trade', 'fiscal', 'markets', 'growth'] as const
export type NewsTopic = (typeof NEWS_TOPICS)[number]

export const NEWS_TOPIC_LABELS: Record<NewsTopic, string> = {
  monetary: 'Política monetaria',
  inflation: 'Inflación',
  commodities: 'Materias primas',
  trade: 'Comercio',
  fiscal: 'Fiscal y deuda',
  markets: 'Mercados',
  growth: 'Crecimiento y empleo',
}

/** Lowercase, without accents: "Dólar" and "dolar" match the same rule. */
export function normalizeNewsText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const any = (...patterns: string[]) => new RegExp(patterns.map((pattern) => `\\b(?:${pattern})\\b`).join('|'))

/** Direct signals: the currency, its central bank or its market are named. */
const STRONG: Record<NewsCurrency, RegExp> = {
  COP: any('peso colombiano', 'pesos colombianos', 'colombian peso', 'banco de la republica', 'banrep', 'trm', 'usd ?/ ?cop', 'dolar en colombia', 'minhacienda', 'ecopetrol', 'colcap', 'bvc'),
  USD: any('fed', 'federal reserve', 'reserva federal', 'fomc', 'powell', 'dolar', 'dolares', 'dollar index', 'dxy', 'greenback', 'the dollar', 'u\\.s\\. dollar', 'us dollar', 'treasury yields?', 'bonos del tesoro', 'nonfarm', 'nominas no agricolas', 'usd'),
  EUR: any('euro', 'eurozone', 'euro area', 'zona euro', 'eurozona', 'ecb', 'bce', 'european central bank', 'banco central europeo', 'lagarde', 'eur ?/ ?usd', 'eurusd', 'eurostat'),
  KRW: any('korean won', 'won surcoreano', 'won coreano', 'won[- /]dollar', 'dollar[- /]won', 'the won', 'krw', 'usd ?/ ?krw', 'bank of korea', 'banco de corea', 'bok', 'kospi', 'kosdaq'),
}

/** Country or region only: tags a currency when the story is also about the economy. */
const WEAK: Record<NewsCurrency, RegExp> = {
  COP: any('colombia', 'colombian[oa]s?', 'colombian', 'gustavo petro', 'bogota', 'dian', 'regla fiscal', 'superfinanciera', 'superintendencia financiera', 'presupuesto general de la nacion', 'ministr[oa] de hacienda', 'ministerio de hacienda', 'salario minimo'),
  USD: any('u\\.s\\.', 'united states', 'estados unidos', 'ee\\. ?uu\\.?', 'eeuu', 'wall street', 'washington', 'white house', 'casa blanca'),
  EUR: any('european union', 'union europea', 'europe', 'europa', 'germany', 'alemania', 'france', 'francia', 'italy', 'italia', 'spain', 'espana'),
  KRW: any('south korean?', 'korean?', 'corea del sur', 'surcorean[oa]s?', 'seoul', 'seul'),
}

/** North Korea is not the won's economy. */
const NOT_SOUTH_KOREA = /\b(?:north korean?|n\. korean?|corea del norte|norcorean[oa]s?|pyongyang)\b/g

const TOPICS: Record<NewsTopic, RegExp> = {
  monetary: any('interest rates?', 'tasas? de interes', 'tipos? de interes', 'rate (?:cut|hike|decision)s?', '(?:recorte|alza|subida|baja)s? de (?:las )?tasas', 'monetary', 'monetaria', 'central bank', 'banco central', 'fomc', 'fed', 'ecb', 'bce', 'banrep', 'banco de la republica', 'bank of korea'),
  inflation: any('inflation', 'inflacion', 'cpi', 'ipc', 'pce', 'consumer prices', 'precios al consumidor', 'deflation', 'deflacion'),
  commodities: any('oil', 'petroleo', 'crudo', 'brent', 'wti', 'opec\\+?', 'opep\\+?', 'gold', 'oro', 'copper', 'cobre', 'coffee prices?', 'arabica', 'precios? (?:interno |externo )?del cafe', 'cafe colombiano', '(?:produccion|exportaciones|cosecha) de cafe', 'coal', 'carbon', 'natural gas', 'gas natural', 'commodit(?:y|ies)', 'materias primas'),
  trade: any('tariffs?', 'aranceles?', 'trade (?:war|deal|deficit|surplus|talks)', 'guerra comercial', 'exports?', 'imports?', 'exportaciones?', 'importaciones?', 'balanza comercial', 'sanctions?', 'sanciones'),
  fiscal: any('deficit', 'debt', 'deuda', 'fiscal', 'budget', 'presupuesto', 'reforma tributaria', 'impuestos?', 'iva', 'credit rating', 'calificacion crediticia', 'moody\'?s', 'fitch', 'bonds?', 'bonos', 'yields?', 'tes'),
  markets: any('stocks?', 'stock market', 'bolsas?', 'wall street', 's&p 500', 'nasdaq', 'dow jones', 'msci', 'colcap', 'kospi', 'forex', 'divisas?', 'tipo de cambio', 'tasa de cambio', 'exchange rates?', 'currenc(?:y|ies)', 'monedas?'),
  growth: any('gdp', 'pib', 'recession', 'recesion', 'unemployment', 'desempleo', 'jobs report', 'payrolls', 'economic growth', 'crecimiento economico', 'economy', 'economia', 'imf', 'fmi', 'world bank', 'banco mundial'),
}

/** World context that moves every currency even when none is named. */
const GLOBAL = any('china', 'chinese', 'chin[oa]s?', 'opec\\+?', 'opep\\+?', 'oil', 'petroleo', 'crudo', 'brent', 'imf', 'fmi', 'world bank', 'banco mundial', 'recession', 'recesion', 'tariffs?', 'aranceles?', 'trade war', 'guerra comercial', 'gold', 'oro', 'global economy', 'economia mundial', 'economia global', 'geopolitic\\w*', 'geopolitic[oa]s?', 'msci')

export interface NewsSourceHints {
  /** Currencies the source covers by nature (a Colombian outlet covers COP). Applied only to official or economy-only feeds. */
  currencies?: readonly NewsCurrency[]
  /** The feed is already an economy section: every item counts as relevant for `currencies`. */
  economyOnly?: boolean
  /** Official central bank releases are always relevant for their currency. */
  official?: boolean
}

export interface NewsClassification {
  currencies: NewsCurrency[]
  topics: NewsTopic[]
  global: boolean
  relevant: boolean
}

export function classifyNews(text: string, hints: NewsSourceHints = {}): NewsClassification {
  const normalized = normalizeNewsText(text)
  const topics = NEWS_TOPICS.filter((topic) => TOPICS[topic].test(normalized))
  const strong = NEWS_CURRENCIES.filter((currency) => STRONG[currency].test(normalized))
  const countries = normalized.replace(NOT_SOUTH_KOREA, ' ')
  const weak = topics.length > 0 ? NEWS_CURRENCIES.filter((currency) => WEAK[currency].test(countries)) : []
  // A general outlet (all sections) must name the country or currency; its home currency is not assumed.
  const defaults = hints.official || hints.economyOnly ? hints.currencies ?? [] : []
  const found = new Set<NewsCurrency>([...strong, ...weak, ...defaults])
  const currencies = NEWS_CURRENCIES.filter((currency) => found.has(currency))
  const global = GLOBAL.test(normalized)
  return { currencies, topics, global, relevant: currencies.length > 0 || global }
}

/** Plain text of at most `max` characters, cut at a word boundary. */
export function summarize(text: string, max = 240): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`
}

/** Stable identity of a story: its link without tracking parameters or fragment (FNV-1a, hex). */
export function newsId(url: string): string {
  let key = url.trim()
  try {
    const parsed = new URL(key)
    parsed.hash = ''
    const tracking: string[] = []
    parsed.searchParams.forEach((_, name) => {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(name)) tracking.push(name)
    })
    for (const name of tracking) parsed.searchParams.delete(name)
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/')
    key = `${parsed.host.replace(/^www\./, '')}${parsed.pathname}${parsed.search}`.toLowerCase()
  } catch {
    key = key.toLowerCase()
  }
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** Comparable headline: same story syndicated by two outlets is shown once. */
export function headlineKey(title: string): string {
  return normalizeNewsText(title).replace(/[^a-z0-9]+/g, ' ').trim()
}
