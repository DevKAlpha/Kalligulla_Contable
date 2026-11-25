'use client'

import type { ComparisonDto } from '@kaligula/contracts'
import { formatMoney } from '@kaligula/domain'
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'

type Row = ComparisonDto['categories'][number]

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
const VISIBLE = 8

/**
 * Spending change badge. For expenses, spending more is the unfavorable direction,
 * so increases read as negative. Color always comes with an arrow and a sign.
 */
export function SpendDelta({ deltaMinor, deltaPct, isNew = false, className }: { deltaMinor: number; deltaPct: number | null; isNew?: boolean; className?: string }) {
  if (isNew) {
    return <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold text-ink-2', className)}><Sparkles size={13} aria-hidden />Nuevo</span>
  }
  if (deltaMinor === 0) {
    return <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold text-ink-2', className)}><Minus size={13} aria-hidden />Igual</span>
  }
  const up = deltaMinor > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums', up ? 'text-negative' : 'text-positive', className)}>
      <Icon size={14} aria-hidden />
      <span className="sr-only">{up ? 'Gastaste más' : 'Gastaste menos'}:</span>
      {up ? '+' : '−'}{formatMoney(Math.abs(deltaMinor))}
      {deltaPct !== null && <span className="font-medium opacity-80"> ({percent.format(deltaPct)} %)</span>}
    </span>
  )
}

function fold(rows: readonly Row[]): Row[] {
  if (rows.length <= VISIBLE) return [...rows]
  const rest = rows.slice(VISIBLE - 1)
  const sum = (pick: (row: Row) => number) => rest.reduce((total, row) => total + pick(row), 0)
  const baseMinor = sum((row) => row.baseMinor)
  const targetMinor = sum((row) => row.targetMinor)
  return [...rows.slice(0, VISIBLE - 1), {
    category: `Otras (${rest.length})`,
    baseMinor,
    targetMinor,
    deltaMinor: targetMinor - baseMinor,
    deltaPct: baseMinor ? ((targetMinor - baseMinor) / baseMinor) * 100 : null,
    baseCount: sum((row) => row.baseCount),
    targetCount: sum((row) => row.targetCount),
  }]
}

/** Paired bars per category: base month on top, compared month below, on one shared scale. */
export function CategoryComparison({ rows, baseLabel, targetLabel }: { rows: readonly Row[]; baseLabel: string; targetLabel: string }) {
  const visible = fold(rows)
  const max = Math.max(1, ...visible.flatMap((row) => [row.baseMinor, row.targetMinor]))
  const width = (value: number) => (value > 0 ? `${Math.max(1.5, (value / max) * 100)}%` : '0%')

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-label="Leyenda">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-cmp-base" />{baseLabel}</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-cmp-target" />{targetLabel}</span>
      </div>
      <ul className="grid gap-3.5">
        {visible.map((row) => (
          <li
            key={row.category}
            tabIndex={0}
            className="group relative grid gap-1.5 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-focus"
            aria-label={`${row.category}: ${baseLabel} ${formatMoney(row.baseMinor)}, ${targetLabel} ${formatMoney(row.targetMinor)}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
              <span className="min-w-0 truncate font-medium">{row.category}</span>
              <SpendDelta deltaMinor={row.deltaMinor} deltaPct={row.deltaPct} isNew={row.baseMinor === 0 && row.targetMinor > 0} />
            </div>
            <div aria-hidden className="grid gap-[2px]">
              <span className="grow-x block h-2.5 rounded-r-[4px] bg-cmp-base" style={{ width: width(row.baseMinor) }} />
              <span className="grow-x block h-2.5 rounded-r-[4px] bg-cmp-target" style={{ width: width(row.targetMinor) }} />
            </div>
            <div className="flex justify-between gap-2 text-[12px] text-muted tabular-nums">
              <span>{baseLabel}: {formatMoney(row.baseMinor)}</span>
              <span>{targetLabel}: {formatMoney(row.targetMinor)}</span>
            </div>
            <div
              role="tooltip"
              className="pointer-events-none invisible absolute top-0 right-0 z-10 w-max -translate-y-[calc(100%+6px)] rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12px] opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
            >
              <p className="mb-1 font-semibold">{row.category}</p>
              <p className="flex gap-3 text-ink-2">{baseLabel}<b className="ml-auto text-ink tabular-nums">{formatMoney(row.baseMinor)} · {row.baseCount} reg.</b></p>
              <p className="flex gap-3 text-ink-2">{targetLabel}<b className="ml-auto text-ink tabular-nums">{formatMoney(row.targetMinor)} · {row.targetCount} reg.</b></p>
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}
