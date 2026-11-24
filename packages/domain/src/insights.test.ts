import { describe, expect, it } from 'vitest'
import {
  compareMonths, daysInMonth, defaultComparison, elapsedDays, isMonthKey, monthBounds, periodReturn, rankByReturn,
  sameMonthLastYear, windowPoints, type ComparableMovement,
} from './index'

const TODAY = new Date(2026, 10, 23, 12, 0, 0) // 23 Nov 2026

let seq = 0
function m(type: ComparableMovement['type'], category: string, amountMinor: number, occurredOn: string, description = category): ComparableMovement {
  seq += 1
  return { id: `id-${seq}`, type, description, category, amountMinor, occurredOn }
}

describe('month helpers', () => {
  it('validates keys and computes bounds', () => {
    expect(isMonthKey('2026-11')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('26-11')).toBe(false)
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29', days: 29 })
    expect(daysInMonth('2026-11')).toBe(30)
    expect(defaultComparison(TODAY)).toEqual({ base: '2026-10', target: '2026-11' })
    expect(sameMonthLastYear('2026-01')).toBe('2025-01')
  })

  it('counts elapsed days for past, current and future months', () => {
    expect(elapsedDays('2026-10', TODAY)).toBe(31)
    expect(elapsedDays('2026-11', TODAY)).toBe(23)
    expect(elapsedDays('2026-12', TODAY)).toBe(0)
  })
})

describe('compareMonths', () => {
  const movements = [
    m('income', 'Salario', 400_000, '2026-10-01'),
    m('expense', 'Hogar', 100_000, '2026-10-02'),
    m('expense', 'Domicilios', 20_000, '2026-10-10'),
    m('expense', 'Domicilios', 10_000, '2026-10-25'),
    m('expense', 'Ocio', 50_000, '2026-10-15'),
    m('income', 'Salario', 400_000, '2026-11-01'),
    m('expense', 'Hogar', 100_000, '2026-11-02'),
    m('expense', 'Domicilios', 45_000, '2026-11-05', 'Rappi'),
    m('expense', 'Mascotas', 9_000, '2026-11-08'),
    m('expense', 'Hogar', 1, '2025-11-02'), // another month: ignored
  ]
  const result = compareMonths({ baseKey: '2026-10', targetKey: '2026-11', movements, today: TODAY })

  it('summarizes both months', () => {
    expect(result.base).toMatchObject({ expenseMinor: 180_000, incomeMinor: 400_000, netMinor: 220_000, expenseCount: 4, elapsedDays: 31 })
    expect(result.target).toMatchObject({ expenseMinor: 154_000, expenseCount: 3, avgExpenseMinor: 51_300, elapsedDays: 23, dailyAvgExpenseMinor: 6_700 })
  })

  it('lines up categories with absolute and relative changes', () => {
    expect(result.categories.map((row) => row.category)).toEqual(['Hogar', 'Ocio', 'Domicilios', 'Mascotas'])
    expect(result.categories.find((row) => row.category === 'Domicilios')).toMatchObject({ baseMinor: 30_000, targetMinor: 45_000, deltaMinor: 15_000, deltaPct: 50, baseCount: 2, targetCount: 1 })
    expect(result.categories.find((row) => row.category === 'Mascotas')?.deltaPct).toBeNull()
  })

  it('compares an unfinished month at the same day of month', () => {
    expect(result.pace.base).toHaveLength(31)
    expect(result.pace.target).toHaveLength(23)
    expect(result.pace.base[1]).toBe(100_000)
    expect(result.pace).toMatchObject({ compareDay: 23, baseAtDay: 170_000, targetAtDay: 154_000 })
  })

  it('produces structured insights', () => {
    expect(result.insights.map((insight) => insight.kind)).toEqual(['total', 'pace', 'category_up', 'new_category', 'gone_category', 'biggest_expense'])
    expect(result.insights[2]).toMatchObject({ category: 'Domicilios', deltaMinor: 15_000 })
    expect(result.insights.at(-1)).toMatchObject({ description: 'Hogar', amountMinor: 100_000 })
    expect(result.topExpenses.target.map((item) => item.amountMinor)).toEqual([100_000, 45_000, 9_000])
  })

  it('has no pace comparison for two past months', () => {
    const past = compareMonths({ baseKey: '2026-09', targetKey: '2026-10', movements, today: TODAY })
    expect(past.pace.compareDay).toBeNull()
    expect(past.base.expenseMinor).toBe(0)
    expect(past.insights[0]).toMatchObject({ kind: 'total', deltaPct: null })
  })
})

describe('market performance', () => {
  const day = 86_400_000
  const t0 = Date.UTC(2026, 9, 20)
  const points = [100, 102, 98, 110, 120].map((close, index) => ({ time: t0 + index * 10 * day, close }))

  it('measures the return over the last 30 days', () => {
    // Last close at day 40; start reference = last close on or before day 10 (102).
    expect(periodReturn(points)).toMatchObject({ start: 102, end: 120 })
    expect(periodReturn(points, 126)!.changePct).toBeCloseTo(((126 - 102) / 102) * 100, 6)
    expect(periodReturn([{ time: t0, close: 5 }])).toBeNull()
    expect(periodReturn([])).toBeNull()
  })

  it('keeps the window for sparklines and ranks by return', () => {
    expect(windowPoints(points)).toEqual([102, 98, 110, 120])
    expect(rankByReturn([{ changePct: -3 }, { changePct: 7 }, { changePct: 1 }], 2)).toEqual([{ changePct: 7 }, { changePct: 1 }])
  })
})
