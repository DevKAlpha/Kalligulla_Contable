import { goalInputSchema, type GoalDto, type GoalInput } from '@kaligula/contracts'
import type { DatabaseHandle, Tables } from '@kaligula/db'
import { newId, normalizeGoal, type Goal } from '@kaligula/domain'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { readJson, uuidParam, type AppEnv } from '../../shared/http'

/* ---------- Port ---------- */

export interface GoalRepository {
  list(owner: string): Promise<Goal[]>
  find(owner: string, id: string): Promise<Goal | null>
  idExists(id: string): Promise<boolean>
  insert(owner: string, goal: Goal): Promise<void>
  update(owner: string, goal: Goal): Promise<void>
  delete(owner: string, id: string): Promise<boolean>
}

/* ---------- Drizzle adapter ---------- */

function toGoal(row: Tables['goals']['$inferSelect']): Goal {
  return {
    id: row.id,
    name: row.name,
    savedMinor: row.savedMinor,
    targetMinor: row.targetMinor,
    targetDate: row.targetDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function createDrizzleGoalRepository({ db, tables: { goals } }: Pick<DatabaseHandle, 'db' | 'tables'>): GoalRepository {
  return {
    async list(owner) {
      const rows = await db.select().from(goals).where(eq(goals.ownerId, owner)).orderBy(asc(goals.createdAt), asc(goals.id))
      return rows.map(toGoal)
    },
    async find(owner, id) {
      const [row] = await db.select().from(goals).where(and(eq(goals.ownerId, owner), eq(goals.id, id)))
      return row ? toGoal(row) : null
    },
    async idExists(id) {
      const [row] = await db.select({ id: goals.id }).from(goals).where(eq(goals.id, id))
      return Boolean(row)
    },
    async insert(owner, goal) {
      await db.insert(goals).values({ ...goal, ownerId: owner, createdAt: new Date(goal.createdAt), updatedAt: new Date(goal.updatedAt) })
    },
    async update(owner, goal) {
      const { id, createdAt: _createdAt, ...fields } = goal
      await db.update(goals).set({ ...fields, updatedAt: new Date(goal.updatedAt) }).where(and(eq(goals.ownerId, owner), eq(goals.id, id)))
    },
    async delete(owner, id) {
      const deleted = await db.delete(goals).where(and(eq(goals.ownerId, owner), eq(goals.id, id))).returning({ id: goals.id })
      return deleted.length > 0
    },
  }
}

/* ---------- Application ---------- */

export function createGoalService(repository: GoalRepository, clock: () => Date = () => new Date()) {
  return {
    list: (owner: string) => repository.list(owner),

    async create(owner: string, input: GoalInput): Promise<GoalDto> {
      const draft = normalizeGoal(input)
      const id = input.id?.toLowerCase() ?? newId()
      if (input.id && (await repository.idExists(id))) throw new ConflictError('La meta ya existe.')
      const now = clock().toISOString()
      const goal = { id, ...draft, createdAt: now, updatedAt: now }
      await repository.insert(owner, goal)
      return goal
    },

    async update(owner: string, id: string, input: GoalInput): Promise<GoalDto> {
      const existing = await repository.find(owner, id)
      if (!existing) throw new NotFoundError('La meta no existe.')
      const goal = { ...existing, ...normalizeGoal(input), updatedAt: clock().toISOString() }
      await repository.update(owner, goal)
      return goal
    },

    async remove(owner: string, id: string): Promise<void> {
      if (!(await repository.delete(owner, id))) throw new NotFoundError('La meta no existe.')
    },
  }
}

export type GoalService = ReturnType<typeof createGoalService>

/* ---------- HTTP ---------- */

export function goalRoutes(service: GoalService) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json({ items: await service.list(c.var.owner) }))
    .post('/', async (c) => c.json(await service.create(c.var.owner, await readJson(c, goalInputSchema)), 201))
    .put('/:id', async (c) => {
      const input = await readJson(c, goalInputSchema)
      return c.json(await service.update(c.var.owner, uuidParam(c), input))
    })
    .delete('/:id', async (c) => {
      await service.remove(c.var.owner, uuidParam(c))
      return c.body(null, 204)
    })
}
