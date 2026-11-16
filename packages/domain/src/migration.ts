import { toIsoDate } from './dates'
import { compareMovements, newId } from './movement'
import { toMinor } from './money'
import { createInitialState, MOVEMENT_TYPES, type FinanceState, type Movement, type MovementType } from './types'

/** localStorage key used by the previous Vite/JS version. */
export const LEGACY_STORAGE_KEY = 'kaligula.finance.v2'

interface LegacyMovement {
  id?: unknown
  description?: unknown
  category?: unknown
  type?: unknown
  amount?: unknown
  createdAt?: unknown
}

interface LegacyState {
  user?: { name?: unknown }
  goal?: { name?: unknown; current?: unknown; target?: unknown }
  movements?: unknown
}

const asText = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback)
const asNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value))

/**
 * Converts the v2 localStorage payload into the current schema.
 * Invalid entries are skipped instead of failing the whole migration.
 */
export function migrateLegacyState(raw: unknown, now: Date = new Date()): FinanceState {
  const state = createInitialState()
  if (!raw || typeof raw !== 'object') return state
  const legacy = raw as LegacyState

  state.profile = { name: asText(legacy.user?.name).slice(0, 40) }

  const target = asNumber(legacy.goal?.target)
  if (Number.isFinite(target) && target > 0) {
    const saved = asNumber(legacy.goal?.current)
    state.goal = {
      name: asText(legacy.goal?.name, 'Meta de ahorro').slice(0, 50) || 'Meta de ahorro',
      savedMinor: Number.isFinite(saved) && saved > 0 ? toMinor(saved) : 0,
      targetMinor: toMinor(target),
    }
  }

  const movements = Array.isArray(legacy.movements) ? (legacy.movements as LegacyMovement[]) : []
  state.movements = movements.flatMap((item): Movement[] => {
    const type = item.type as MovementType
    const amount = asNumber(item.amount)
    const description = asText(item.description).slice(0, 60)
    if (!MOVEMENT_TYPES.includes(type) || !description || !Number.isFinite(amount) || amount <= 0) return []
    const createdAt = typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt))
      ? item.createdAt
      : now.toISOString()
    return [{
      id: asText(item.id) || newId(),
      type,
      description,
      category: asText(item.category, 'Otro') || 'Otro',
      amountMinor: toMinor(amount),
      currency: 'COP',
      occurredOn: toIsoDate(new Date(createdAt)),
      createdAt,
      updatedAt: createdAt,
    }]
  }).sort(compareMovements)

  return state
}
