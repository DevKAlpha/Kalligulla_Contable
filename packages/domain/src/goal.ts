import { isIsoDate, monthKey, parseIsoDate } from './dates'
import { DomainError } from './errors'
import { MAX_MAJOR_AMOUNT, toMinor } from './money'
import type { GoalDraft, IsoDate } from './types'

export const GOAL_NAME_MAX_LENGTH = 50

export function normalizeGoal(goal: GoalDraft): Required<GoalDraft> {
  const name = (goal.name ?? '').trim().replace(/\s+/g, ' ')
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
  const limit = toMinor(MAX_MAJOR_AMOUNT)
  if (goal.savedMinor > limit || goal.targetMinor > limit) throw new DomainError('El valor es demasiado grande.', 'target')
  const targetDate = goal.targetDate || null
  if (targetDate !== null && !isIsoDate(targetDate)) throw new DomainError('Selecciona una fecha válida.', 'targetDate')
  return { name, savedMinor: goal.savedMinor, targetMinor: goal.targetMinor, targetDate }
}

export interface GoalProgress {
  pct: number
  remainingMinor: number
  done: boolean
  /** Whole months left until the target date, counting the current one. `null` without a date. */
  monthsLeft: number | null
  /** Even monthly contribution needed to reach the target on time. `null` without a date or when done. */
  suggestedMonthlyMinor: number | null
  overdue: boolean
}

export function goalProgress(
  goal: { savedMinor: number; targetMinor: number; targetDate?: IsoDate | null } | null,
  reference: Date = new Date(),
): GoalProgress {
  if (!goal || goal.targetMinor <= 0) {
    return { pct: 0, remainingMinor: 0, done: false, monthsLeft: null, suggestedMonthlyMinor: null, overdue: false }
  }
  const pct = Math.min(100, (goal.savedMinor / goal.targetMinor) * 100)
  const remainingMinor = Math.max(0, goal.targetMinor - goal.savedMinor)
  const done = remainingMinor === 0
  if (!goal.targetDate) return { pct, remainingMinor, done, monthsLeft: null, suggestedMonthlyMinor: null, overdue: false }

  const [fromYear, fromMonth] = monthKey(reference).split('-').map(Number)
  const target = parseIsoDate(goal.targetDate)
  const monthsLeft = (target.getFullYear() - fromYear) * 12 + (target.getMonth() + 1 - fromMonth) + 1
  const overdue = !done && monthsLeft <= 0
  return {
    pct,
    remainingMinor,
    done,
    monthsLeft: Math.max(0, monthsLeft),
    suggestedMonthlyMinor: done || monthsLeft <= 0 ? null : Math.ceil(remainingMinor / monthsLeft),
    overdue,
  }
}
