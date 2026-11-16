import type { CategoryDto, MovementDto, MovementPage, OverviewDto } from '@kaligula/contracts'
import { categorySchema, movementPageSchema, movementSchema, overviewSchema } from '@kaligula/contracts'
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

async function categoriesOf(type: string): Promise<CategoryDto[]> {
  const { body } = await api.json<{ items: CategoryDto[] }>('GET', '/api/categories')
  return body.items.filter((category) => category.type === type)
}

async function categoryId(type: string, name: string): Promise<string> {
  const found = (await categoriesOf(type)).find((category) => category.name === name)
  if (!found) throw new Error(`missing ${type}/${name}`)
  return found.id
}

async function createMovement(overrides: Record<string, unknown> = {}): Promise<MovementDto> {
  const { status, body } = await api.json<MovementDto>('POST', '/api/movements', {
    type: 'expense',
    description: 'Mercado',
    categoryId: overrides.categoryId ?? (await categoryId(String(overrides.type ?? 'expense'), 'Alimentación')),
    amountMinor: 5_000_000,
    occurredOn: '2026-11-10',
    ...overrides,
  })
  expect(status).toBe(201)
  return movementSchema.parse(body)
}

describe('categories CRUD', () => {
  it('seeds default categories with a system "Otro" per type', async () => {
    const { body } = await api.json<{ items: CategoryDto[] }>('GET', '/api/categories')
    body.items.forEach((item) => categorySchema.parse(item))
    expect(body.items.filter((category) => category.system).map((category) => category.type).sort())
      .toEqual(['expense', 'income', 'investment', 'loan'])
    expect((await categoriesOf('expense')).map((category) => category.name)).toContain('Café y snacks')
  })

  it('creates, renames and deletes custom categories, moving their movements to "Otro"', async () => {
    const created = await api.json<CategoryDto>('POST', '/api/categories', { type: 'expense', name: '  Mascotas ' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Mascotas', system: false, movementCount: 0 })

    const duplicate = await api.json('POST', '/api/categories', { type: 'expense', name: 'MASCOTAS' })
    expect(duplicate.status).toBe(409)

    const renamed = await api.json<CategoryDto>('PATCH', `/api/categories/${created.body.id}`, { name: 'Mascotas y vet' })
    expect(renamed.body.name).toBe('Mascotas y vet')

    const movement = await createMovement({ categoryId: created.body.id, description: 'Concentrado' })
    expect(movement.category).toBe('Mascotas y vet')

    const removed = await api.json<{ reassigned: number }>('DELETE', `/api/categories/${created.body.id}`)
    expect(removed.body).toEqual({ reassigned: 1 })
    const after = await api.json<MovementDto>('GET', `/api/movements/${movement.id}`)
    expect(after.body.category).toBe('Otro')
  })

  it('protects system categories', async () => {
    const other = await categoryId('expense', 'Otro')
    expect((await api.json('PATCH', `/api/categories/${other}`, { name: 'Varios' })).status).toBe(409)
    expect((await api.json('DELETE', `/api/categories/${other}`)).status).toBe(409)
  })
})

describe('movements CRUD', () => {
  it('creates, reads, updates and deletes a movement', async () => {
    const created = await createMovement({ description: '  Mercado   semanal ', note: '  ' })
    expect(created).toMatchObject({ description: 'Mercado semanal', note: null, amountMinor: 5_000_000, category: 'Alimentación' })

    const read = await api.json<MovementDto>('GET', `/api/movements/${created.id}`)
    expect(read.body).toEqual(created)

    const updated = await api.json<MovementDto>('PUT', `/api/movements/${created.id}`, {
      type: 'income',
      description: 'Venta bicicleta',
      categoryId: await categoryId('income', 'Ventas'),
      amountMinor: 80_000_000,
      occurredOn: '2026-11-12',
      note: 'Usada',
    })
    expect(updated.status).toBe(200)
    expect(updated.body).toMatchObject({ type: 'income', category: 'Ventas', note: 'Usada', createdAt: created.createdAt })

    expect((await api.request('DELETE', `/api/movements/${created.id}`)).status).toBe(204)
    expect((await api.request('GET', `/api/movements/${created.id}`)).status).toBe(404)
    expect((await api.request('DELETE', `/api/movements/${created.id}`)).status).toBe(404)
  })

  it('restores a deleted movement with the same id (undo)', async () => {
    const created = await createMovement()
    await api.request('DELETE', `/api/movements/${created.id}`)
    const restored = await api.json<MovementDto>('POST', '/api/movements', { ...created, category: undefined, currency: undefined, createdAt: undefined, updatedAt: undefined })
    expect(restored.status).toBe(201)
    expect(restored.body.id).toBe(created.id)
    expect((await api.json('POST', '/api/movements', { ...created, category: undefined, currency: undefined, createdAt: undefined, updatedAt: undefined })).status).toBe(409)
  })

  it('validates input with field-level errors', async () => {
    const expense = await categoryId('expense', 'Hogar')
    const income = await categoryId('income', 'Salario')
    const base = { type: 'expense', description: 'x', categoryId: expense, amountMinor: 100, occurredOn: '2026-11-01' }

    const cases: [Record<string, unknown>, string][] = [
      [{ description: '   ' }, 'description'],
      [{ amountMinor: 0 }, 'amount'],
      [{ amountMinor: 1.5 }, 'amountMinor'],
      [{ occurredOn: '2026-02-30' }, 'occurredOn'],
      [{ categoryId: income }, 'categoryId'],
      [{ categoryId: '00000000-0000-4000-8000-000000000000' }, 'categoryId'],
      [{ type: 'gift' }, 'type'],
    ]
    for (const [override, field] of cases) {
      const { status, body } = await api.json<{ error: { field?: string } }>('POST', '/api/movements', { ...base, ...override })
      expect(status, JSON.stringify(override)).toBe(400)
      expect(body.error.field, JSON.stringify(override)).toBe(field)
    }
  })

  it('lists with filters, search and pagination', async () => {
    await createMovement({ description: 'Arriendo', categoryId: await categoryId('expense', 'Hogar'), occurredOn: '2026-10-02', amountMinor: 130_000_000 })
    await createMovement({ description: 'Tinto 100%_cafe', categoryId: await categoryId('expense', 'Café y snacks'), occurredOn: '2026-11-12', amountMinor: 850_000 })
    await createMovement({ type: 'income', description: 'Salario', categoryId: await categoryId('income', 'Salario'), occurredOn: '2026-11-01', amountMinor: 420_000_000 })
    await createMovement({ type: 'investment', description: 'ETF VOO', categoryId: await categoryId('investment', 'ETF'), occurredOn: '2026-11-05', amountMinor: 80_000_000 })

    const list = async (query: string) => movementPageSchema.parse((await api.json<MovementPage>('GET', `/api/movements${query}`)).body)

    const all = await list('')
    expect(all.total).toBe(4)
    expect(all.items.map((item) => item.occurredOn)).toEqual(['2026-11-12', '2026-11-05', '2026-11-01', '2026-10-02'])

    expect((await list('?type=income,expense')).total).toBe(3)
    expect((await list('?from=2026-11-01&to=2026-11-30')).total).toBe(3)
    expect((await list(`?categoryId=${await categoryId('expense', 'Hogar')}`)).items[0].description).toBe('Arriendo')
    expect((await list('?q=hogar')).total).toBe(1)
    expect((await list('?q=100%25_')).items.map((item) => item.description)).toEqual(['Tinto 100%_cafe'])
    expect((await list('?q=%25')).total).toBe(1)

    const page = await list('?limit=2&offset=2')
    expect(page).toMatchObject({ total: 4, limit: 2, offset: 2 })
    expect(page.items).toHaveLength(2)

    expect((await api.request('GET', '/api/movements?limit=500')).status).toBe(400)
    expect((await api.request('GET', '/api/movements?type=gift')).status).toBe(400)
  })
})

describe('overview', () => {
  it('derives balances, monthly figures and breakdown from stored movements', async () => {
    await createMovement({ type: 'income', description: 'Salario', categoryId: await categoryId('income', 'Salario'), occurredOn: '2026-11-01', amountMinor: 400_000_000 })
    await createMovement({ description: 'Mercado', occurredOn: '2026-11-05', amountMinor: 100_000_000 })
    await createMovement({ type: 'income', description: 'Salario', categoryId: await categoryId('income', 'Salario'), occurredOn: '2026-10-01', amountMinor: 300_000_000 })
    await createMovement({ description: 'Arriendo', categoryId: await categoryId('expense', 'Hogar'), occurredOn: '2026-10-08', amountMinor: 200_000_000 })
    await createMovement({ description: 'Viaje viejo', occurredOn: '2025-01-08', amountMinor: 10_000 })

    const { body } = await api.json<OverviewDto>('GET', '/api/overview')
    const overview = overviewSchema.parse(body)
    expect(overview.balanceMinor).toBe(700_000_000 - 300_010_000)
    expect(overview.counts.expense).toBe(3)
    expect(overview.currentMonth).toEqual({ incomeMinor: 400_000_000, expenseMinor: 100_000_000, netMinor: 300_000_000 })
    expect(overview.monthlyChangePct).toBe(200)
    expect(overview.cashFlow.at(-1)).toEqual({ key: '2026-11', incomeMinor: 400_000_000, expenseMinor: 100_000_000 })
    expect(overview.expenseBreakdown).toEqual([{ category: 'Alimentación', amountMinor: 100_000_000, count: 1, sharePct: 100 }])
  })
})

describe('security', () => {
  it('rejects foreign hosts (DNS rebinding)', async () => {
    const response = await api.request('GET', '/api/overview', undefined, { host: 'evil.example' })
    expect(response.status).toBe(403)
  })

  it('rejects cross-site writes and non-JSON bodies', async () => {
    const body = { type: 'expense', name: 'X' }
    expect((await api.request('POST', '/api/categories', body, { origin: 'https://evil.example' })).status).toBe(403)
    expect((await api.request('POST', '/api/categories', body, { 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    const textPlain = await api.request('POST', '/api/categories', undefined, { 'content-type': 'text/plain' })
    expect(textPlain.status).toBe(415)
    expect((await api.request('POST', '/api/categories', body, { origin: 'http://localhost', 'sec-fetch-site': 'same-origin' })).status).toBe(201)
  })

  it('returns JSON errors for malformed bodies and unknown routes', async () => {
    const malformed = await api.request('POST', '/api/categories', undefined, { 'content-type': 'application/json' })
    expect(malformed.status).toBe(400)
    expect((await api.request('GET', '/api/nope')).status).toBe(404)
    expect((await api.request('GET', '/api/movements/not-a-uuid')).status).toBe(404)
  })
})
