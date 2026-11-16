'use client'

import { buildCashFlow, categoryBreakdown, deriveSummary, goalProgress, monthKey, type MovementType } from '@kaligula/domain'
import { useMemo } from 'react'
import { useFinanceStore } from './finance-store'

export function useMovements(type?: MovementType | readonly MovementType[]) {
  const movements = useFinanceStore((state) => state.movements)
  return useMemo(() => {
    if (!type) return movements
    const types: readonly MovementType[] = typeof type === 'string' ? [type] : type
    return movements.filter((movement) => types.includes(movement.type))
  }, [movements, type])
}

export function useSummary() {
  const movements = useFinanceStore((state) => state.movements)
  return useMemo(() => deriveSummary(movements), [movements])
}

export function useCashFlow(months = 6) {
  const movements = useFinanceStore((state) => state.movements)
  return useMemo(() => buildCashFlow(movements, months), [movements, months])
}

export function useCategoryBreakdown(type: MovementType = 'expense', currentMonthOnly = true) {
  const movements = useFinanceStore((state) => state.movements)
  return useMemo(
    () => categoryBreakdown(movements, type, currentMonthOnly ? monthKey(new Date()) : undefined),
    [movements, type, currentMonthOnly],
  )
}

export function useGoal() {
  const goal = useFinanceStore((state) => state.goal)
  return useMemo(() => ({ goal, ...goalProgress(goal) }), [goal])
}
