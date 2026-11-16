import { DomainError } from './errors'
import type { MovementType } from './types'

/** Name of the system category that exists for every type and receives orphaned movements. */
export const SYSTEM_CATEGORY_NAME = 'Otro'
export const CATEGORY_NAME_MAX_LENGTH = 40

/** Categories created for every new owner. The last one of each list is the system category. */
export const DEFAULT_CATEGORIES: Record<MovementType, readonly string[]> = {
  expense: [
    'Alimentación', 'Hogar', 'Transporte', 'Salud', 'Educación', 'Ocio',
    'Suscripciones', 'Domicilios', 'Café y snacks', SYSTEM_CATEGORY_NAME,
  ],
  income: ['Salario', 'Honorarios', 'Ventas', 'Rendimientos', 'Regalo', SYSTEM_CATEGORY_NAME],
  investment: ['Acciones', 'ETF', 'CDT', 'Fondo', 'Cripto', 'Finca raíz', SYSTEM_CATEGORY_NAME],
  loan: ['Tarjeta de crédito', 'Libre inversión', 'Vehículo', 'Vivienda', 'Educativo', 'Personal', SYSTEM_CATEGORY_NAME],
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  investment: 'Inversión',
  loan: 'Préstamo',
}

export const MOVEMENT_TYPE_PLURALS: Record<MovementType, string> = {
  income: 'Ingresos',
  expense: 'Gastos',
  investment: 'Inversiones',
  loan: 'Préstamos',
}

export function normalizeCategoryName(raw: string): string {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!name) throw new DomainError('Escribe un nombre para la categoría.', 'name')
  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new DomainError(`El nombre admite máximo ${CATEGORY_NAME_MAX_LENGTH} caracteres.`, 'name')
  }
  return name
}

/** Case-insensitive comparison key, matching the database unique index on lower(name). */
export function categoryKey(type: MovementType, name: string): string {
  return `${type}:${name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CO')}`
}
