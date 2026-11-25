import { bigint, boolean, date, doublePrecision, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/*
 * Typed view of the tables used by queries. The source of truth for DDL (constraints,
 * indexes, defaults) is `migrations.ts`; keep both in sync. The integration tests run every
 * query against a freshly migrated database, so a mismatch fails the suite.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
}

export const profiles = pgTable('profiles', {
  ownerId: text('owner_id').primaryKey(),
  name: text('name').notNull(),
  ...timestamps,
})

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  system: boolean('system').notNull(),
  ...timestamps,
})

export const movements = pgTable('movements', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  categoryId: uuid('category_id').notNull(),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  currency: text('currency').notNull(),
  occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
  note: text('note'),
  ...timestamps,
})

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  savedMinor: bigint('saved_minor', { mode: 'number' }).notNull(),
  targetMinor: bigint('target_minor', { mode: 'number' }).notNull(),
  targetDate: date('target_date', { mode: 'string' }),
  ...timestamps,
})

/** Snapshot of a broker statement (read-only portfolio). Re-importing an account replaces its snapshot. */
export const portfolioImports = pgTable('portfolio_imports', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  source: text('source').notNull(),
  accountNumber: text('account_number'),
  accountCurrency: text('account_currency'),
  fileName: text('file_name').notNull(),
  reportTime: timestamp('report_time', { withTimezone: true, mode: 'date' }),
  importedAt: timestamp('imported_at', { withTimezone: true, mode: 'date' }).notNull(),
  lotsCount: integer('lots_count').notNull(),
})

export const portfolioLots = pgTable('portfolio_lots', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  importId: uuid('import_id').notNull(),
  externalId: text('external_id'),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  side: text('side').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  openPrice: doublePrecision('open_price').notNull(),
  openTime: timestamp('open_time', { withTimezone: true, mode: 'date' }),
  reportPrice: doublePrecision('report_price'),
  reportValue: doublePrecision('report_value'),
  reportGrossProfit: doublePrecision('report_gross_profit'),
})

export const schema = { profiles, categories, movements, goals, portfolioImports, portfolioLots }
