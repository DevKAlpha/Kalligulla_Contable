export const MOVEMENT_TYPES = ['income', 'expense', 'investment', 'loan'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

/** ISO 4217. Only COP is supported for now; the field exists so multi-currency can land later. */
export type CurrencyCode = 'COP'

/** Calendar date without time, `YYYY-MM-DD`. */
export type IsoDate = string

export interface Movement {
  id: string
  type: MovementType
  description: string
  category: string
  /** Amount in minor units (cents). Always a positive integer; `type` carries the direction. */
  amountMinor: number
  currency: CurrencyCode
  occurredOn: IsoDate
  note?: string
  createdAt: string
  updatedAt: string
}

export interface MovementDraft {
  type: MovementType
  description: string
  category: string
  amountMinor: number
  occurredOn: IsoDate
  note?: string
}

export interface SavingsGoal {
  name: string
  savedMinor: number
  targetMinor: number
}

export interface Profile {
  name: string
}

export interface FinanceState {
  schemaVersion: 3
  profile: Profile
  goal: SavingsGoal | null
  movements: Movement[]
}

export function createInitialState(): FinanceState {
  return { schemaVersion: 3, profile: { name: '' }, goal: null, movements: [] }
}
