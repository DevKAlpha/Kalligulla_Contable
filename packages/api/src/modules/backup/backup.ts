import { restoreResultSchema, snapshotSchema, type RestoreResult } from '@kaligula/contracts'
import type { DatabaseHandle, Tables } from '@kaligula/db'
import {
  categoryKey, isDefaultCategory, newId, normalizeSnapshot,
  type FinanceSnapshot, type MovementType,
} from '@kaligula/domain'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { chunk, type Executor } from '../../shared/db'
import { HttpError } from '../../shared/errors'
import { readJson, type AppEnv } from '../../shared/http'
import { seedOwner } from '../identity/owner'

/* ---------- Port ---------- */

export interface SnapshotStore {
  export(owner: string): Promise<FinanceSnapshot>
  /** Atomically replaces every record of the owner with the snapshot. */
  replace(owner: string, snapshot: FinanceSnapshot, now: Date): Promise<RestoreResult>
}

/* ---------- Drizzle adapter ---------- */

/** Ids are globally unique: drop the ones already used by other owners so the insert cannot collide. */
async function freeIds(tx: Executor, table: Tables['movements'] | Tables['goals'], ids: string[]): Promise<Set<string>> {
  const taken = new Set<string>()
  for (const part of chunk(ids)) {
    const rows = await tx.select({ id: table.id }).from(table).where(inArray(table.id, part))
    rows.forEach((row) => taken.add(row.id))
  }
  return taken
}

export function createDrizzleSnapshotStore({ db, tables }: Pick<DatabaseHandle, 'db' | 'tables'>): SnapshotStore {
  const { profiles, categories, goals, movements } = tables
  return {
    async export(owner) {
      const [[profile], categoryRows, goalRows, movementRows] = await Promise.all([
        db.select({ name: profiles.name }).from(profiles).where(eq(profiles.ownerId, owner)),
        db.select().from(categories).where(eq(categories.ownerId, owner)).orderBy(asc(categories.type), asc(categories.name)),
        db.select().from(goals).where(eq(goals.ownerId, owner)).orderBy(asc(goals.createdAt)),
        db.select({ movement: movements, category: categories.name }).from(movements)
          .innerJoin(categories, eq(movements.categoryId, categories.id))
          .where(eq(movements.ownerId, owner))
          .orderBy(desc(movements.occurredOn), desc(movements.createdAt)),
      ])
      return {
        schemaVersion: 4,
        profile: { name: profile?.name ?? '' },
        categories: categoryRows
          .map((row) => ({ type: row.type as MovementType, name: row.name }))
          .filter((category) => !isDefaultCategory(category)),
        goals: goalRows.map((row) => ({ id: row.id, name: row.name, savedMinor: row.savedMinor, targetMinor: row.targetMinor, targetDate: row.targetDate })),
        movements: movementRows.map(({ movement, category }) => ({
          id: movement.id,
          type: movement.type as MovementType,
          description: movement.description,
          category,
          amountMinor: movement.amountMinor,
          occurredOn: movement.occurredOn,
          note: movement.note,
          createdAt: movement.createdAt.toISOString(),
          updatedAt: movement.updatedAt.toISOString(),
        })),
      }
    },

    async replace(owner, snapshot, now) {
      return db.transaction(async (tx) => {
        await tx.delete(movements).where(eq(movements.ownerId, owner))
        await tx.delete(goals).where(eq(goals.ownerId, owner))
        await tx.delete(categories).where(eq(categories.ownerId, owner))
        await seedOwner(tx, tables, owner, now)
        await tx.update(profiles).set({ name: snapshot.profile.name, updatedAt: now }).where(eq(profiles.ownerId, owner))

        if (snapshot.categories.length) {
          await tx.insert(categories).values(snapshot.categories.map((category) => ({
            id: newId(), ownerId: owner, type: category.type, name: category.name, system: false, createdAt: now, updatedAt: now,
          }))).onConflictDoNothing()
        }
        const categoryIds = new Map(
          (await tx.select().from(categories).where(eq(categories.ownerId, owner)))
            .map((row) => [categoryKey(row.type as MovementType, row.name), row.id]),
        )

        const takenGoals = await freeIds(tx, goals, snapshot.goals.flatMap((goal) => (goal.id ? [goal.id] : [])))
        for (const part of chunk(snapshot.goals)) {
          await tx.insert(goals).values(part.map((goal) => ({
            id: goal.id && !takenGoals.has(goal.id) ? goal.id : newId(),
            ownerId: owner,
            name: goal.name,
            savedMinor: goal.savedMinor,
            targetMinor: goal.targetMinor,
            targetDate: goal.targetDate ?? null,
            createdAt: now,
            updatedAt: now,
          })))
        }

        const takenMovements = await freeIds(tx, movements, snapshot.movements.flatMap((movement) => (movement.id ? [movement.id] : [])))
        for (const part of chunk(snapshot.movements)) {
          await tx.insert(movements).values(part.map((movement) => {
            const categoryId = categoryIds.get(categoryKey(movement.type, movement.category))
            if (!categoryId) throw new Error(`Missing category ${movement.type}/${movement.category}`)
            const createdAt = movement.createdAt ? new Date(movement.createdAt) : now
            return {
              id: movement.id && !takenMovements.has(movement.id) ? movement.id : newId(),
              ownerId: owner,
              type: movement.type,
              description: movement.description,
              categoryId,
              amountMinor: movement.amountMinor,
              currency: 'COP',
              occurredOn: movement.occurredOn,
              note: movement.note ?? null,
              createdAt,
              updatedAt: movement.updatedAt ? new Date(movement.updatedAt) : createdAt,
            }
          }))
        }

        return restoreResultSchema.parse({
          movements: snapshot.movements.length,
          goals: snapshot.goals.length,
          categories: snapshot.categories.length,
        })
      })
    },
  }
}

/* ---------- HTTP ---------- */

const MAX_BACKUP_BYTES = 20 * 1024 * 1024

export function backupRoutes(store: SnapshotStore, clock: () => Date) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      c.header('Cache-Control', 'no-store')
      return c.json(await store.export(c.var.owner))
    })
    .post(
      '/restore',
      bodyLimit({
        maxSize: MAX_BACKUP_BYTES,
        onError: () => {
          throw new HttpError(413, 'payload_too_large', 'El respaldo supera 20 MB.')
        },
      }),
      async (c) => {
        const snapshot = normalizeSnapshot(await readJson(c, snapshotSchema))
        return c.json(await store.replace(c.var.owner, snapshot, clock()))
      },
    )
}
