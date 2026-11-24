import { monthKey, shiftMonth } from './dates'
import type { IsoDate, Movement } from './types'

/** Movement fields the comparison needs. */
export type ComparableMovement = Pick<Movement, 'id' | 'type' | 'description' | 'category' | 'amountMinor' | 'occurredOn'>

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isMonthKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = MONTH_KEY.exec(value)
  return Boolean(match) && Number(match![1]) >= 1970 && Number(match![1]) <= 2100
}

export function daysInMonth(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

/** First and last calendar day of a `YYYY-MM` month. */
export function monthBounds(key: string): { from: IsoDate; to: IsoDate; days: number } {
  const days = daysInMonth(key)
  return { from: `${key}-01`, to: `${key}-${String(days).padStart(2, '0')}`, days }
}

/** Default comparison: the current month against the previous one. */
export function defaultComparison(today: Date = new Date()): { base: string; target: string } {
  const target = monthKey(today)
  return { base: shiftMonth(target, -1), target }
}

/** Days of a month that have already happened: all of a past month, part of the current one, none of a future one. */
export function elapsedDays(key: string, today: Date = new Date()): number {
  const current = monthKey(today)
  if (key === current) return today.getDate()
  return key < current ? daysInMonth(key) : 0
}

export interface MonthStats {
  key: string
  incomeMinor: number
  expenseMinor: number
  netMinor: number
  expenseCount: number
  avgExpenseMinor: number
  /** Days counted for the daily average (fewer than the month length while it is in progress). */
  elapsedDays: number
  dailyAvgExpenseMinor: number
}

export interface CategoryDelta {
  category: string
  baseMinor: number
  targetMinor: number
  deltaMinor: number
  /** Change in percent; `null` when the base month had no spending in the category. */
  deltaPct: number | null
  baseCount: number
  targetCount: number
}

export interface PaceComparison {
  /** Cumulative expenses per day of month (index 0 = day 1). */
  base: number[]
  /** Same for the target month, only up to its last elapsed day. */
  target: number[]
  /** When the target month is in progress: the day used to compare both months at the same point. */
  compareDay: number | null
  baseAtDay: number | null
  targetAtDay: number | null
}

export interface ExpenseItem {
  id: string
  description: string
  category: string
  amountMinor: number
  occurredOn: IsoDate
}

export type ComparisonInsight =
  | { kind: 'total'; deltaMinor: number; deltaPct: number | null }
  | { kind: 'pace'; day: number; baseMinor: number; targetMinor: number; deltaPct: number | null }
  | { kind: 'category_up' | 'category_down'; category: string; deltaMinor: number; deltaPct: number | null }
  | { kind: 'new_category' | 'gone_category'; category: string; amountMinor: number }
  | { kind: 'biggest_expense'; description: string; category: string; amountMinor: number; occurredOn: IsoDate }

export interface MonthComparison {
  base: MonthStats
  target: MonthStats
  categories: CategoryDelta[]
  pace: PaceComparison
  topExpenses: { base: ExpenseItem[]; target: ExpenseItem[] }
  insights: ComparisonInsight[]
}

export const percentChange = (from: number, to: number): number | null => (from === 0 ? null : ((to - from) / Math.abs(from)) * 100)

function stats(key: string, movements: readonly ComparableMovement[], today: Date): MonthStats {
  let incomeMinor = 0
  let expenseMinor = 0
  let expenseCount = 0
  for (const movement of movements) {
    if (movement.type === 'income') incomeMinor += movement.amountMinor
    if (movement.type === 'expense') {
      expenseMinor += movement.amountMinor
      expenseCount += 1
    }
  }
  const elapsed = elapsedDays(key, today)
  // Averages are shown in whole pesos.
  const wholePesos = (minor: number) => Math.round(minor / 100) * 100
  return {
    key,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    expenseCount,
    avgExpenseMinor: expenseCount ? wholePesos(expenseMinor / expenseCount) : 0,
    elapsedDays: elapsed,
    dailyAvgExpenseMinor: elapsed ? wholePesos(expenseMinor / elapsed) : 0,
  }
}

function cumulative(expenses: readonly ComparableMovement[], days: number): number[] {
  const perDay = new Array<number>(days).fill(0)
  for (const movement of expenses) perDay[Number(movement.occurredOn.slice(8, 10)) - 1] += movement.amountMinor
  let running = 0
  return perDay.map((amount) => (running += amount))
}

function byCategory(expenses: readonly ComparableMovement[]) {
  const totals = new Map<string, { amount: number; count: number }>()
  for (const movement of expenses) {
    const entry = totals.get(movement.category) ?? { amount: 0, count: 0 }
    entry.amount += movement.amountMinor
    entry.count += 1
    totals.set(movement.category, entry)
  }
  return totals
}

function topExpenses(expenses: readonly ComparableMovement[], limit = 5): ExpenseItem[] {
  return [...expenses]
    .sort((a, b) => b.amountMinor - a.amountMinor || (a.occurredOn < b.occurredOn ? 1 : -1))
    .slice(0, limit)
    .map(({ id, description, category, amountMinor, occurredOn }) => ({ id, description, category, amountMinor, occurredOn }))
}

/**
 * Compares the spending of two months (any months, in any order). `movements` may contain
 * records of other months; only the two requested months are used.
 * While the target month is in progress, both months are also compared at the same day of month,
 * so an unfinished month is not judged against a complete one.
 */
export function compareMonths(input: {
  baseKey: string
  targetKey: string
  movements: readonly ComparableMovement[]
  today?: Date
}): MonthComparison {
  const today = input.today ?? new Date()
  const inBase = input.movements.filter((movement) => monthKey(movement.occurredOn) === input.baseKey)
  const inTarget = input.movements.filter((movement) => monthKey(movement.occurredOn) === input.targetKey)
  const baseExpenses = inBase.filter((movement) => movement.type === 'expense')
  const targetExpenses = inTarget.filter((movement) => movement.type === 'expense')

  const base = stats(input.baseKey, inBase, today)
  const target = stats(input.targetKey, inTarget, today)

  const baseCategories = byCategory(baseExpenses)
  const targetCategories = byCategory(targetExpenses)
  const names = new Set([...baseCategories.keys(), ...targetCategories.keys()])
  const categories = [...names].map((category): CategoryDelta => {
    const from = baseCategories.get(category) ?? { amount: 0, count: 0 }
    const to = targetCategories.get(category) ?? { amount: 0, count: 0 }
    return {
      category,
      baseMinor: from.amount,
      targetMinor: to.amount,
      deltaMinor: to.amount - from.amount,
      deltaPct: percentChange(from.amount, to.amount),
      baseCount: from.count,
      targetCount: to.count,
    }
  }).sort((a, b) => Math.max(b.baseMinor, b.targetMinor) - Math.max(a.baseMinor, a.targetMinor) || a.category.localeCompare(b.category, 'es'))

  const baseCurve = cumulative(baseExpenses, daysInMonth(input.baseKey))
  const targetCurve = cumulative(targetExpenses, daysInMonth(input.targetKey)).slice(0, target.elapsedDays)
  const inProgress = input.targetKey === monthKey(today) && input.targetKey !== input.baseKey
  const compareDay = inProgress ? target.elapsedDays : null
  const baseAtDay = compareDay ? baseCurve[Math.min(compareDay, baseCurve.length) - 1] : null
  const targetAtDay = compareDay ? targetCurve[compareDay - 1] ?? 0 : null
  const pace: PaceComparison = { base: baseCurve, target: targetCurve, compareDay, baseAtDay, targetAtDay }

  const insights: ComparisonInsight[] = [
    { kind: 'total', deltaMinor: target.expenseMinor - base.expenseMinor, deltaPct: percentChange(base.expenseMinor, target.expenseMinor) },
  ]
  if (compareDay && baseAtDay !== null && targetAtDay !== null) {
    insights.push({ kind: 'pace', day: compareDay, baseMinor: baseAtDay, targetMinor: targetAtDay, deltaPct: percentChange(baseAtDay, targetAtDay) })
  }
  const shared = categories.filter((row) => row.baseMinor > 0 && row.targetMinor > 0)
  const up = [...shared].filter((row) => row.deltaMinor > 0).sort((a, b) => b.deltaMinor - a.deltaMinor)[0]
  const down = [...shared].filter((row) => row.deltaMinor < 0).sort((a, b) => a.deltaMinor - b.deltaMinor)[0]
  if (up) insights.push({ kind: 'category_up', category: up.category, deltaMinor: up.deltaMinor, deltaPct: up.deltaPct })
  if (down) insights.push({ kind: 'category_down', category: down.category, deltaMinor: down.deltaMinor, deltaPct: down.deltaPct })
  const fresh = categories.filter((row) => row.baseMinor === 0 && row.targetMinor > 0).sort((a, b) => b.targetMinor - a.targetMinor)[0]
  if (fresh) insights.push({ kind: 'new_category', category: fresh.category, amountMinor: fresh.targetMinor })
  const gone = categories.filter((row) => row.baseMinor > 0 && row.targetMinor === 0).sort((a, b) => b.baseMinor - a.baseMinor)[0]
  if (gone) insights.push({ kind: 'gone_category', category: gone.category, amountMinor: gone.baseMinor })
  const [biggest] = topExpenses(targetExpenses, 1)
  if (biggest) insights.push({ kind: 'biggest_expense', ...biggest })

  return {
    base,
    target,
    categories,
    pace,
    topExpenses: { base: topExpenses(baseExpenses), target: topExpenses(targetExpenses) },
    insights,
  }
}

/** Same month one year earlier, e.g. `2026-11` → `2025-11`. */
export function sameMonthLastYear(key: string): string {
  return shiftMonth(key, -12)
}
