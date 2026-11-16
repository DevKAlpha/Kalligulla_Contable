export const MOVEMENT_TYPES = ['income', 'expense', 'investment', 'loan'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

/** ISO 4217. Movements are recorded in COP for now; the field exists so multi-currency can land later. */
export type CurrencyCode = 'COP'

/** Calendar date without time, `YYYY-MM-DD`. */
export type IsoDate = string

export interface Category {
  id: string
  type: MovementType
  name: string
  /** System categories ("Otro") always exist, cannot be renamed or deleted, and receive orphaned movements. */
  system: boolean
}

export interface Movement {
  id: string
  type: MovementType
  description: string
  categoryId: string
  /** Category name, resolved when reading. */
  category: string
  /** Amount in minor units (cents). Always a positive integer; `type` carries the direction. */
  amountMinor: number
  currency: CurrencyCode
  occurredOn: IsoDate
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface MovementDraft {
  type: MovementType
  description: string
  categoryId: string
  amountMinor: number
  occurredOn: IsoDate
  note?: string | null
}

export interface Goal {
  id: string
  name: string
  savedMinor: number
  targetMinor: number
  targetDate: IsoDate | null
  createdAt: string
  updatedAt: string
}

export interface GoalDraft {
  name: string
  savedMinor: number
  targetMinor: number
  targetDate?: IsoDate | null
}

export interface Profile {
  name: string
}

/* ---------- Portable snapshot: backups, CSV and migration of old local data ---------- */

/** Movements reference categories by name, so a snapshot can be restored into any database. */
export interface SnapshotMovement {
  id?: string
  type: MovementType
  description: string
  category: string
  amountMinor: number
  occurredOn: IsoDate
  note?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SnapshotGoal {
  id?: string
  name: string
  savedMinor: number
  targetMinor: number
  targetDate?: IsoDate | null
}

export interface SnapshotCategory {
  type: MovementType
  name: string
}

export interface FinanceSnapshot {
  schemaVersion: 4
  profile: Profile
  /** Custom categories (defaults are always recreated). */
  categories: SnapshotCategory[]
  goals: SnapshotGoal[]
  movements: SnapshotMovement[]
}

export function emptySnapshot(): FinanceSnapshot {
  return { schemaVersion: 4, profile: { name: '' }, categories: [], goals: [], movements: [] }
}
