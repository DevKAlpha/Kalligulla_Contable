import type { CategoryDto, GoalDto, MovementPage, ProfileDto } from '@kaligula/contracts'
import { goalSchema } from '@kaligula/contracts'
import { emptySnapshot, type FinanceSnapshot } from '@kaligula/domain'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './test-support'

let api: TestApp

beforeAll(async () => {
  api = await createTestApp()
})

beforeEach(() => {
  api.useOwner(globalThis.crypto.randomUUID())
})

afterAll(async () => {
  await api.close()
})

describe('profile', () => {
  it('reads and updates the profile', async () => {
    expect((await api.json<ProfileDto>('GET', '/api/profile')).body).toEqual({ name: '' })
    expect((await api.json<ProfileDto>('PUT', '/api/profile', { name: '  Nicolás   Rodríguez ' })).body).toEqual({ name: 'Nicolás Rodríguez' })
    expect((await api.json<ProfileDto>('GET', '/api/profile')).body.name).toBe('Nicolás Rodríguez')
    expect((await api.json('PUT', '/api/profile', { name: 'x'.repeat(41) })).status).toBe(400)
  })
})

describe('goals CRUD', () => {
  it('supports several goals with optional target dates', async () => {
    const created = await api.json<GoalDto>('POST', '/api/goals', { name: 'Fondo de emergencia', savedMinor: 0, targetMinor: 1_200_000_000 })
    expect(created.status).toBe(201)
    expect(goalSchema.parse(created.body)).toMatchObject({ targetDate: null })
    await api.json('POST', '/api/goals', { name: 'Viaje', savedMinor: 10_000, targetMinor: 500_000, targetDate: '2027-06-30' })

    const updated = await api.json<GoalDto>('PUT', `/api/goals/${created.body.id}`, { name: 'Fondo', savedMinor: 350_000_000, targetMinor: 1_200_000_000, targetDate: '2027-12-31' })
    expect(updated.body).toMatchObject({ name: 'Fondo', savedMinor: 350_000_000, targetDate: '2027-12-31', createdAt: created.body.createdAt })

    const list = await api.json<{ items: GoalDto[] }>('GET', '/api/goals')
    // Same clock tick in tests: compare as a set (production orders by creation time).
    expect(list.body.items.map((goal) => goal.name).sort()).toEqual(['Fondo', 'Viaje'])

    expect((await api.request('DELETE', `/api/goals/${created.body.id}`)).status).toBe(204)
    expect((await api.request('PUT', `/api/goals/${created.body.id}`, { name: 'x', savedMinor: 0, targetMinor: 1 })).status).toBe(404)
  })

  it('validates goals', async () => {
    const { status, body } = await api.json<{ error: { field: string } }>('POST', '/api/goals', { name: 'x', savedMinor: -1, targetMinor: 10 })
    expect(status).toBe(400)
    expect(body.error.field).toBe('saved')
  })
})

describe('backup', () => {
  const snapshot: FinanceSnapshot = {
    ...emptySnapshot(),
    profile: { name: 'Ana' },
    categories: [{ type: 'expense', name: 'Mascotas' }],
    goals: [{ id: '11111111-2222-4333-8444-555555555555', name: 'Viaje', savedMinor: 10_000, targetMinor: 90_000, targetDate: '2027-01-31' }],
    movements: [
      { id: '99999999-2222-4333-8444-555555555555', type: 'expense', description: 'Concentrado', category: 'Mascotas', amountMinor: 350_050, occurredOn: '2026-11-14', note: 'Bulto', createdAt: '2026-11-14T12:00:00.000Z', updatedAt: '2026-11-14T12:00:00.000Z' },
      { type: 'income', description: 'Salario', category: 'Salario', amountMinor: 400_000_000, occurredOn: '2026-11-01', note: null },
      { id: 'legacy-id', type: 'expense', description: 'Regalo', category: 'Detalles', amountMinor: 1_000, occurredOn: '2026-10-01' },
    ],
  }

  it('restores a snapshot atomically and exports it back', async () => {
    await api.json('POST', '/api/goals', { name: 'Se borrará', savedMinor: 0, targetMinor: 1 })
    const restored = await api.json('POST', '/api/backup/restore', snapshot)
    expect(restored).toEqual({ status: 200, body: { movements: 3, goals: 1, categories: 2 } })

    const page = await api.json<MovementPage>('GET', '/api/movements')
    expect(page.body.total).toBe(3)
    expect(page.body.items.map((item) => item.category)).toEqual(['Mascotas', 'Salario', 'Detalles'])
    const goals = await api.json<{ items: GoalDto[] }>('GET', '/api/goals')
    expect(goals.body.items.map((goal) => goal.id)).toEqual(['11111111-2222-4333-8444-555555555555'])

    const exported = await api.json<FinanceSnapshot>('GET', '/api/backup')
    expect(exported.body.profile).toEqual({ name: 'Ana' })
    expect(exported.body.categories).toEqual([{ type: 'expense', name: 'Detalles' }, { type: 'expense', name: 'Mascotas' }])
    expect(exported.body.movements[0]).toMatchObject({ id: '99999999-2222-4333-8444-555555555555', note: 'Bulto', createdAt: '2026-11-14T12:00:00.000Z' })

    const categories = await api.json<{ items: CategoryDto[] }>('GET', '/api/categories')
    expect(categories.body.items.find((category) => category.name === 'Mascotas')?.movementCount).toBe(1)
  })

  it('rejects invalid snapshots without touching existing data', async () => {
    await api.json('POST', '/api/goals', { name: 'Intacta', savedMinor: 0, targetMinor: 1 })
    const broken = { ...snapshot, movements: [{ ...snapshot.movements[0], occurredOn: '2026-02-30' }] }
    expect((await api.json('POST', '/api/backup/restore', broken)).status).toBe(400)
    const bad = { ...snapshot, movements: [{ ...snapshot.movements[0], description: ' ' }] }
    const response = await api.json<{ error: { message: string } }>('POST', '/api/backup/restore', bad)
    expect(response.status).toBe(400)
    expect(response.body.error.message).toMatch(/Registro 1/)
    expect((await api.json<{ items: GoalDto[] }>('GET', '/api/goals')).body.items.map((goal) => goal.name)).toEqual(['Intacta'])
  })
})
