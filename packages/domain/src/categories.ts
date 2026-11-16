import type { MovementType } from './types'

export const CATEGORIES_BY_TYPE: Record<MovementType, readonly string[]> = {
  expense: [
    'Alimentación', 'Hogar', 'Transporte', 'Salud', 'Educación', 'Ocio',
    'Suscripciones', 'Domicilios', 'Café y snacks', 'Otro',
  ],
  income: ['Salario', 'Honorarios', 'Ventas', 'Rendimientos', 'Regalo', 'Otro'],
  investment: ['Acciones', 'ETF', 'CDT', 'Fondo', 'Cripto', 'Finca raíz', 'Otro'],
  loan: ['Tarjeta de crédito', 'Libre inversión', 'Vehículo', 'Vivienda', 'Educativo', 'Personal', 'Otro'],
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  investment: 'Inversión',
  loan: 'Préstamo',
}
