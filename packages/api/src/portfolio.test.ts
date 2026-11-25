import { portfolioSchema, type PortfolioDto, type PortfolioImportResult } from '@kaligula/contracts'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readXlsx, XlsxError } from './modules/portfolio/infrastructure/xlsx-reader'
import { createTestApp, fakePriceHistoryProvider, history, type TestApp } from './test-support'
import { buildXlsx, toBase64, xtbWorkbookSheets } from './xlsx-fixture'

describe('xlsx reader', () => {
  it('reads shared strings, numbers, booleans and sparse cells from deflated and stored files', async () => {
    for (const compress of [true, false]) {
      const bytes = await buildXlsx([{ name: 'Hoja & datos', rows: [['Símbolo', 'Valor'], ['AAPL.US', 1234.5], [null, true]] }], { compress })
      const [sheet] = await readXlsx(bytes)
      expect(sheet.name).toBe('Hoja & datos')
      expect(sheet.rows).toEqual([['Símbolo', 'Valor'], ['AAPL.US', 1234.5], [null, true]])
    }
  })

  it('rejects non-Excel files and oversized content', async () => {
    await expect(readXlsx(new TextEncoder().encode('hola,mundo'))).rejects.toBeInstanceOf(XlsxError)
    const bytes = await buildXlsx([{ name: 'A', rows: [['x'.repeat(5_000)]] }])
    await expect(readXlsx(bytes, { maxEntries: 50, maxBytes: 1_000 })).rejects.toThrow('demasiado grande')
  })
})

describe('portfolio API (read-only)', () => {
  let api: TestApp

  beforeAll(async () => {
    api = await createTestApp({
      // Live price only for AAPL; CSPX (London) keeps the statement price.
      priceHistoryProvider: fakePriceHistoryProvider(async (symbols) => new Map(
        symbols.filter((symbol) => symbol === 'AAPL').map((symbol) => [symbol, { ...history(symbol, 300, 1), price: 400 }]),
      )),
    })
  })

  beforeEach(() => {
    api.useOwner(globalThis.crypto.randomUUID())
  })

  afterAll(async () => {
    await api.close()
  })

  const upload = async (sheets: ReturnType<typeof xtbWorkbookSheets>, fileName = 'xtb.xlsx') =>
    api.json<PortfolioImportResult>('POST', '/api/portfolio/import', { fileName, contentBase64: toBase64(await buildXlsx(sheets)) })

  it('imports an XTB statement and values it with live prices', async () => {
    const result = await upload(xtbWorkbookSheets(5001, [
      { id: 1, ticker: 'AAPL.US', name: 'Apple Inc.', volume: 2, open: 300, current: 350 },
      { id: 2, ticker: 'AAPL.US', name: 'Apple Inc.', volume: 1, open: 330, current: 350 },
      { id: 3, ticker: 'CSPX.UK', name: 'iShares Core S&P 500', volume: 0.5, open: 600, current: 640 },
    ]))
    expect(result.status).toBe(201)
    expect(result.body).toMatchObject({ accountNumber: '5001', accountCurrency: 'USD', lots: 3, holdings: 2, reportTime: '2026-11-20T09:00:00.000Z' })

    const { body } = await api.json<PortfolioDto>('GET', '/api/portfolio')
    const portfolio = portfolioSchema.parse(body)
    const apple = portfolio.holdings.find((holding) => holding.symbol === 'AAPL.US')!
    expect(apple).toMatchObject({ marketSymbol: 'AAPL', quantity: 3, priceSource: 'live', price: 400, lots: 2 })
    expect(apple.value).toBeCloseTo(1_200, 6) // 1 050 at 350 → scaled to 400
    expect(apple.cost).toBeCloseTo(930, 6)
    expect(portfolio.holdings.find((holding) => holding.symbol === 'CSPX.UK')).toMatchObject({ priceSource: 'report', value: 320 })
    expect(portfolio.totals[0]).toMatchObject({ currency: 'USD', copPerUnit: 3317.52, positions: 2 })
    expect(portfolio.prices).toMatchObject({ source: 'fake-prices', error: null })
    expect(portfolio.imports).toHaveLength(1)
  })

  it('replaces the snapshot when the same account is imported again, and keeps other accounts', async () => {
    await upload(xtbWorkbookSheets(7001, [{ id: 1, ticker: 'AAPL.US', name: 'Apple', volume: 1, open: 300, current: 350 }]))
    await upload(xtbWorkbookSheets(7002, [{ id: 9, ticker: 'MSFT.US', name: 'Microsoft', volume: 1, open: 400, current: 410 }]))
    await upload(xtbWorkbookSheets(7001, [{ id: 2, ticker: 'NVDA.US', name: 'NVIDIA', volume: 4, open: 100, current: 120 }]))
    const { body } = await api.json<PortfolioDto>('GET', '/api/portfolio')
    expect(body.imports.map((item) => item.accountNumber).sort()).toEqual(['7001', '7002'])
    expect(body.holdings.map((holding) => holding.symbol).sort()).toEqual(['MSFT.US', 'NVDA.US'])

    const toRemove = body.imports.find((item) => item.accountNumber === '7002')!
    expect((await api.request('DELETE', `/api/portfolio/imports/${toRemove.id}`)).status).toBe(204)
    expect((await api.json<PortfolioDto>('GET', '/api/portfolio')).body.holdings.map((holding) => holding.symbol)).toEqual(['NVDA.US'])
  })

  it('explains unreadable files and has no trading endpoints', async () => {
    const notExcel = await api.json<{ error: { message: string } }>('POST', '/api/portfolio/import', { fileName: 'x.csv', contentBase64: btoa('a,b\n1,2') })
    expect(notExcel.status).toBe(400)
    expect(notExcel.body.error.message).toMatch(/Excel/)
    const noPositions = await api.json('POST', '/api/portfolio/import', { fileName: 'x.xlsx', contentBase64: toBase64(await buildXlsx([{ name: 'Otra', rows: [['hola']] }])) })
    expect(noPositions.status).toBe(400)
    expect((await api.request('POST', '/api/portfolio/orders', { symbol: 'AAPL' })).status).toBe(404)
    expect((await api.json<PortfolioDto>('GET', '/api/portfolio')).body).toMatchObject({ holdings: [], totals: [] })
  })
})
