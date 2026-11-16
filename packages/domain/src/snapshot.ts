import { categoryKey, DEFAULT_CATEGORIES, normalizeCategoryName, SYSTEM_CATEGORY_NAME } from './categories'
import { DomainError } from './errors'
import { normalizeGoal } from './goal'
import { compareMovements, isUuid, normalizeDraft } from './movement'
import { normalizeProfile } from './profile'
import { MOVEMENT_TYPES, type FinanceSnapshot, type SnapshotCategory, type SnapshotGoal, type SnapshotMovement } from './types'

const isTimestamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value))

function withLine<T>(label: string, run: () => T): T {
  try {
    return run()
  } catch (error) {
    if (error instanceof DomainError) throw new DomainError(`${label}: ${error.message}`, error.field)
    throw error
  }
}

/** True when the category is created automatically for every owner. */
export function isDefaultCategory(category: SnapshotCategory): boolean {
  const key = categoryKey(category.type, category.name)
  return DEFAULT_CATEGORIES[category.type].some((name) => categoryKey(category.type, name) === key)
}

/**
 * Validates a snapshot from any source (CSV, old local data, API) and returns a clean copy:
 * trimmed text, valid amounts and dates, UUID ids only (others are dropped so the server assigns new ones),
 * no duplicate ids, and every category used by a movement listed exactly once.
 */
export function normalizeSnapshot(snapshot: FinanceSnapshot): FinanceSnapshot {
  if (!snapshot || snapshot.schemaVersion !== 4) throw new DomainError('El respaldo no tiene un formato compatible.')

  const categories = new Map<string, SnapshotCategory>()
  const addCategory = (category: SnapshotCategory) => {
    if (!MOVEMENT_TYPES.includes(category.type)) throw new DomainError('Tipo de categoría desconocido.', 'type')
    const name = normalizeCategoryName(category.name || SYSTEM_CATEGORY_NAME)
    const key = categoryKey(category.type, name)
    if (!categories.has(key)) categories.set(key, { type: category.type, name })
    return categories.get(key)!.name
  }
  snapshot.categories.forEach((category, index) => withLine(`Categoría ${index + 1}`, () => addCategory(category)))

  const ids = new Set<string>()
  const uniqueId = (id: unknown) => {
    if (!isUuid(id) || ids.has(id.toLowerCase())) return undefined
    ids.add(id.toLowerCase())
    return id.toLowerCase()
  }

  const movements = snapshot.movements.map((movement, index): SnapshotMovement => withLine(`Registro ${index + 1}`, () => {
    const category = addCategory({ type: movement.type, name: movement.category })
    const clean = normalizeDraft({ ...movement, categoryId: category })
    const createdAt = isTimestamp(movement.createdAt) ? new Date(movement.createdAt).toISOString() : undefined
    const updatedAt = isTimestamp(movement.updatedAt) ? new Date(movement.updatedAt).toISOString() : createdAt
    return {
      id: uniqueId(movement.id),
      type: clean.type,
      description: clean.description,
      category,
      amountMinor: clean.amountMinor,
      occurredOn: clean.occurredOn,
      note: clean.note,
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    }
  }))
  movements.sort((a, b) => compareMovements(
    { occurredOn: a.occurredOn, createdAt: a.createdAt ?? '' },
    { occurredOn: b.occurredOn, createdAt: b.createdAt ?? '' },
  ))

  const goals = snapshot.goals.map((goal, index): SnapshotGoal => withLine(`Meta ${index + 1}`, () => ({
    id: uniqueId(goal.id),
    ...normalizeGoal(goal),
  })))

  return {
    schemaVersion: 4,
    profile: normalizeProfile(snapshot.profile ?? { name: '' }),
    categories: [...categories.values()].filter((category) => !isDefaultCategory(category)),
    goals,
    movements,
  }
}
