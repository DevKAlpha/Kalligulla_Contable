import {
  portfolioImportInputSchema, type PortfolioDto, type PortfolioImportResult,
} from '@kaligula/contracts'
import type { DatabaseHandle } from '@kaligula/db'
import {
  DomainError, marketSymbolFor, newId, parseXtbStatement, valuePortfolio,
  type LivePrice, type ParsedStatement, type PortfolioLotDraft, type ValuedLot,
} from '@kaligula/domain'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { FxTicker } from '../market-data/application/fx-ticker'
import type { PriceHistoryProvider } from '../market-data/domain/movers-providers'
import { chunk } from '../../shared/db'
import { HttpError, NotFoundError } from '../../shared/errors'
import { readJson, uuidParam, type AppEnv } from '../../shared/http'
import { readXlsx, XlsxError } from './infrastructure/xlsx-reader'

/*
 * Read-only investment portfolio. Users import their broker statement (XTB disabled its public API on
 * 14 March 2025) and Kaligula values it with live prices. There is no endpoint that trades or edits positions.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024

/* ---------- Port ---------- */

export interface StoredImport {
  id: string
  source: 'xtb'
  accountNumber: string | null
  accountCurrency: string | null
  fileName: string
  reportTime: string | null
  importedAt: string
  lots: number
}

export interface PortfolioRepository {
  /** Replaces the previous snapshot of the same account (or of every unnamed XTB account). */
  replaceSnapshot(owner: string, statement: ParsedStatement, fileName: string, now: Date): Promise<string>
  listImports(owner: string): Promise<StoredImport[]>
  listLots(owner: string): Promise<ValuedLot[]>
  deleteImport(owner: string, id: string): Promise<boolean>
}

/* ---------- Drizzle adapter ---------- */

export function createDrizzlePortfolioRepository({ db, tables: { portfolioImports, portfolioLots } }: Pick<DatabaseHandle, 'db' | 'tables'>): PortfolioRepository {
  return {
    async replaceSnapshot(owner, statement, fileName, now) {
      const importId = newId()
      await db.transaction(async (tx) => {
        const account = statement.meta.accountNumber
        await tx.delete(portfolioImports).where(and(
          eq(portfolioImports.ownerId, owner),
          eq(portfolioImports.source, statement.meta.source),
          account === null ? isNull(portfolioImports.accountNumber) : eq(portfolioImports.accountNumber, account),
        ))
        await tx.insert(portfolioImports).values({
          id: importId,
          ownerId: owner,
          source: statement.meta.source,
          accountNumber: account,
          accountCurrency: statement.meta.accountCurrency,
          fileName,
          reportTime: statement.meta.reportTime ? new Date(statement.meta.reportTime) : null,
          importedAt: now,
          lotsCount: statement.lots.length,
        })
        for (const part of chunk(statement.lots)) {
          await tx.insert(portfolioLots).values(part.map((lot) => ({
            id: newId(),
            ownerId: owner,
            importId,
            externalId: lot.externalId,
            symbol: lot.symbol,
            name: lot.name,
            category: lot.category,
            side: lot.side,
            quantity: lot.quantity,
            openPrice: lot.openPrice,
            openTime: lot.openTime ? new Date(lot.openTime) : null,
            reportPrice: lot.reportPrice,
            reportValue: lot.reportValue,
            reportGrossProfit: lot.reportGrossProfit,
          })))
        }
      })
      return importId
    },

    async listImports(owner) {
      const rows = await db.select().from(portfolioImports).where(eq(portfolioImports.ownerId, owner)).orderBy(desc(portfolioImports.importedAt))
      return rows.map((row) => ({
        id: row.id,
        source: 'xtb' as const,
        accountNumber: row.accountNumber,
        accountCurrency: row.accountCurrency,
        fileName: row.fileName,
        reportTime: row.reportTime?.toISOString() ?? null,
        importedAt: row.importedAt.toISOString(),
        lots: row.lotsCount,
      }))
    },

    async listLots(owner) {
      const rows = await db.select({ lot: portfolioLots, currency: portfolioImports.accountCurrency })
        .from(portfolioLots)
        .innerJoin(portfolioImports, eq(portfolioLots.importId, portfolioImports.id))
        .where(eq(portfolioLots.ownerId, owner))
        .orderBy(asc(portfolioLots.symbol))
      return rows.map(({ lot, currency }): ValuedLot => ({
        externalId: lot.externalId,
        symbol: lot.symbol,
        name: lot.name,
        category: lot.category,
        side: lot.side as PortfolioLotDraft['side'],
        quantity: lot.quantity,
        openPrice: lot.openPrice,
        openTime: lot.openTime?.toISOString() ?? null,
        reportPrice: lot.reportPrice,
        reportValue: lot.reportValue,
        reportGrossProfit: lot.reportGrossProfit,
        accountCurrency: currency,
      }))
    },

    async deleteImport(owner, id) {
      const deleted = await db.delete(portfolioImports).where(and(eq(portfolioImports.ownerId, owner), eq(portfolioImports.id, id))).returning({ id: portfolioImports.id })
      return deleted.length > 0
    },
  }
}

/* ---------- Application ---------- */

export interface PortfolioServiceOptions {
  repository: PortfolioRepository
  prices: PriceHistoryProvider
  fxTicker: FxTicker
  clock?: () => Date
}

function decodeBase64(content: string): Uint8Array {
  const clean = content.replace(/^data:[^,]*,/, '').replace(/\s/g, '')
  if (clean.length * 0.75 > MAX_FILE_BYTES + 3) throw new HttpError(413, 'payload_too_large', 'El reporte supera 10 MB.')
  try {
    return Uint8Array.from(atob(clean), (char) => char.charCodeAt(0))
  } catch {
    throw new DomainError('No pudimos leer el archivo. Vuelve a seleccionarlo.')
  }
}

export function createPortfolioService({ repository, prices, fxTicker, clock = () => new Date() }: PortfolioServiceOptions) {
  // Live prices are shared by every request and refreshed at the provider's pace.
  let cache: { key: string; at: number; quotes: Map<string, LivePrice> } | null = null

  async function livePrices(symbols: string[]): Promise<{ quotes: Map<string, LivePrice>; error: string | null }> {
    if (symbols.length === 0) return { quotes: new Map(), error: null }
    const key = [...symbols].sort().join(',')
    if (cache && cache.key === key && clock().getTime() - cache.at < prices.refreshMs) return { quotes: cache.quotes, error: null }
    try {
      const history = await prices.history(symbols)
      const quotes = new Map([...history].map(([symbol, item]) => [symbol, { price: item.price, time: item.priceTime }]))
      cache = { key, at: clock().getTime(), quotes }
      return { quotes, error: null }
    } catch (error) {
      if (cache?.key === key) return { quotes: cache.quotes, error: 'Mostramos los últimos precios disponibles.' }
      return { quotes: new Map(), error: error instanceof Error ? error.message : 'Precios en vivo no disponibles.' }
    }
  }

  async function copRates(): Promise<Map<string, number>> {
    const rates = new Map<string, number>([['COP', 1]])
    try {
      for (const quote of (await fxTicker.current()).quotes) rates.set(quote.currency, quote.copPerUnit)
    } catch {
      /* without FX the totals stay in the account currency */
    }
    return rates
  }

  return {
    async importStatement(owner: string, input: { fileName: string; contentBase64: string }): Promise<PortfolioImportResult> {
      const bytes = decodeBase64(input.contentBase64)
      let statement: ParsedStatement
      try {
        statement = parseXtbStatement(await readXlsx(bytes))
      } catch (error) {
        if (error instanceof XlsxError) throw new DomainError(error.message)
        throw error
      }
      const importId = await repository.replaceSnapshot(owner, statement, input.fileName, clock())
      const holdings = new Set(statement.lots.map((lot) => `${lot.symbol}|${lot.side}`)).size
      return {
        importId,
        accountNumber: statement.meta.accountNumber,
        accountCurrency: statement.meta.accountCurrency,
        reportTime: statement.meta.reportTime,
        lots: statement.lots.length,
        holdings,
        skipped: statement.skipped,
      }
    },

    async get(owner: string): Promise<PortfolioDto> {
      const [imports, lots] = await Promise.all([repository.listImports(owner), repository.listLots(owner)])
      const symbols = [...new Set(lots.flatMap((lot) => marketSymbolFor(lot.symbol) ?? []))]
      const [{ quotes, error }, rates] = await Promise.all([livePrices(symbols), lots.length ? copRates() : Promise.resolve(new Map<string, number>())])
      const { holdings, totals } = valuePortfolio(lots, quotes)
      return {
        imports,
        holdings: holdings.map((holding) => ({ ...holding })),
        totals: totals.map((total) => ({ ...total, copPerUnit: total.currency ? rates.get(total.currency) ?? null : null })),
        prices: {
          source: symbols.length ? prices.source.name : null,
          realtime: symbols.length > 0 && prices.source.realtime && quotes.size > 0,
          error,
          fetchedAt: clock().toISOString(),
        },
      }
    },

    async deleteImport(owner: string, id: string): Promise<void> {
      if (!(await repository.deleteImport(owner, id))) throw new NotFoundError('El reporte no existe.')
    },
  }
}

export type PortfolioService = ReturnType<typeof createPortfolioService>

/* ---------- HTTP (read + import only: Kaligula never trades) ---------- */

export function portfolioRoutes(service: PortfolioService) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      c.header('Cache-Control', 'no-store')
      return c.json(await service.get(c.var.owner))
    })
    .post(
      '/import',
      bodyLimit({
        maxSize: 15 * 1024 * 1024,
        onError: () => {
          throw new HttpError(413, 'payload_too_large', 'El reporte supera 10 MB.')
        },
      }),
      async (c) => c.json(await service.importStatement(c.var.owner, await readJson(c, portfolioImportInputSchema)), 201),
    )
    .delete('/imports/:id', async (c) => {
      await service.deleteImport(c.var.owner, uuidParam(c))
      return c.body(null, 204)
    })
}
