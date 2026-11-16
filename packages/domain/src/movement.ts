import { isIsoDate } from './dates'
import { DomainError } from './errors'
import { MAX_MAJOR_AMOUNT, toMinor } from './money'
import { MOVEMENT_TYPES, type Movement, type MovementDraft } from './types'

export const DESCRIPTION_MAX_LENGTH = 60
export const NOTE_MAX_LENGTH = 240

export function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function validateAmountMinor(amountMinor: number, field = 'amount'): number {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new DomainError('Escribe un valor mayor que cero.', field)
  if (amountMinor > toMinor(MAX_MAJOR_AMOUNT)) throw new DomainError('El valor es demasiado grande.', field)
  return amountMinor
}

/** Validates and normalizes a draft. Throws `DomainError` naming the offending field. */
export function normalizeDraft(draft: MovementDraft): MovementDraft & { note: string | null } {
  if (!MOVEMENT_TYPES.includes(draft.type)) throw new DomainError('Selecciona un tipo de registro válido.', 'type')
  const description = (draft.description ?? '').trim().replace(/\s+/g, ' ')
  if (!description) throw new DomainError('Escribe una descripción.', 'description')
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    throw new DomainError(`La descripción admite máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`, 'description')
  }
  if (!draft.categoryId) throw new DomainError('Selecciona una categoría.', 'categoryId')
  validateAmountMinor(draft.amountMinor)
  if (!isIsoDate(draft.occurredOn)) throw new DomainError('Selecciona una fecha válida.', 'occurredOn')
  const note = draft.note?.trim() || null
  if (note && note.length > NOTE_MAX_LENGTH) {
    throw new DomainError(`La nota admite máximo ${NOTE_MAX_LENGTH} caracteres.`, 'note')
  }
  return {
    type: draft.type,
    description,
    categoryId: draft.categoryId,
    amountMinor: draft.amountMinor,
    occurredOn: draft.occurredOn,
    note,
  }
}

/** Newest first: by occurrence date, then by creation time. */
export function compareMovements(a: Pick<Movement, 'occurredOn' | 'createdAt'>, b: Pick<Movement, 'occurredOn' | 'createdAt'>): number {
  if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}
