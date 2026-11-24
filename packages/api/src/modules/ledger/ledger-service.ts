import type { CategoryCreateInput, MovementInput } from '@kaligula/contracts'
import {
  buildOverview, compareMonths, DomainError, monthBounds, newId, normalizeCategoryName, normalizeDraft, overviewWindowStart,
  type MonthComparison, type Movement, type MovementType, type Overview,
} from '@kaligula/domain'
import { ConflictError, NotFoundError } from '../../shared/errors'
import type { CategoryWithUsage, LedgerRepository, MovementQuery } from './ports'

export interface LedgerServiceOptions {
  repository: LedgerRepository
  clock?: () => Date
}

/** Application layer: business rules for categories and movements, independent of HTTP and SQL. */
export function createLedgerService({ repository, clock = () => new Date() }: LedgerServiceOptions) {
  async function requireCategory(owner: string, id: string, type: MovementType): Promise<CategoryWithUsage> {
    const category = await repository.findCategory(owner, id)
    if (!category) throw new DomainError('La categoría no existe.', 'categoryId')
    if (category.type !== type) throw new DomainError('La categoría no corresponde al tipo de registro.', 'categoryId')
    return category
  }

  async function requireEditableCategory(owner: string, id: string): Promise<CategoryWithUsage> {
    const category = await repository.findCategory(owner, id)
    if (!category) throw new NotFoundError('La categoría no existe.')
    if (category.system) throw new ConflictError(`La categoría «${category.name}» es del sistema y no se puede modificar.`)
    return category
  }

  async function assertNameAvailable(owner: string, type: MovementType, name: string, exceptId?: string) {
    const existing = await repository.findCategoryByName(owner, type, name)
    if (existing && existing.id !== exceptId) throw new ConflictError(`Ya existe la categoría «${existing.name}».`, 'name')
  }

  return {
    listCategories: (owner: string) => repository.listCategories(owner),

    async createCategory(owner: string, input: CategoryCreateInput): Promise<CategoryWithUsage> {
      const name = normalizeCategoryName(input.name)
      await assertNameAvailable(owner, input.type, name)
      const category = { id: newId(), type: input.type, name, system: false }
      await repository.insertCategory(owner, category, clock())
      return { ...category, movementCount: 0 }
    },

    async renameCategory(owner: string, id: string, rawName: string): Promise<CategoryWithUsage> {
      const category = await requireEditableCategory(owner, id)
      const name = normalizeCategoryName(rawName)
      await assertNameAvailable(owner, category.type, name, id)
      await repository.renameCategory(owner, id, name, clock())
      return { ...category, name }
    },

    /** Deletes a custom category; its movements move to the type's system category ("Otro"). */
    async deleteCategory(owner: string, id: string): Promise<{ reassigned: number }> {
      const category = await requireEditableCategory(owner, id)
      const fallback = await repository.findSystemCategory(owner, category.type)
      return { reassigned: await repository.deleteCategory(owner, id, fallback.id, clock()) }
    },

    listMovements: (owner: string, query: MovementQuery) => repository.listMovements(owner, query),

    async getMovement(owner: string, id: string): Promise<Movement> {
      const movement = await repository.findMovement(owner, id)
      if (!movement) throw new NotFoundError('El registro no existe.')
      return movement
    },

    async createMovement(owner: string, input: MovementInput): Promise<Movement> {
      const draft = normalizeDraft(input)
      const category = await requireCategory(owner, draft.categoryId, draft.type)
      const id = input.id?.toLowerCase() ?? newId()
      if (input.id && (await repository.movementIdExists(id))) throw new ConflictError('El registro ya existe.')
      const now = clock().toISOString()
      const movement = { id, ...draft, currency: 'COP' as const, createdAt: now, updatedAt: now }
      await repository.insertMovement(owner, movement)
      return { ...movement, category: category.name }
    },

    async updateMovement(owner: string, id: string, input: MovementInput): Promise<Movement> {
      const existing = await repository.findMovement(owner, id)
      if (!existing) throw new NotFoundError('El registro no existe.')
      const draft = normalizeDraft(input)
      const category = await requireCategory(owner, draft.categoryId, draft.type)
      const { category: _previousName, ...stored } = existing
      const movement = { ...stored, ...draft, updatedAt: clock().toISOString() }
      await repository.updateMovement(owner, movement)
      return { ...movement, category: category.name }
    },

    async deleteMovement(owner: string, id: string): Promise<void> {
      if (!(await repository.deleteMovement(owner, id))) throw new NotFoundError('El registro no existe.')
    },

    async overview(owner: string): Promise<Overview> {
      const reference = clock()
      const [{ totals, counts }, recent] = await Promise.all([
        repository.totalsByType(owner),
        repository.movementsSince(owner, overviewWindowStart(6, reference)),
      ])
      return buildOverview({ totals, counts, recent, reference })
    },

    /** Spending of two months side by side (base vs target), plus the dates that have data. */
    async compareMonths(owner: string, baseKey: string, targetKey: string): Promise<MonthComparison & { range: { first: string | null; last: string | null } }> {
      const base = monthBounds(baseKey)
      const target = monthBounds(targetKey)
      const [baseMovements, targetMovements, range] = await Promise.all([
        repository.movementsBetween(owner, base.from, base.to),
        baseKey === targetKey ? Promise.resolve([]) : repository.movementsBetween(owner, target.from, target.to),
        repository.occurrenceRange(owner),
      ])
      return { ...compareMonths({ baseKey, targetKey, movements: [...baseMovements, ...targetMovements], today: clock() }), range }
    },
  }
}

export type LedgerService = ReturnType<typeof createLedgerService>
