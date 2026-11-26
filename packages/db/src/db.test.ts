import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate, openDatabase, type DatabaseHandle, type OpenDatabaseOptions } from './client'

const ENGINES: [string, OpenDatabaseOptions][] = [
  ['pglite', {}],
  ['sqlite', { sqliteFile: ':memory:' }],
]

describe.each(ENGINES)('database (%s)', (engine, options) => {
  let handle: DatabaseHandle

  beforeAll(async () => {
    handle = await openDatabase(options)
  })

  afterAll(async () => {
    await handle.close()
  })

  it('applies migrations once and is idempotent', async () => {
    expect(await migrate(handle)).toEqual(['0001_ledger', '0002_portfolio'])
    expect(await migrate(handle)).toEqual([])
    expect(await handle.ping()).toBe(true)
    expect(handle.engine).toBe(engine)
  })

  it('round-trips every table through the typed schema', async () => {
    const { db, tables: { profiles, categories, movements, goals } } = handle
    const now = new Date('2026-11-16T12:00:00.000Z')
    const categoryId = '6f4d2c1e-0b7a-4c39-9d0e-2a51f0c0a001'
    await db.insert(profiles).values({ ownerId: 'local', name: 'Ana', createdAt: now, updatedAt: now })
    await db.insert(categories).values({ id: categoryId, ownerId: 'local', type: 'expense', name: 'Educación', system: false, createdAt: now, updatedAt: now })
    await db.insert(movements).values({
      id: '6f4d2c1e-0b7a-4c39-9d0e-2a51f0c0a002', ownerId: 'local', type: 'expense', description: 'Matrícula',
      categoryId, amountMinor: 130_000_000, currency: 'COP', occurredOn: '2026-11-02', note: null, createdAt: now, updatedAt: now,
    })
    await db.insert(goals).values({
      id: '6f4d2c1e-0b7a-4c39-9d0e-2a51f0c0a003', ownerId: 'local', name: 'Viaje', savedMinor: 0, targetMinor: 500_000,
      targetDate: '2027-06-30', createdAt: now, updatedAt: now,
    })

    const [movement] = await db.select().from(movements).where(eq(movements.ownerId, 'local'))
    expect(movement).toMatchObject({ amountMinor: 130_000_000, occurredOn: '2026-11-02', currency: 'COP', note: null })
    expect(movement.createdAt.toISOString()).toBe(now.toISOString())
    const [category] = await db.select().from(categories)
    expect(category.system).toBe(false)
    const [goal] = await db.select().from(goals)
    expect(goal.targetDate).toBe('2027-06-30')
  })

  it('enforces constraints: unique name ignoring case and accents case, and movements keep their category', async () => {
    const { db, tables: { categories } } = handle
    const now = new Date()
    await expect(db.insert(categories).values({
      id: '6f4d2c1e-0b7a-4c39-9d0e-2a51f0c0a009', ownerId: 'local', type: 'expense', name: 'EDUCACIÓN', system: false, createdAt: now, updatedAt: now,
    })).rejects.toThrow()
    await expect(db.delete(categories).where(eq(categories.name, 'Educación'))).rejects.toThrow()
  })

  it('rolls back a failed transaction and keeps serving other queries', async () => {
    const { db, tables: { goals } } = handle
    await expect(db.transaction(async (tx) => {
      await tx.update(goals).set({ name: 'Cambiado' })
      throw new Error('boom')
    })).rejects.toThrow('boom')
    const [goal] = await db.select().from(goals)
    expect(goal.name).toBe('Viaje')
  })
})
