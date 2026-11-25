import {
  apiErrorSchema, categoryListSchema, categorySchema, comparisonSchema, fxSnapshotSchema, goalListSchema, goalSchema, healthSchema,
  movementPageSchema, movementSchema, moversSchema, overviewSchema, portfolioImportResultSchema, portfolioSchema, profileSchema, restoreResultSchema, snapshotSchema, trmQuoteSchema,
  type CategoryCreateInput, type GoalInput, type MovementInput, type MovementListQuery,
} from '@kaligula/contracts'
import type { AssetClass, FinanceSnapshot } from '@kaligula/domain'
import { z, type ZodType } from 'zod'

/** Failed API call. `field` names the input the server rejected, when it applies. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  schema?: ZodType<T>
  signal?: AbortSignal
}

async function request<T>(path: string, { method = 'GET', body, schema, signal }: RequestOptions<T> = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError('No hay conexión con el servidor de Kaligula.', 0, 'network')
  }
  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload)
    if (parsed.success) throw new ApiError(parsed.data.error.message, response.status, parsed.data.error.code, parsed.data.error.field)
    throw new ApiError('El servidor respondió con un error.', response.status, 'http_error')
  }
  return schema ? schema.parse(payload) : (payload as T)
}

function queryString(query: MovementListQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue
    params.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

const deleteCategoryResult = z.object({ reassigned: z.number().int() })

/** Typed client for the Kaligula API. Every response is validated against the shared contracts. */
export const api = {
  health: (signal?: AbortSignal) => request('/health', { schema: healthSchema, signal }),

  getProfile: (signal?: AbortSignal) => request('/profile', { schema: profileSchema, signal }),
  saveProfile: (name: string) => request('/profile', { method: 'PUT', body: { name }, schema: profileSchema }),

  listCategories: (signal?: AbortSignal) => request('/categories', { schema: categoryListSchema, signal }).then((data) => data.items),
  createCategory: (input: CategoryCreateInput) => request('/categories', { method: 'POST', body: input, schema: categorySchema }),
  renameCategory: (id: string, name: string) => request(`/categories/${id}`, { method: 'PATCH', body: { name }, schema: categorySchema }),
  deleteCategory: (id: string) => request(`/categories/${id}`, { method: 'DELETE', schema: deleteCategoryResult }),

  listMovements: (query: MovementListQuery, signal?: AbortSignal) => request(`/movements${queryString(query)}`, { schema: movementPageSchema, signal }),
  createMovement: (input: MovementInput) => request('/movements', { method: 'POST', body: input, schema: movementSchema }),
  updateMovement: (id: string, input: MovementInput) => request(`/movements/${id}`, { method: 'PUT', body: input, schema: movementSchema }),
  deleteMovement: (id: string) => request<void>(`/movements/${id}`, { method: 'DELETE' }),

  overview: (signal?: AbortSignal) => request('/overview', { schema: overviewSchema, signal }),
  comparison: (base: string, target: string, signal?: AbortSignal) =>
    request(`/comparison?${new URLSearchParams({ base, target })}`, { schema: comparisonSchema, signal }),

  listGoals: (signal?: AbortSignal) => request('/goals', { schema: goalListSchema, signal }).then((data) => data.items),
  createGoal: (input: GoalInput) => request('/goals', { method: 'POST', body: input, schema: goalSchema }),
  updateGoal: (id: string, input: GoalInput) => request(`/goals/${id}`, { method: 'PUT', body: input, schema: goalSchema }),
  deleteGoal: (id: string) => request<void>(`/goals/${id}`, { method: 'DELETE' }),

  portfolio: (signal?: AbortSignal) => request('/portfolio', { schema: portfolioSchema, signal }),
  importPortfolio: (fileName: string, contentBase64: string) =>
    request('/portfolio/import', { method: 'POST', body: { fileName, contentBase64 }, schema: portfolioImportResultSchema }),
  deletePortfolioImport: (id: string) => request<void>(`/portfolio/imports/${id}`, { method: 'DELETE' }),

  exportBackup: () => request('/backup', { schema: snapshotSchema }) as Promise<FinanceSnapshot>,
  restoreBackup: (snapshot: FinanceSnapshot) => request('/backup/restore', { method: 'POST', body: snapshot, schema: restoreResultSchema }),

  trm: (signal?: AbortSignal) => request('/market/trm', { schema: trmQuoteSchema, signal }),
  fx: (signal?: AbortSignal) => request('/market/fx', { schema: fxSnapshotSchema, signal }),
  movers: (assetClass: AssetClass, signal?: AbortSignal) => request(`/market/movers?class=${assetClass}`, { schema: moversSchema, signal }),
}

/** User-facing message for any error thrown by the client. */
export function errorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  return error instanceof ApiError ? error.message : fallback
}
