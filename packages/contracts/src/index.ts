import { FX_CODES, MOVEMENT_TYPES } from '@kaligula/domain'
import { z } from 'zod'

/*
 * Wire contracts shared by the API and its clients. Shape checks live here;
 * business rules (lengths, ranges, cross-entity checks) live in @kaligula/domain and the API services.
 */

const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ offset: true })
const minor = z.number().int().safe()
const byType = z.object({ income: minor, expense: minor, investment: minor, loan: minor })

export const movementTypeSchema = z.enum(MOVEMENT_TYPES)

/* ---------- Errors ---------- */

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), field: z.string().optional() }),
})
export type ApiErrorBody = z.infer<typeof apiErrorSchema>

/* ---------- Health ---------- */

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  version: z.string(),
  time: isoDateTime,
  database: z.object({ status: z.enum(['ok', 'error']), engine: z.enum(['postgres', 'pglite']) }),
})
export type Health = z.infer<typeof healthSchema>

/* ---------- Profile ---------- */

export const profileSchema = z.object({ name: z.string() })
export const profileInputSchema = z.object({ name: z.string().max(200) })
export type ProfileDto = z.infer<typeof profileSchema>

/* ---------- Categories ---------- */

export const categorySchema = z.object({
  id: z.uuid(),
  type: movementTypeSchema,
  name: z.string(),
  system: z.boolean(),
  movementCount: z.number().int().nonnegative(),
})
export const categoryListSchema = z.object({ items: z.array(categorySchema) })
export const categoryCreateSchema = z.object({ type: movementTypeSchema, name: z.string().max(200) })
export const categoryUpdateSchema = z.object({ name: z.string().max(200) })
export type CategoryDto = z.infer<typeof categorySchema>
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>

/* ---------- Movements ---------- */

export const movementSchema = z.object({
  id: z.uuid(),
  type: movementTypeSchema,
  description: z.string(),
  categoryId: z.uuid(),
  category: z.string(),
  amountMinor: minor,
  currency: z.literal('COP'),
  occurredOn: isoDate,
  note: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})
export const movementInputSchema = z.object({
  /** Optional client-generated id: makes creates idempotent and lets "undo delete" restore the same record. */
  id: z.uuid().optional(),
  type: movementTypeSchema,
  description: z.string().max(500),
  categoryId: z.uuid(),
  amountMinor: minor,
  occurredOn: isoDate,
  note: z.string().max(2000).nullable().optional(),
})
export const movementListQuerySchema = z.object({
  type: z.string().optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : undefined))
    .pipe(z.array(movementTypeSchema).optional()),
  categoryId: z.uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export const movementPageSchema = z.object({
  items: z.array(movementSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int(),
  offset: z.number().int(),
})
export type MovementDto = z.infer<typeof movementSchema>
export type MovementInput = z.infer<typeof movementInputSchema>
export type MovementListQuery = z.input<typeof movementListQuerySchema>
export type MovementPage = z.infer<typeof movementPageSchema>

/* ---------- Goals ---------- */

export const goalSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  savedMinor: minor,
  targetMinor: minor,
  targetDate: isoDate.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})
export const goalListSchema = z.object({ items: z.array(goalSchema) })
export const goalInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().max(200),
  savedMinor: minor,
  targetMinor: minor,
  targetDate: isoDate.nullable().optional(),
})
export type GoalDto = z.infer<typeof goalSchema>
export type GoalInput = z.infer<typeof goalInputSchema>

/* ---------- Overview ---------- */

const periodSchema = z.object({ incomeMinor: minor, expenseMinor: minor, netMinor: minor })
export const overviewSchema = z.object({
  balanceMinor: minor,
  totals: byType,
  counts: byType,
  currentMonth: periodSchema,
  previousMonth: periodSchema,
  monthlyChangePct: z.number().nullable(),
  expenseRatioPct: z.number().nullable(),
  cashFlow: z.array(z.object({ key: z.string(), incomeMinor: minor, expenseMinor: minor })),
  expenseBreakdown: z.array(z.object({ category: z.string(), amountMinor: minor, count: z.number().int(), sharePct: z.number() })),
})
export type OverviewDto = z.infer<typeof overviewSchema>

/* ---------- Backup ---------- */

export const snapshotSchema = z.object({
  schemaVersion: z.literal(4),
  profile: z.object({ name: z.string().max(200) }),
  categories: z.array(z.object({ type: movementTypeSchema, name: z.string().max(200) })).max(1_000),
  goals: z.array(z.object({
    id: z.string().optional(),
    name: z.string().max(200),
    savedMinor: minor,
    targetMinor: minor,
    targetDate: isoDate.nullable().optional(),
  })).max(1_000),
  movements: z.array(z.object({
    id: z.string().optional(),
    type: movementTypeSchema,
    description: z.string().max(500),
    category: z.string().max(200),
    amountMinor: minor,
    occurredOn: isoDate,
    note: z.string().max(2000).nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })).max(100_000),
})
export const restoreResultSchema = z.object({ movements: z.number().int(), goals: z.number().int(), categories: z.number().int() })
export type RestoreResult = z.infer<typeof restoreResultSchema>

/* ---------- Market data ---------- */

/** Official Colombian exchange rate (TRM) as published by the Superintendencia Financiera. */
export const trmQuoteSchema = z.object({
  /** COP per 1 USD. */
  rate: z.number().positive(),
  currency: z.literal('COP'),
  base: z.literal('USD'),
  validFrom: isoDate,
  validTo: isoDate,
  source: z.string(),
  fetchedAt: isoDateTime,
  /** True when the upstream source failed and a cached value is being served. */
  stale: z.boolean(),
})
export type TrmQuote = z.infer<typeof trmQuoteSchema>

export const fxCurrencySchema = z.enum(FX_CODES)
export const fxQuoteSchema = z.object({
  currency: fxCurrencySchema,
  /** COP for one unit of `currency` (market mid price). */
  copPerUnit: z.number().positive(),
  /** Daily change in percent, when the source provides it. */
  changePct: z.number().nullable(),
  /** When the upstream market quote was produced. */
  asOf: isoDateTime,
})
export const fxSnapshotSchema = z.object({
  base: z.literal('COP'),
  quotes: z.array(fxQuoteSchema),
  source: z.object({ name: z.string(), url: z.url(), cadence: z.enum(['intraday', 'daily']) }),
  /** When the server last checked the source. */
  fetchedAt: isoDateTime,
  stale: z.boolean(),
})
export type FxQuote = z.infer<typeof fxQuoteSchema>
export type FxSnapshot = z.infer<typeof fxSnapshotSchema>
