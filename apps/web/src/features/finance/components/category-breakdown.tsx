'use client'

import { formatMoney } from '@kaligula/domain'
import { PieChart } from 'lucide-react'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { useCategoryBreakdown } from '../use-finance'

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const MAX_ROWS = 5

/** Magnitude per category: single hue (expense), sorted, with direct value labels. */
export function CategoryBreakdown({ className }: { className?: string }) {
  const breakdown = useCategoryBreakdown('expense')
  const rows = breakdown.slice(0, MAX_ROWS)
  const rest = breakdown.slice(MAX_ROWS)
  if (rest.length) {
    rows.push({
      category: 'Otras',
      amountMinor: rest.reduce((sum, row) => sum + row.amountMinor, 0),
      count: rest.reduce((sum, row) => sum + row.count, 0),
      sharePct: rest.reduce((sum, row) => sum + row.sharePct, 0),
    })
  }
  const top = rows[0]?.amountMinor ?? 1

  return (
    <Panel className={className} aria-labelledby="categories-title">
      <PanelHeader id="categories-title" eyebrow="Este mes" title="Gastos por categoría" />
      {rows.length === 0 ? (
        <EmptyState icon={<PieChart size={20} aria-hidden />} title="Sin gastos este mes">
          Cuando registres gastos verás aquí en qué se va tu dinero.
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.category} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-medium">{row.category}</span>
                <span className="shrink-0 text-ink-2 tabular-nums">
                  {formatMoney(row.amountMinor)} · {row.sharePct > 0 && row.sharePct < 1 ? '<1' : percent.format(row.sharePct)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-expense" style={{ width: `${Math.max(3, (row.amountMinor / top) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
