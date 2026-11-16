import { categories, movements, type Database } from '@kaligula/db'
import { emptyByType, SYSTEM_CATEGORY_NAME, type Category, type Movement, type MovementType } from '@kaligula/domain'
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm'
import type { CategoryWithUsage, LedgerRepository, MovementQuery } from './ports'

const movementColumns = {
  id: movements.id,
  type: movements.type,
  description: movements.description,
  categoryId: movements.categoryId,
  category: categories.name,
  amountMinor: movements.amountMinor,
  currency: movements.currency,
  occurredOn: movements.occurredOn,
  note: movements.note,
  createdAt: movements.createdAt,
  updatedAt: movements.updatedAt,
}

interface MovementRow {
  id: string
  type: string
  description: string
  categoryId: string
  category: string
  amountMinor: number
  currency: string
  occurredOn: string
  note: string | null
  createdAt: Date
  updatedAt: Date
}

function toMovement(row: MovementRow): Movement {
  return {
    ...row,
    type: row.type as MovementType,
    currency: 'COP',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toCategory(row: { id: string; type: string; name: string; system: boolean; movementCount?: number }): CategoryWithUsage {
  return { id: row.id, type: row.type as MovementType, name: row.name, system: row.system, movementCount: row.movementCount ?? 0 }
}

/** Escapes LIKE wildcards so user text is matched literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

export function createDrizzleLedgerRepository(db: Database): LedgerRepository {
  const categoryUsage = {
    id: categories.id,
    type: categories.type,
    name: categories.name,
    system: categories.system,
    movementCount: count(movements.id),
  }

  function movementFilters(owner: string, query: Omit<MovementQuery, 'limit' | 'offset'>): SQL {
    const filters: (SQL | undefined)[] = [eq(movements.ownerId, owner)]
    if (query.types?.length) filters.push(inArray(movements.type, query.types))
    if (query.categoryId) filters.push(eq(movements.categoryId, query.categoryId))
    if (query.from) filters.push(gte(movements.occurredOn, query.from))
    if (query.to) filters.push(lte(movements.occurredOn, query.to))
    if (query.q) {
      const pattern = likePattern(query.q)
      filters.push(or(ilike(movements.description, pattern), ilike(movements.note, pattern), ilike(categories.name, pattern)))
    }
    return and(...filters)!
  }

  return {
    async listCategories(owner) {
      const rows = await db.select(categoryUsage).from(categories)
        .leftJoin(movements, eq(movements.categoryId, categories.id))
        .where(eq(categories.ownerId, owner))
        .groupBy(categories.id)
        .orderBy(asc(categories.type), asc(categories.system), asc(sql`lower(${categories.name})`))
      return rows.map(toCategory)
    },

    async findCategory(owner, id) {
      const [row] = await db.select(categoryUsage).from(categories)
        .leftJoin(movements, eq(movements.categoryId, categories.id))
        .where(and(eq(categories.ownerId, owner), eq(categories.id, id)))
        .groupBy(categories.id)
      return row ? toCategory(row) : null
    },

    async findCategoryByName(owner, type, name) {
      const [row] = await db.select().from(categories)
        .where(and(eq(categories.ownerId, owner), eq(categories.type, type), sql`lower(${categories.name}) = lower(${name})`))
      return row ? toCategory(row) : null
    },

    async findSystemCategory(owner, type) {
      const [row] = await db.select().from(categories)
        .where(and(eq(categories.ownerId, owner), eq(categories.type, type), eq(categories.system, true)))
      if (row) return toCategory(row)
      // Self-heal: recreate the system category if it is missing.
      const now = new Date()
      const category: Category = { id: globalThis.crypto.randomUUID(), type, name: SYSTEM_CATEGORY_NAME, system: true }
      await db.insert(categories).values({ ...category, ownerId: owner, createdAt: now, updatedAt: now }).onConflictDoNothing()
      return (await this.findCategoryByName(owner, type, SYSTEM_CATEGORY_NAME)) ?? category
    },

    async insertCategory(owner, category, now) {
      await db.insert(categories).values({ ...category, ownerId: owner, createdAt: now, updatedAt: now })
    },

    async renameCategory(owner, id, name, now) {
      await db.update(categories).set({ name, updatedAt: now }).where(and(eq(categories.ownerId, owner), eq(categories.id, id)))
    },

    async deleteCategory(owner, id, fallbackId, now) {
      return db.transaction(async (tx) => {
        const moved = await tx.update(movements)
          .set({ categoryId: fallbackId, updatedAt: now })
          .where(and(eq(movements.ownerId, owner), eq(movements.categoryId, id)))
          .returning({ id: movements.id })
        await tx.delete(categories).where(and(eq(categories.ownerId, owner), eq(categories.id, id)))
        return moved.length
      })
    },

    async listMovements(owner, query) {
      const where = movementFilters(owner, query)
      const [rows, [{ total }]] = await Promise.all([
        db.select(movementColumns).from(movements)
          .innerJoin(categories, eq(movements.categoryId, categories.id))
          .where(where)
          .orderBy(desc(movements.occurredOn), desc(movements.createdAt), desc(movements.id))
          .limit(query.limit)
          .offset(query.offset),
        db.select({ total: count() }).from(movements).innerJoin(categories, eq(movements.categoryId, categories.id)).where(where),
      ])
      return { items: rows.map(toMovement), total }
    },

    async findMovement(owner, id) {
      const [row] = await db.select(movementColumns).from(movements)
        .innerJoin(categories, eq(movements.categoryId, categories.id))
        .where(and(eq(movements.ownerId, owner), eq(movements.id, id)))
      return row ? toMovement(row) : null
    },

    async movementIdExists(id) {
      const [row] = await db.select({ id: movements.id }).from(movements).where(eq(movements.id, id))
      return Boolean(row)
    },

    async insertMovement(owner, movement) {
      await db.insert(movements).values({
        ...movement,
        ownerId: owner,
        createdAt: new Date(movement.createdAt),
        updatedAt: new Date(movement.updatedAt),
      })
    },

    async updateMovement(owner, movement) {
      const { id, createdAt: _createdAt, ...fields } = movement
      await db.update(movements)
        .set({ ...fields, updatedAt: new Date(movement.updatedAt) })
        .where(and(eq(movements.ownerId, owner), eq(movements.id, id)))
    },

    async deleteMovement(owner, id) {
      const deleted = await db.delete(movements).where(and(eq(movements.ownerId, owner), eq(movements.id, id))).returning({ id: movements.id })
      return deleted.length > 0
    },

    async totalsByType(owner) {
      const rows = await db.select({
        type: movements.type,
        total: sql<number>`coalesce(sum(${movements.amountMinor}), 0)`.mapWith(Number),
        count: count(),
      }).from(movements).where(eq(movements.ownerId, owner)).groupBy(movements.type)
      const totals = emptyByType()
      const counts = emptyByType()
      for (const row of rows) {
        totals[row.type as MovementType] = row.total
        counts[row.type as MovementType] = row.count
      }
      return { totals, counts }
    },

    async movementsSince(owner, from) {
      const rows = await db.select(movementColumns).from(movements)
        .innerJoin(categories, eq(movements.categoryId, categories.id))
        .where(and(eq(movements.ownerId, owner), gte(movements.occurredOn, from)))
        .orderBy(desc(movements.occurredOn), desc(movements.createdAt))
      return rows.map(toMovement)
    },
  }
}
