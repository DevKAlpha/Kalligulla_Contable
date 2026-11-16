import { monthKey, shiftMonth } from './dates'
import type { Movement, MovementType } from './types'

export interface PeriodTotals {
  incomeMinor: number
  expenseMinor: number
  netMinor: number
}

export interface Summary {
  /** All-time income minus all-time expenses. Investments and loans are tracked separately. */
  balanceMinor: number
  totals: Record<MovementType, number>
  counts: Record<MovementType, number>
  currentMonth: PeriodTotals
  previousMonth: PeriodTotals
  /** Change of this month's net versus last month's, in percent. `null` when last month has no activity. */
  monthlyChangePct: number | null
  /** Share of this month's income spent this month, in percent. `null` without income. */
  expenseRatioPct: number | null
}

function emptyByType(): Record<MovementType, number> {
  return { income: 0, expense: 0, investment: 0, loan: 0 }
}

function periodTotals(movements: readonly Movement[], key: string): PeriodTotals {
  let incomeMinor = 0
  let expenseMinor = 0
  for (const movement of movements) {
    if (monthKey(movement.occurredOn) !== key) continue
    if (movement.type === 'income') incomeMinor += movement.amountMinor
    if (movement.type === 'expense') expenseMinor += movement.amountMinor
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor }
}

/** Every figure is derived from the movements, so totals can never drift from the records. */
export function deriveSummary(movements: readonly Movement[], reference: Date = new Date()): Summary {
  const totals = emptyByType()
  const counts = emptyByType()
  for (const movement of movements) {
    totals[movement.type] += movement.amountMinor
    counts[movement.type] += 1
  }
  const currentKey = monthKey(reference)
  const currentMonth = periodTotals(movements, currentKey)
  const previousMonth = periodTotals(movements, shiftMonth(currentKey, -1))
  const hasPrevious = previousMonth.incomeMinor !== 0 || previousMonth.expenseMinor !== 0
  return {
    balanceMinor: totals.income - totals.expense,
    totals,
    counts,
    currentMonth,
    previousMonth,
    monthlyChangePct: hasPrevious && previousMonth.netMinor !== 0
      ? ((currentMonth.netMinor - previousMonth.netMinor) / Math.abs(previousMonth.netMinor)) * 100
      : null,
    expenseRatioPct: currentMonth.incomeMinor > 0 ? (currentMonth.expenseMinor / currentMonth.incomeMinor) * 100 : null,
  }
}

export interface CashFlowMonth {
  key: string
  incomeMinor: number
  expenseMinor: number
}

export function buildCashFlow(movements: readonly Movement[], months = 6, reference: Date = new Date()): CashFlowMonth[] {
  const currentKey = monthKey(reference)
  const series = Array.from({ length: months }, (_, index) => ({
    key: shiftMonth(currentKey, index - (months - 1)),
    incomeMinor: 0,
    expenseMinor: 0,
  }))
  const byKey = new Map(series.map((month) => [month.key, month]))
  for (const movement of movements) {
    const month = byKey.get(monthKey(movement.occurredOn))
    if (!month) continue
    if (movement.type === 'income') month.incomeMinor += movement.amountMinor
    if (movement.type === 'expense') month.expenseMinor += movement.amountMinor
  }
  return series
}

export interface CategoryShare {
  category: string
  amountMinor: number
  count: number
  sharePct: number
}

export function categoryBreakdown(
  movements: readonly Movement[],
  type: MovementType = 'expense',
  month?: string,
): CategoryShare[] {
  const totals = new Map<string, { amountMinor: number; count: number }>()
  let grand = 0
  for (const movement of movements) {
    if (movement.type !== type) continue
    if (month && monthKey(movement.occurredOn) !== month) continue
    const entry = totals.get(movement.category) ?? { amountMinor: 0, count: 0 }
    entry.amountMinor += movement.amountMinor
    entry.count += 1
    totals.set(movement.category, entry)
    grand += movement.amountMinor
  }
  return [...totals.entries()]
    .map(([category, entry]) => ({ category, ...entry, sharePct: grand ? (entry.amountMinor / grand) * 100 : 0 }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
}
