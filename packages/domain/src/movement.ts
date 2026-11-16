import { isIsoDate } from './dates'
import { DomainError } from './errors'
import { MAX_MAJOR_AMOUNT, toMinor } from './money'
import { MOVEMENT_TYPES, type FinanceState, type Movement, type MovementDraft } from './types'

export const DESCRIPTION_MAX_LENGTH = 60
export const NOTE_MAX_LENGTH = 240

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Validates and normalizes a draft. Throws `DomainError` with the offending field. */
export function normalizeDraft(draft: MovementDraft): MovementDraft {
  if (!MOVEMENT_TYPES.includes(draft.type)) throw new DomainError('Selecciona un tipo de registro válido.', 'type')
  const description = draft.description?.trim() ?? ''
  if (!description) throw new DomainError('Escribe una descripción.', 'description')
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    throw new DomainError(`La descripción admite máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`, 'description')
  }
  if (!Number.isInteger(draft.amountMinor) || draft.amountMinor <= 0) {
    throw new DomainError('Escribe un valor mayor que cero.', 'amount')
  }
  if (draft.amountMinor > toMinor(MAX_MAJOR_AMOUNT)) throw new DomainError('El valor es demasiado grande.', 'amount')
  if (!isIsoDate(draft.occurredOn)) throw new DomainError('Selecciona una fecha válida.', 'occurredOn')
  const note = draft.note?.trim()
  if (note && note.length > NOTE_MAX_LENGTH) {
    throw new DomainError(`La nota admite máximo ${NOTE_MAX_LENGTH} caracteres.`, 'note')
  }
  return {
    type: draft.type,
    description,
    category: draft.category?.trim() || 'Otro',
    amountMinor: draft.amountMinor,
    occurredOn: draft.occurredOn,
    ...(note ? { note } : {}),
  }
}

export function createMovement(draft: MovementDraft, now: Date = new Date(), id: string = newId()): Movement {
  const timestamp = now.toISOString()
  return { id, currency: 'COP', ...normalizeDraft(draft), createdAt: timestamp, updatedAt: timestamp }
}

export function reviseMovement(movement: Movement, draft: MovementDraft, now: Date = new Date()): Movement {
  const { note: _previousNote, ...rest } = movement
  return { ...rest, ...normalizeDraft(draft), updatedAt: now.toISOString() }
}

/** Newest first: by occurrence date, then by creation time. */
export function compareMovements(a: Movement, b: Movement): number {
  if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}

export function addMovement(state: FinanceState, movement: Movement): FinanceState {
  return { ...state, movements: [...state.movements, movement].sort(compareMovements) }
}

export function replaceMovement(state: FinanceState, movement: Movement): FinanceState {
  if (!state.movements.some((item) => item.id === movement.id)) {
    throw new DomainError('El registro ya no existe.')
  }
  return {
    ...state,
    movements: state.movements.map((item) => (item.id === movement.id ? movement : item)).sort(compareMovements),
  }
}

export function removeMovement(state: FinanceState, movementId: string): FinanceState {
  return { ...state, movements: state.movements.filter((item) => item.id !== movementId) }
}
