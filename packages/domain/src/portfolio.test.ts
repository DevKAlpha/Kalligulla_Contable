import { describe, expect, it } from 'vitest'
import { cellDate, cellNumber, DomainError, headerKey, marketSymbolFor, parseXtbStatement, valuePortfolio, type Cell, type SheetRows } from './index'

/** Layout of the "Open Positions" sheet: preamble, account summary, header, symbol rows and their lots. */
function openPositionsSheet(rows: Cell[][], header?: Cell[]): SheetRows {
  return {
    name: 'Open Positions',
    rows: [
      ['Account number', 51234567],
      ['Open Positions'],
      ['Data as of report generated', 46_303.375], // Excel serial: 2026-10-08 09:00 UTC
      ['Product', 'Metric', 'Amount', 'Currency'],
      ['Investment Plans', 'Open position value', 2_000, 'USD'],
      ['Note', 'Summary values and open positions are shown as of the report generation time'],
      header ?? ['Product', 'Instrument/Position', 'Ticker', 'Category', 'Type', 'Volume', 'Value', 'Current price', 'Open price', 'Open time (UTC)', 'Stop Loss', 'Take Profit', 'Net Profit %', 'Net Profit', 'Gross Profit', 'Margin', 'Open Commission', 'Swap', 'Rollover'],
      ...rows,
    ],
  }
}

const closedSheet: SheetRows = {
  name: 'Closed Positions',
  rows: [
    ['Account number', 51234567],
    ['Instrument', 'Ticker', 'Type', 'Volume', 'Open Price', 'Open Time (UTC)', 'Close Price', 'Close Time (UTC)', 'Position ID'],
    ['Apple', 'AAPL.US', 'BUY', 1, 100, '2026-01-01 10:00:00', 120, '2026-02-01 10:00:00', 111],
  ],
}

describe('cell helpers', () => {
  it('normalizes headers, numbers and dates', () => {
    expect(headerKey('Open time (UTC)')).toBe('opentimeutc')
    expect(headerKey('Precio de apertura')).toBe('preciodeapertura')
    expect(cellNumber('1 234,56')).toBe(1234.56)
    expect(cellNumber('1,234.56')).toBe(1234.56)
    expect(cellNumber(-12.5)).toBe(-12.5)
    expect(cellNumber('')).toBeNull()
    expect(cellDate(46_303.375)).toBe('2026-10-08T09:00:00.000Z')
    expect(cellDate('08.10.2026 08:30:00')).toBe('2026-10-08T08:30:00.000Z')
    expect(cellDate('2026-10-08 08:30')).toBe('2026-10-08T08:30:00.000Z')
  })

  it('maps XTB US tickers to market symbols', () => {
    expect(marketSymbolFor('AAPL.US')).toBe('AAPL')
    expect(marketSymbolFor('BRK.B.US')).toBe('BRK.B')
    expect(marketSymbolFor('VUSA.UK')).toBeNull()
  })
})

describe('XTB statement', () => {
  const sheet = openPositionsSheet([
    ['Investment Plans', 'Apple Inc.', 'AAPL.US', 'STC', '', 3, 1_050, '', '', '', '', '', '', '', 150],
    ['Investment Plans', '1001', 'AAPL.US', '', 'BUY', 2, 700, 350, 300, '2026-03-02 14:30:00', '', '', '', '', 100],
    ['Investment Plans', '1002', 'AAPL.US', '', 'BUY', 1, 350, 350, 300, '2026-04-02 14:30:00', '', '', '', '', 50],
    ['Investment Plans', 'iShares Core S&P 500', 'CSPX.UK', 'ETF', '', 0.5, 300, '', '', '', '', '', '', '', -10],
    ['Investment Plans', '1003', 'CSPX.UK', '', 'BUY', 0.5, 300, 600, 620, 46_000.5, '', '', '', '', -10],
    ['Total', '', '', '', '', '', 1_350],
  ])

  it('reads lots with names and categories from the symbol rows, plus account metadata', () => {
    const statement = parseXtbStatement([closedSheet, sheet])
    expect(statement.meta).toEqual({ source: 'xtb', accountNumber: '51234567', accountCurrency: 'USD', reportTime: '2026-10-08T09:00:00.000Z' })
    expect(statement.lots).toHaveLength(3)
    expect(statement.lots[0]).toMatchObject({
      externalId: '1001', symbol: 'AAPL.US', name: 'Apple Inc.', category: 'STC', side: 'buy', quantity: 2,
      openPrice: 300, reportPrice: 350, reportValue: 700, reportGrossProfit: 100, openTime: '2026-03-02T14:30:00.000Z',
    })
    expect(statement.lots[2]).toMatchObject({ symbol: 'CSPX.UK', name: 'iShares Core S&P 500', category: 'ETF', quantity: 0.5 })
    expect(statement.skipped).toBe(1)
  })

  it('accepts Spanish headers', () => {
    const spanish = openPositionsSheet(
      [['Planes', '2001', 'MSFT.US', 'STC', 'COMPRA', '1,5', '600,00', '400,00', '380,00', '05.05.2026 10:00:00', '', '', '', '', '30,00']],
      ['Producto', 'Instrumento/Posición', 'Símbolo', 'Categoría', 'Tipo', 'Volumen', 'Valor', 'Precio actual', 'Precio de apertura', 'Hora de apertura (UTC)', 'SL', 'TP', 'Ganancia neta %', 'Ganancia neta', 'Ganancia bruta'],
    )
    const statement = parseXtbStatement([{ ...spanish, name: 'Posiciones abiertas' }])
    expect(statement.lots[0]).toMatchObject({ symbol: 'MSFT.US', side: 'buy', quantity: 1.5, openPrice: 380, reportValue: 600, reportGrossProfit: 30 })
  })

  it('explains what is missing', () => {
    expect(() => parseXtbStatement([closedSheet])).toThrow(DomainError)
    expect(() => parseXtbStatement([openPositionsSheet([])])).toThrow('no tiene posiciones abiertas')
  })
})

describe('portfolio valuation', () => {
  const lots = parseXtbStatement([openPositionsSheet([
    ['Investment Plans', '1001', 'AAPL.US', 'STC', 'BUY', 2, 700, 350, 300, '', '', '', '', '', 100],
    ['Investment Plans', '1002', 'AAPL.US', 'STC', 'BUY', 1, 350, 350, 300, '', '', '', '', '', 50],
    ['Investment Plans', '1003', 'CSPX.UK', 'ETF', 'BUY', 0.5, 300, 600, 620, '', '', '', '', '', -10],
  ])]).lots.map((lot) => ({ ...lot, accountCurrency: 'USD' }))

  it('uses the statement values without live prices', () => {
    const { holdings, totals } = valuePortfolio(lots)
    expect(holdings[0]).toMatchObject({ symbol: 'AAPL.US', quantity: 3, avgOpenPrice: 300, value: 1_050, cost: 900, profit: 150, priceSource: 'report', lots: 2 })
    expect(holdings[0].profitPct).toBeCloseTo(16.6667, 3)
    expect(totals).toEqual([{ currency: 'USD', value: 1_350, cost: 1_210, profit: 140, profitPct: (140 / 1_210) * 100, positions: 2 }])
    expect(holdings[0].weightPct + holdings[1].weightPct).toBeCloseTo(100, 6)
  })

  it('applies live prices as a ratio, keeping the account currency', () => {
    const { holdings } = valuePortfolio(lots, new Map([['AAPL', { price: 385, time: Date.UTC(2026, 10, 25, 15) }]]))
    const apple = holdings.find((holding) => holding.symbol === 'AAPL.US')!
    expect(apple).toMatchObject({ price: 385, priceSource: 'live', priceTime: '2026-11-25T15:00:00.000Z', cost: 900 })
    expect(apple.value).toBeCloseTo(1_155, 6)
    expect(apple.profit).toBeCloseTo(255, 6)
    expect(holdings.find((holding) => holding.symbol === 'CSPX.UK')!.priceSource).toBe('report')
  })

  it('values short positions with the opposite sign', () => {
    const [short] = valuePortfolio([{ ...lots[0], side: 'sell', reportGrossProfit: -100 }], new Map([['AAPL', { price: 315, time: null }]])).holdings
    // Opened at 300, report 350 (−100), now 315: the short recovers 70 of the loss.
    expect(short.cost).toBeCloseTo(600, 6) // 2 × 300 opening notional
    expect(short.profit).toBeCloseTo(-30, 6)
  })
})
