import type { Context } from 'hono'
import type { ZodType } from 'zod'
import { HttpError } from './errors'

/** Hono environment shared by every module. */
export interface AppEnv {
  Variables: {
    /** Data owner of the current request. Single local owner until authentication exists. */
    owner: string
  }
}

function invalid(issues: { path: PropertyKey[]; message: string }[]): never {
  const [issue] = issues
  const field = issue?.path.map(String).join('.') || undefined
  throw new HttpError(400, 'invalid_request', field ? `Dato inválido en «${field}».` : 'La petición no es válida.', field)
}

export async function readJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HttpError(400, 'invalid_json', 'El cuerpo de la petición no es JSON válido.')
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) invalid(parsed.error.issues)
  return parsed.data
}

export function readQuery<T>(c: Context, schema: ZodType<T>): T {
  const parsed = schema.safeParse(c.req.query())
  if (!parsed.success) invalid(parsed.error.issues)
  return parsed.data
}

/** Route params that must be UUIDs; anything else cannot exist, so it is a 404. */
export function uuidParam(c: Context, name = 'id'): string {
  const value = c.req.param(name) ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(404, 'not_found', 'Recurso no encontrado.')
  }
  return value.toLowerCase()
}
