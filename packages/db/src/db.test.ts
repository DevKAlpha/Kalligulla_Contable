import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate, openDatabase, type DatabaseHandle } from './client'
import { categories, goals, movements, profiles } from './schema'

describe('database', () => {
  let handle: DatabaseHandle

  beforeAll(async () => {
    handle = await openDatabase()
  })

  afterAll(async () => {
    await handle.close()
  })

  it('applies migrations once and is idempotent', async () => {
    expect(await migrate(handle.db)).toEqual(['0001_ledger', '0002_portfolio'])
    expect(await migrate(handle.db)).toEqual([])
    expect(await handle.ping()).toBe(true)
    expect(handle.engine).toBe('pglite')
  })

  it('round-trips every table through the typed schema', async () => {
    const now = new Date('2026-11-16T12:00:00.000Z')
    const categoryId = '6f4d2c1e-0b7a-4c39-9d0e-2a51f0c0a001'
    await handle.db.insert(profiles).values({ ownerId: 'local', name: 'Ana', createdAt: now, updatedAt: now })
    await handle.db.insert(categories).values({ id: categoryId, ownerId: 'local', type: 'expense', name: 'Hogar', system: false, createdAt: now, updatedAt: now })
    await handle.db.insert(movements).values({
      id: '6f4d2c1e-0b7a-4c39-9d0e-2a51f0c0a002', ownerId: 'local', type: 'expense', description: 'Arriendo',
      categoryId, amountMinor: 130_000_000, currency: 'COP', occurredOn: '2026-11-02', note: null, createdAt: now, updatedAt: now,
    })
    await handle.db.insert(goals).values({
      id: '6f4d2c1e-0b7a-4c39-9d0e-2a51f0c0a003', ownerId: 'local', name: 'Viaje', savedMinor: 0, targetMinor: 500_000,
      targetDate: '2027-06-30', createdAt: now, updatedAt: now,
    })

    const [movement] = await handle.db.select().from(movements).where(eq(movements.ownerId, 'local'))
    expect(movement).toMatchObject({ amountMinor: 130_000_000, occurredOn: '2026-11-02', currency: 'COP' })
    expect(movement.createdAt.toISOString()).toBe(now.toISOString())
    const [goal] = await handle.db.select().from(goals)
    expect(goal.targetDate).toBe('2027-06-30')
  })

  it('enforces constraints', async () => {
    await expect(handle.db.execute(sql`insert into categories (id, owner_id, type, name) values (gen_random_uuid(), 'local', 'expense', 'HOGAR')`))
      .rejects.toThrow()
    await expect(handle.db.execute(sql`delete from categories where name = 'Hogar'`)).rejects.toThrow()
  })
})
