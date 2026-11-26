import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/*
 * SQLite twin of `schema.ts` (desktop app). Same table and property names, so repositories run
 * unchanged on either engine; only the storage types differ:
 *   uuid/date -> text · timestamptz -> integer milliseconds · bigint -> integer · boolean -> 0/1 ·
 *   double precision -> real.
 * DDL lives in `SQLITE_MIGRATIONS`; the integration tests run every query on both engines.
 */

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}

export const profiles = sqliteTable('profiles', {
  ownerId: text('owner_id').primaryKey(),
  name: text('name').notNull(),
  ...timestamps,
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  system: integer('system', { mode: 'boolean' }).notNull(),
  ...timestamps,
})

export const movements = sqliteTable('movements', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  categoryId: text('category_id').notNull(),
  amountMinor: integer('amount_minor', { mode: 'number' }).notNull(),
  currency: text('currency').notNull(),
  occurredOn: text('occurred_on').notNull(),
  note: text('note'),
  ...timestamps,
})

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  savedMinor: integer('saved_minor', { mode: 'number' }).notNull(),
  targetMinor: integer('target_minor', { mode: 'number' }).notNull(),
  targetDate: text('target_date'),
  ...timestamps,
})

export const portfolioImports = sqliteTable('portfolio_imports', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  source: text('source').notNull(),
  accountNumber: text('account_number'),
  accountCurrency: text('account_currency'),
  fileName: text('file_name').notNull(),
  reportTime: integer('report_time', { mode: 'timestamp_ms' }),
  importedAt: integer('imported_at', { mode: 'timestamp_ms' }).notNull(),
  lotsCount: integer('lots_count').notNull(),
})

export const portfolioLots = sqliteTable('portfolio_lots', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  importId: text('import_id').notNull(),
  externalId: text('external_id'),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  side: text('side').notNull(),
  quantity: real('quantity').notNull(),
  openPrice: real('open_price').notNull(),
  openTime: integer('open_time', { mode: 'timestamp_ms' }),
  reportPrice: real('report_price'),
  reportValue: real('report_value'),
  reportGrossProfit: real('report_gross_profit'),
})

export const sqliteSchema = { profiles, categories, movements, goals, portfolioImports, portfolioLots }
