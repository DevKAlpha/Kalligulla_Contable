import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, errorMessage } from './api-client'

const movement = {
  id: '99999999-2222-4333-8444-555555555555', type: 'expense', description: 'Tinto', categoryId: '11111111-2222-4333-8444-555555555555',
  category: 'Café y snacks', amountMinor: 350_000, currency: 'COP', occurredOn: '2026-11-14', note: null,
  createdAt: '2026-11-14T12:00:00.000Z', updatedAt: '2026-11-14T12:00:00.000Z',
}

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => impl(String(input), init))
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('sends JSON and validates responses against the contracts', async () => {
    const spy = mockFetch(() => Response.json(movement, { status: 201 }))
    const created = await api.createMovement({ type: 'expense', description: 'Tinto', categoryId: movement.categoryId, amountMinor: 350_000, occurredOn: '2026-11-14' })
    expect(created.id).toBe(movement.id)
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('/api/movements')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('builds list queries without empty parameters', async () => {
    const spy = mockFetch(() => Response.json({ items: [], total: 0, limit: 30, offset: 0 }))
    await api.listMovements({ type: 'income,expense', q: '', limit: 30, offset: 0 })
    expect(spy.mock.calls[0][0]).toBe('/api/movements?type=income%2Cexpense&limit=30&offset=0')
  })

  it('turns API errors into ApiError with the offending field', async () => {
    mockFetch(() => Response.json({ error: { code: 'invalid', message: 'Escribe una descripción.', field: 'description' } }, { status: 400 }))
    const error = await api.createGoal({ name: '', savedMinor: 0, targetMinor: 1 }).catch((reason) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'invalid', field: 'description' })
    expect(errorMessage(error)).toBe('Escribe una descripción.')
  })

  it('reports network failures and accepts empty 204 responses', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    await expect(api.overview()).rejects.toMatchObject({ code: 'network', status: 0 })

    mockFetch(() => new Response(null, { status: 204 }))
    await expect(api.deleteMovement(movement.id)).resolves.toBeUndefined()
  })
})
