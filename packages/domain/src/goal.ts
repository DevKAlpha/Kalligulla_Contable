import { DomainError } from './errors'
import type { SavingsGoal } from './types'

export const GOAL_NAME_MAX_LENGTH = 50

export function normalizeGoal(goal: SavingsGoal): SavingsGoal {
  const name = goal.name?.trim() ?? ''
  if (!name) throw new DomainError('Ponle un nombre a la meta.', 'name')
  if (name.length > GOAL_NAME_MAX_LENGTH) {
    throw new DomainError(`El nombre admite máximo ${GOAL_NAME_MAX_LENGTH} caracteres.`, 'name')
  }
  if (!Number.isInteger(goal.savedMinor) || goal.savedMinor < 0) {
    throw new DomainError('El valor ahorrado no puede ser negativo.', 'saved')
  }
  if (!Number.isInteger(goal.targetMinor) || goal.targetMinor <= 0) {
    throw new DomainError('El objetivo debe ser mayor que cero.', 'target')
  }
  return { name, savedMinor: goal.savedMinor, targetMinor: goal.targetMinor }
}

export function goalProgress(goal: SavingsGoal | null): { pct: number; remainingMinor: number; done: boolean } {
  if (!goal || goal.targetMinor <= 0) return { pct: 0, remainingMinor: 0, done: false }
  const pct = Math.min(100, (goal.savedMinor / goal.targetMinor) * 100)
  return { pct, remainingMinor: Math.max(0, goal.targetMinor - goal.savedMinor), done: goal.savedMinor >= goal.targetMinor }
}
