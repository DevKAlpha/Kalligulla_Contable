import { monthKey, shiftMonth } from './dates'
import type { Movement, MovementType } from './types'

type Flow = Pick<Movement, 'type' | 'amountMinor' | 'occurredOn'>

export interface PeriodTotals {
  incomeMinor: number
  expenseMinor: number
  netMinor: number
}

export interface CashFlowMonth {
  key: string
  incomeMinor: number
  expenseMinor: number
}

export interface CategoryShare {
  category: string
  amountMinor: number
  count: number
  sharePct: number
}

export interface Overview {
  /** All-time income minus all-time expenses. Investments and loans are tracked separately. */
  balanceMinor: number
  totals: Record<MovementType, number>
  counts: Record<MovementType, number>
  currentMonth: PeriodTotals
  previousMonth: PeriodTotals
  /** Change of this month's net versus last month's, in percent. `null` when last month has no net. */
  monthlyChangePct: number | null
  /** Share of this month's income spent this month, in percent. `null` without income. */
  expenseRatioPct: number | null
  cashFlow: CashFlowMonth[]
  /** Current month's expenses by category, largest first. */
  expenseBreakdown: CategoryShare[]
}

export function emptyByType(): Record<MovementType, number> {
  return { income: 0, expense: 0, investment: 0, loan: 0 }
}

export function periodTotals(movements: readonly Flow[], key: string): PeriodTotals {
  let incomeMinor = 0
  let expenseMinor = 0
  for (const movement of movements) {
    if (monthKey(movement.occurredOn) !== key) continue
    if (movement.type === 'income') incomeMinor += movement.amountMinor
    if (movement.type === 'expense') expenseMinor += movement.amountMinor
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor }
}

export function buildCashFlow(movements: readonly Flow[], months = 6, reference: Date = new Date()): CashFlowMonth[] {
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

export function categoryBreakdown(
  movements: readonly Pick<Movement, 'type' | 'amountMinor' | 'occurredOn' | 'category'>[],
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

export interface OverviewInput {
  /** All-time totals and counts per type (usually aggregated by the database). */
  totals: Record<MovementType, number>
  counts: Record<MovementType, number>
  /** Movements inside the cash-flow window (at least the last `months` months). */
  recent: readonly Pick<Movement, 'type' | 'amountMinor' | 'occurredOn' | 'category'>[]
  months?: number
  reference?: Date
}

/** Every figure is derived from stored movements, so totals can never drift from the records. */
export function buildOverview({ totals, counts, recent, months = 6, reference = new Date() }: OverviewInput): Overview {
  const currentKey = monthKey(reference)
  const currentMonth = periodTotals(recent, currentKey)
  const previousMonth = periodTotals(recent, shiftMonth(currentKey, -1))
  return {
    balanceMinor: totals.income - totals.expense,
    totals: { ...totals },
    counts: { ...counts },
    currentMonth,
    previousMonth,
    monthlyChangePct: previousMonth.netMinor !== 0
      ? ((currentMonth.netMinor - previousMonth.netMinor) / Math.abs(previousMonth.netMinor)) * 100
      : null,
    expenseRatioPct: currentMonth.incomeMinor > 0 ? (currentMonth.expenseMinor / currentMonth.incomeMinor) * 100 : null,
    cashFlow: buildCashFlow(recent, months, reference),
    expenseBreakdown: categoryBreakdown(recent, 'expense', currentKey),
  }
}

/** First day of the cash-flow window, as `YYYY-MM-DD`. */
export function overviewWindowStart(months = 6, reference: Date = new Date()): string {
  return `${shiftMonth(monthKey(reference), -(months - 1))}-01`
}
