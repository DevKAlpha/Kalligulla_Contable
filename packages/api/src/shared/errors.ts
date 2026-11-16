import { DomainError } from '@kaligula/domain'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Error with an HTTP status and a stable machine-readable code. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Recurso no encontrado.') {
    super(404, 'not_found', message)
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, field?: string) {
    super(409, 'conflict', message, field)
  }
}

/** Maps any thrown error to a status and the public error body. Unknown errors never leak details. */
export function toErrorResponse(error: unknown): { status: ContentfulStatusCode; body: { error: { code: string; message: string; field?: string } } } {
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) } } }
  }
  if (error instanceof DomainError) {
    return { status: 400, body: { error: { code: 'invalid', message: error.message, ...(error.field ? { field: error.field } : {}) } } }
  }
  if (isUniqueViolation(error)) {
    return { status: 409, body: { error: { code: 'conflict', message: 'El recurso ya existe.' } } }
  }
  return { status: 500, body: { error: { code: 'internal_error', message: 'Ocurrió un error inesperado.' } } }
}

/** PostgreSQL unique_violation, raw or wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code ?? (error as { cause?: { code?: unknown } })?.cause?.code
  return code === '23505'
}
