import { DomainError } from './errors'

/*
 * Read-only investment portfolio built from a broker statement (XTB xStation "account history" workbook).
 * Kaligula never trades or edits positions: it only reads what the statement says and values it.
 */

export type Cell = string | number | boolean | null

export interface SheetRows {
  name: string
  rows: Cell[][]
}

export type PositionSide = 'buy' | 'sell'

export interface PortfolioLotDraft {
  /** Broker position id, when the statement has one. */
  externalId: string | null
  /** Broker ticker, e.g. `AAPL.US`. */
  symbol: string
  name: string
  category: string | null
  side: PositionSide
  quantity: number
  /** Price per unit when the position was opened (instrument currency). */
  openPrice: number
  openTime: string | null
  /** Price per unit when the statement was generated (instrument currency). */
  reportPrice: number | null
  /** Position value in the account currency when the statement was generated. */
  reportValue: number | null
  /** Unrealized gross profit in the account currency when the statement was generated. */
  reportGrossProfit: number | null
}

export interface StatementMeta {
  source: 'xtb'
  accountNumber: string | null
  /** ISO 4217 code of the account (e.g. USD, EUR). */
  accountCurrency: string | null
  reportTime: string | null
}

export interface ParsedStatement {
  meta: StatementMeta
  lots: PortfolioLotDraft[]
  /** Data rows that could not be read as positions. */
  skipped: number
}

/* ---------- Cell helpers ---------- */

/** Lowercase ASCII key without accents or punctuation: "Open time (UTC)" → "opentimeutc". */
export function headerKey(value: Cell): string {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function text(value: Cell): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

/** Numbers from numeric cells or text such as "1 234,56", "1,234.56" or "-12.5". */
export function cellNumber(value: Cell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  // \s also matches no-break spaces (U+00A0, U+202F) used as thousands separators.
  const raw = text(value).replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  if (!raw || !/\d/.test(raw)) return null
  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  const normalized = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

/** Dates from Excel serial numbers (1900 system) or text like `2026-10-08 08:00:00` / `08.10.2026 08:00:00` (UTC). */
export function cellDate(value: Cell): string | null {
  if (typeof value === 'number' && value > 20_000 && value < 80_000) {
    return new Date(Math.round((value - 25_569) * 86_400_000)).toISOString()
  }
  const raw = text(value)
  if (!raw) return null
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(raw)
  if (match) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = match
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)).toISOString()
  }
  match = /^(\d{2})[./](\d{2})[./](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(raw)
  if (match) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = match
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)).toISOString()
  }
  return null
}

/* ---------- XTB statement ---------- */

/** Column names seen in XTB exports (English and Spanish), as header keys. */
const COLUMNS = {
  position: ['instrumentposition', 'instrumentoposicion', 'positionid', 'position', 'posicion', 'idposicion'],
  ticker: ['ticker', 'symbol', 'simbolo'],
  category: ['category', 'categoria'],
  type: ['type', 'tipo'],
  volume: ['volume', 'volumen', 'quantity', 'cantidad'],
  value: ['value', 'valor', 'marketvalue', 'valordemercado'],
  currentPrice: ['currentprice', 'marketprice', 'precioactual', 'preciodemercado'],
  openPrice: ['openprice', 'preciodeapertura', 'precioapertura'],
  openTime: ['opentimeutc', 'opentime', 'horadeaperturautc', 'horadeapertura', 'fechadeaperturautc', 'fechadeapertura'],
  grossProfit: ['grossprofit', 'gananciabruta', 'beneficiobruto'],
} as const
type Column = keyof typeof COLUMNS

function columnIndex(header: Cell[]): Partial<Record<Column, number>> {
  const keys = header.map(headerKey)
  const result: Partial<Record<Column, number>> = {}
  for (const [column, names] of Object.entries(COLUMNS) as [Column, readonly string[]][]) {
    const at = keys.findIndex((key) => names.includes(key))
    if (at !== -1) result[column] = at
  }
  return result
}

function isOpenHeader(row: Cell[]): boolean {
  const index = columnIndex(row)
  const keys = row.map(headerKey)
  const closed = keys.some((key) => key.startsWith('closeprice') || key.startsWith('preciodecierre'))
  return index.ticker !== undefined && index.type !== undefined && index.volume !== undefined && index.openPrice !== undefined && !closed
}

function sideOf(value: Cell): PositionSide | null {
  const key = headerKey(value)
  if (['buy', 'compra', 'long', 'largo'].includes(key)) return 'buy'
  if (['sell', 'venta', 'short', 'corto'].includes(key)) return 'sell'
  return null
}

function metadata(sheets: readonly SheetRows[]): Omit<StatementMeta, 'source'> {
  let accountNumber: string | null = null
  let accountCurrency: string | null = null
  let reportTime: string | null = null
  for (const sheet of sheets) {
    sheet.rows.forEach((row, at) => {
      const first = headerKey(row[0])
      if (!accountNumber && (first === 'accountnumber' || first === 'numerodecuenta' || first === 'cuenta')) {
        accountNumber = text(row[1]) || null
      }
      if (!reportTime && (first.includes('reportgenerated') || first.includes('generado') || first === 'dateto' || first === 'datetoutc')) {
        reportTime = cellDate(row[1])
      }
      const currencyAt = row.map(headerKey).findIndex((key) => key === 'currency' || key === 'moneda' || key === 'divisa')
      if (!accountCurrency && currencyAt !== -1) {
        const below = text(sheet.rows[at + 1]?.[currencyAt]).toUpperCase()
        if (/^[A-Z]{3}$/.test(below)) accountCurrency = below
      }
    })
  }
  return { accountNumber, accountCurrency, reportTime }
}

/**
 * Reads the open positions of an XTB xStation account-history workbook.
 * The "Open Positions" sheet lists a summary row per symbol followed by one row per lot (with its position id);
 * summary rows only provide the instrument name and category for the lots below them.
 * Closed positions and cash operations are not needed to show the current portfolio.
 */
export function parseXtbStatement(sheets: readonly SheetRows[]): ParsedStatement {
  const candidates = [...sheets].sort((a, b) => Number(/open|abiert/i.test(b.name)) - Number(/open|abiert/i.test(a.name)))
  let header: { sheet: SheetRows; at: number } | null = null
  for (const sheet of candidates) {
    const at = sheet.rows.findIndex(isOpenHeader)
    if (at !== -1) {
      header = { sheet, at }
      break
    }
  }
  if (!header) {
    throw new DomainError('No encontramos la hoja de posiciones abiertas. Exporta desde xStation 5 el historial de la cuenta en formato Excel (.xlsx).')
  }

  const index = columnIndex(header.sheet.rows[header.at])
  const cell = (row: Cell[], column: Column) => (index[column] === undefined ? null : row[index[column]!] ?? null)
  const lots: PortfolioLotDraft[] = []
  const summary = new Map<string, { name: string; category: string | null }>()
  let skipped = 0

  for (const row of header.sheet.rows.slice(header.at + 1)) {
    if (row.every((value) => text(value) === '')) continue
    const symbol = text(cell(row, 'ticker')).toUpperCase()
    const side = sideOf(cell(row, 'type'))
    const positionCell = text(cell(row, 'position'))
    const category = text(cell(row, 'category')) || null
    if (!symbol) {
      if (row.some((value) => typeof value === 'number')) skipped += 1 // totals and notes are layout, not positions
      continue
    }
    // Summary row of a symbol: instrument name + category, no side or id of its own.
    if (!side || (positionCell && !/^\d+$/.test(positionCell) && !cellNumber(cell(row, 'openPrice')))) {
      summary.set(symbol, { name: positionCell || symbol, category })
      continue
    }
    const quantity = cellNumber(cell(row, 'volume'))
    const openPrice = cellNumber(cell(row, 'openPrice'))
    if (!quantity || quantity <= 0 || openPrice === null || openPrice <= 0) {
      skipped += 1
      continue
    }
    const parent = summary.get(symbol)
    lots.push({
      externalId: /^\d+$/.test(positionCell) ? positionCell : null,
      symbol,
      name: parent?.name ?? (positionCell && !/^\d+$/.test(positionCell) ? positionCell : symbol),
      category: category ?? parent?.category ?? null,
      side,
      quantity,
      openPrice,
      openTime: cellDate(cell(row, 'openTime')),
      reportPrice: cellNumber(cell(row, 'currentPrice')),
      reportValue: cellNumber(cell(row, 'value')),
      reportGrossProfit: cellNumber(cell(row, 'grossProfit')),
    })
  }

  if (lots.length === 0) throw new DomainError('El reporte no tiene posiciones abiertas para mostrar.')
  return { meta: { source: 'xtb', ...metadata(sheets) }, lots, skipped }
}

/* ---------- Valuation ---------- */

/** Ticker usable with US market data, or `null` (XTB writes `AAPL.US`, `BRK.B.US`; other markets are not priced live). */
export function marketSymbolFor(brokerSymbol: string): string | null {
  const match = /^([A-Z0-9][A-Z0-9.-]*?)\.US$/i.exec(brokerSymbol.trim())
  return match ? match[1].toUpperCase() : null
}

export interface LivePrice {
  price: number
  /** Unix ms of the trade, when known. */
  time: number | null
}

export interface ValuedLot extends PortfolioLotDraft {
  accountCurrency: string | null
}

export interface Holding {
  key: string
  symbol: string
  marketSymbol: string | null
  name: string
  category: string | null
  side: PositionSide
  accountCurrency: string | null
  quantity: number
  avgOpenPrice: number
  /** Price used for the valuation (instrument currency). */
  price: number
  priceSource: 'live' | 'report' | 'open'
  priceTime: string | null
  /** Value, cost and profit in the account currency. */
  value: number
  cost: number
  profit: number
  profitPct: number | null
  /** Share of the account's total value, in percent. */
  weightPct: number
  lots: number
}

export interface PortfolioTotals {
  currency: string | null
  value: number
  cost: number
  profit: number
  profitPct: number | null
  positions: number
}

/**
 * Values the lots at the latest price available. With a live price the statement value is scaled by
 * `live / reportPrice`, a currency-free ratio, so the result stays in the account currency even when the
 * instrument trades in another currency. Without one, the statement value is used.
 */
export function valuePortfolio(lots: readonly ValuedLot[], live: ReadonlyMap<string, LivePrice> = new Map()): { holdings: Holding[]; totals: PortfolioTotals[] } {
  const groups = new Map<string, Holding>()
  for (const lot of lots) {
    const marketSymbol = marketSymbolFor(lot.symbol)
    const quote = marketSymbol ? live.get(marketSymbol) : undefined
    const reportPrice = lot.reportPrice && lot.reportPrice > 0 ? lot.reportPrice : null
    const basePrice = reportPrice ?? lot.openPrice
    const baseValue = lot.reportValue ?? lot.quantity * basePrice
    const sign = lot.side === 'buy' ? 1 : -1
    const baseProfit = lot.reportGrossProfit ?? sign * lot.quantity * (basePrice - lot.openPrice)
    // Long: value = cost + profit. Short: profit grows as the price falls, so value = cost − profit.
    const cost = baseValue - sign * baseProfit
    const factor = quote && quote.price > 0 ? quote.price / basePrice : 1
    const value = baseValue * factor
    const profit = baseProfit + sign * (value - baseValue)

    const key = `${lot.accountCurrency ?? '—'}|${lot.symbol}|${lot.side}`
    const holding = groups.get(key) ?? {
      key,
      symbol: lot.symbol,
      marketSymbol,
      name: lot.name,
      category: lot.category,
      side: lot.side,
      accountCurrency: lot.accountCurrency,
      quantity: 0,
      avgOpenPrice: 0,
      price: quote?.price ?? basePrice,
      priceSource: quote ? 'live' : reportPrice ? 'report' : 'open',
      priceTime: quote?.time ? new Date(quote.time).toISOString() : null,
      value: 0,
      cost: 0,
      profit: 0,
      profitPct: null,
      weightPct: 0,
      lots: 0,
    } satisfies Holding
    holding.avgOpenPrice = (holding.avgOpenPrice * holding.quantity + lot.openPrice * lot.quantity) / (holding.quantity + lot.quantity)
    holding.quantity += lot.quantity
    holding.value += value
    holding.cost += cost
    holding.profit += profit
    holding.lots += 1
    groups.set(key, holding)
  }

  const holdings = [...groups.values()]
  const totals = new Map<string, PortfolioTotals>()
  for (const holding of holdings) {
    holding.profitPct = holding.cost !== 0 ? (holding.profit / Math.abs(holding.cost)) * 100 : null
    const key = holding.accountCurrency ?? '—'
    const total = totals.get(key) ?? { currency: holding.accountCurrency, value: 0, cost: 0, profit: 0, profitPct: null, positions: 0 }
    total.value += Math.abs(holding.value)
    total.cost += Math.abs(holding.cost)
    total.profit += holding.profit
    total.positions += 1
    totals.set(key, total)
  }
  for (const holding of holdings) {
    const total = totals.get(holding.accountCurrency ?? '—')!
    holding.weightPct = total.value ? (Math.abs(holding.value) / total.value) * 100 : 0
  }
  for (const total of totals.values()) total.profitPct = total.cost ? (total.profit / total.cost) * 100 : null

  holdings.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return { holdings, totals: [...totals.values()].sort((a, b) => b.value - a.value) }
}
