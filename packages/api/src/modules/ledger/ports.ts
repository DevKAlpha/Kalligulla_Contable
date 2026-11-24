import type { Category, IsoDate, Movement, MovementType } from '@kaligula/domain'

export interface CategoryWithUsage extends Category {
  movementCount: number
}

export interface MovementQuery {
  types?: MovementType[]
  categoryId?: string
  from?: IsoDate
  to?: IsoDate
  q?: string
  limit: number
  offset: number
}

/** Movement as stored (the category name is resolved on read). */
export type StoredMovement = Omit<Movement, 'category'>

/** Port: persistence of categories and movements. */
export interface LedgerRepository {
  listCategories(owner: string): Promise<CategoryWithUsage[]>
  findCategory(owner: string, id: string): Promise<CategoryWithUsage | null>
  findCategoryByName(owner: string, type: MovementType, name: string): Promise<Category | null>
  findSystemCategory(owner: string, type: MovementType): Promise<Category>
  insertCategory(owner: string, category: Category, now: Date): Promise<void>
  renameCategory(owner: string, id: string, name: string, now: Date): Promise<void>
  /** Moves the category's movements to `fallbackId`, deletes it, and returns how many movements moved. */
  deleteCategory(owner: string, id: string, fallbackId: string, now: Date): Promise<number>

  listMovements(owner: string, query: MovementQuery): Promise<{ items: Movement[]; total: number }>
  findMovement(owner: string, id: string): Promise<Movement | null>
  /** True when the id is used by any owner (ids are globally unique). */
  movementIdExists(id: string): Promise<boolean>
  insertMovement(owner: string, movement: StoredMovement): Promise<void>
  updateMovement(owner: string, movement: StoredMovement): Promise<void>
  deleteMovement(owner: string, id: string): Promise<boolean>

  totalsByType(owner: string): Promise<{ totals: Record<MovementType, number>; counts: Record<MovementType, number> }>
  movementsSince(owner: string, from: IsoDate): Promise<Movement[]>
  /** Every movement between two dates, inclusive. */
  movementsBetween(owner: string, from: IsoDate, to: IsoDate): Promise<Movement[]>
  /** Dates of the oldest and newest movement. */
  occurrenceRange(owner: string): Promise<{ first: IsoDate | null; last: IsoDate | null }>
}
