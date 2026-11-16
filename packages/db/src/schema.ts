import { bigint, boolean, date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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

export const schema = { profiles, categories, movements, goals }
