import { toIsoDate } from './dates'
import { toMinor } from './money'
import { normalizeSnapshot } from './snapshot'
import { emptySnapshot, MOVEMENT_TYPES, type FinanceSnapshot, type MovementType, type SnapshotMovement } from './types'

/** localStorage key used by the original Vite/JS version (amounts in pesos, no dates). */
export const LEGACY_STORAGE_KEY = 'kaligula.finance.v2'
/** localStorage key used by the first Next.js version (amounts in cents, before the database existed). */
export const LOCAL_STORAGE_KEY_V3 = 'kaligula.finance.v3'

type Loose = Record<string, unknown>

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value.trim() : fallback)
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value))
const timestamp = (value: unknown, now: Date): string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : now.toISOString()

function fromV3(state: Loose): FinanceSnapshot {
  const snapshot = emptySnapshot()
  snapshot.profile = { name: text((state.profile as Loose | undefined)?.name).slice(0, 40) }
  const goal = state.goal as Loose | null | undefined
  if (goal && num(goal.targetMinor) > 0) {
    snapshot.goals.push({ name: text(goal.name, 'Meta de ahorro') || 'Meta de ahorro', savedMinor: Math.max(0, Math.round(num(goal.savedMinor) || 0)), targetMinor: Math.round(num(goal.targetMinor)) })
  }
  const movements = Array.isArray(state.movements) ? (state.movements as Loose[]) : []
  snapshot.movements = movements.flatMap((item): SnapshotMovement[] => {
    const type = item.type as MovementType
    const amountMinor = Math.round(num(item.amountMinor))
    const description = text(item.description).slice(0, 60)
    if (!MOVEMENT_TYPES.includes(type) || !description || !(amountMinor > 0) || typeof item.occurredOn !== 'string') return []
    return [{
      id: text(item.id) || undefined,
      type,
      description,
      category: text(item.category, 'Otro') || 'Otro',
      amountMinor,
      occurredOn: item.occurredOn,
      note: text(item.note) || null,
      createdAt: text(item.createdAt) || undefined,
      updatedAt: text(item.updatedAt) || undefined,
    }]
  })
  return snapshot
}

function fromV2(state: Loose, now: Date): FinanceSnapshot {
  const snapshot = emptySnapshot()
  snapshot.profile = { name: text((state.user as Loose | undefined)?.name).slice(0, 40) }
  const goal = state.goal as Loose | undefined
  if (goal && num(goal.target) > 0) {
    snapshot.goals.push({
      name: text(goal.name, 'Meta de ahorro').slice(0, 50) || 'Meta de ahorro',
      savedMinor: num(goal.current) > 0 ? toMinor(num(goal.current)) : 0,
      targetMinor: toMinor(num(goal.target)),
    })
  }
  const movements = Array.isArray(state.movements) ? (state.movements as Loose[]) : []
  snapshot.movements = movements.flatMap((item): SnapshotMovement[] => {
    const type = item.type as MovementType
    const amount = num(item.amount)
    const description = text(item.description).slice(0, 60)
    if (!MOVEMENT_TYPES.includes(type) || !description || !Number.isFinite(amount) || amount <= 0) return []
    const createdAt = timestamp(item.createdAt, now)
    return [{
      id: text(item.id) || undefined,
      type,
      description,
      category: text(item.category, 'Otro') || 'Otro',
      amountMinor: toMinor(amount),
      occurredOn: toIsoDate(new Date(createdAt)),
      createdAt,
      updatedAt: createdAt,
    }]
  })
  return snapshot
}

/**
 * Converts data saved in the browser by earlier versions into a validated snapshot,
 * ready to be imported into the database. Invalid entries are skipped. Returns `null`
 * when there is nothing worth importing.
 */
export function snapshotFromLocalStorage(
  stored: { v3?: string | null; v2?: string | null },
  now: Date = new Date(),
): FinanceSnapshot | null {
  let snapshot: FinanceSnapshot | null = null
  try {
    if (stored.v3) {
      const parsed = JSON.parse(stored.v3) as Loose
      const state = (parsed?.state ?? parsed) as Loose
      if (state && typeof state === 'object') snapshot = fromV3(state)
    }
    if (!snapshot && stored.v2) {
      const parsed = JSON.parse(stored.v2) as Loose
      if (parsed && typeof parsed === 'object') snapshot = fromV2(parsed, now)
    }
  } catch {
    return null
  }
  if (!snapshot || (snapshot.movements.length === 0 && snapshot.goals.length === 0)) return null
  return normalizeSnapshot(snapshot)
}
