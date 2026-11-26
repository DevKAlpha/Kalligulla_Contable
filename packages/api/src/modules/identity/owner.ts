import type { DatabaseHandle, Tables } from '@kaligula/db'
import { DEFAULT_CATEGORIES, MOVEMENT_TYPES, newId, SYSTEM_CATEGORY_NAME } from '@kaligula/domain'
import type { Context } from 'hono'
import type { Executor } from '../../shared/db'

/** Owner used while the app has a single local user. Every row is already scoped by owner, so accounts can be added without a data migration. */
export const LOCAL_OWNER = 'local'

export type OwnerResolver = (c: Context) => string

export const localOwnerResolver: OwnerResolver = () => LOCAL_OWNER

/** Creates the profile and default categories of an owner. Idempotent and safe under concurrency. */
export async function seedOwner(db: Executor, { profiles, categories }: Tables, owner: string, now: Date = new Date()): Promise<void> {
  await db.insert(profiles).values({ ownerId: owner, name: '', createdAt: now, updatedAt: now }).onConflictDoNothing()
  const rows = MOVEMENT_TYPES.flatMap((type) => DEFAULT_CATEGORIES[type].map((name) => ({
    id: newId(),
    ownerId: owner,
    type,
    name,
    system: name === SYSTEM_CATEGORY_NAME,
    createdAt: now,
    updatedAt: now,
  })))
  await db.insert(categories).values(rows).onConflictDoNothing()
}

/** Seeds each owner once per process. */
export function createOwnerBootstrap({ db, tables }: Pick<DatabaseHandle, 'db' | 'tables'>, clock: () => Date) {
  const ready = new Map<string, Promise<void>>()
  return (owner: string): Promise<void> => {
    let pending = ready.get(owner)
    if (!pending) {
      pending = seedOwner(db, tables, owner, clock()).catch((error) => {
        ready.delete(owner)
        throw error
      })
      ready.set(owner, pending)
    }
    return pending
  }
}
