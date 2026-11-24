'use client'

import { formatMoney } from '@kaligula/domain'
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceMax } from '@/lib/chart'
import { cn } from '@/lib/cn'

interface Series {
  label: string
  values: readonly number[]
}

interface PaceChartProps {
  base: Series
  target: Series
  /** Day used to compare both months while the target month is in progress. */
  compareDay: number | null
}

const compact = (minor: number) => formatMoney(minor, { compact: true }).replace(/\s/g, '')

/**
 * Cumulative spending by day of month for two months (2 series, one axis).
 * Hover or arrow keys move a crosshair; a hidden table gives the same data to screen readers.
 */
export function PaceChart({ base, target, compareDay }: PaceChartProps) {
  const days = Math.max(base.values.length, target.values.length, 2)
  const max = niceMax(Math.max(0, ...base.values, ...target.values))
  const x = (day: number) => ((day - 1) / (days - 1)) * 100
  const y = (value: number) => 100 - (value / max) * 100
  const path = (values: readonly number[]) => values.map((value, index) => `${index ? 'L' : 'M'}${x(index + 1)},${y(value)}`).join(' ')
  const [hover, setHover] = useState<number | null>(null)

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    setHover(Math.round(ratio * (days - 1)) + 1)
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setHover((day) => Math.min(days, Math.max(1, (day ?? compareDay ?? days) + (event.key === 'ArrowRight' ? 1 : -1))))
  }

  const at = (values: readonly number[], day: number) => (day <= values.length ? values[day - 1] : null)
  const hoverBase = hover ? at(base.values, hover) : null
  const hoverTarget = hover ? at(target.values, hover) : null

  // Direct labels at line ends, nudged apart when they would overlap.
  const ends = [
    { key: 'base', label: base.label, values: base.values },
    { key: 'target', label: target.label, values: target.values },
  ].filter((series) => series.values.length > 0).map((series) => ({ ...series, top: y(series.values[series.values.length - 1]), left: x(series.values.length) }))
  if (ends.length === 2 && Math.abs(ends[0].top - ends[1].top) < 9) {
    const [upper, lower] = ends[0].top <= ends[1].top ? [ends[0], ends[1]] : [ends[1], ends[0]]
    upper.top -= 4.5
    lower.top += 4.5
  }

  const ticks = [max, max / 2, 0]
  const xTicks = [1, 8, 15, 22, days]

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-label="Leyenda">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-5 border-t-2 border-dashed border-cmp-base" />{base.label}</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-5 rounded bg-cmp-target" />{target.label}</span>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div aria-hidden className="relative h-56 w-12 font-mono text-[10px] text-muted sm:h-64">
          {ticks.map((tick, index) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: `${index * 50}%` }}>{compact(tick)}</span>
          ))}
        </div>

        <div
          className="relative h-56 cursor-crosshair rounded-md outline-none focus-visible:outline-2 focus-visible:outline-focus sm:h-64"
          tabIndex={0}
          role="img"
          aria-label={`Gasto acumulado por día: ${base.label} ${formatMoney(base.values.at(-1) ?? 0)}, ${target.label} ${formatMoney(target.values.at(-1) ?? 0)}. Usa las flechas para recorrer los días.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((tick) => <span key={tick} className="block border-t border-dashed border-line last:border-solid last:border-line-strong" />)}
          </div>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
            {base.values.length > 0 && (
              <path d={path(base.values)} fill="none" stroke="var(--cmp-base)" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            )}
            {target.values.length > 0 && (
              <path d={path(target.values)} fill="none" stroke="var(--expense)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            )}
          </svg>

          {compareDay && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-dashed border-ink-2/50" style={{ left: `${x(compareDay)}%` }}>
              <span className="absolute -top-5 -translate-x-1/2 rounded bg-surface-2 px-1.5 font-mono text-[10px] text-ink-2 uppercase">Hoy</span>
            </div>
          )}

          {ends.map((end) => (
            <span
              key={end.key}
              aria-hidden
              className="pointer-events-none absolute translate-x-1.5 -translate-y-1/2 rounded bg-surface/90 px-1 text-[11px] font-semibold whitespace-nowrap text-ink-2"
              style={{ top: `${end.top}%`, left: `min(${end.left}%, calc(100% - 3.5rem))` }}
            >
              {end.label}
            </span>
          ))}

          {hover && (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-line-strong" style={{ left: `${x(hover)}%` }} />
              {[{ value: hoverBase, color: 'bg-cmp-base' }, { value: hoverTarget, color: 'bg-expense' }].map((dot) => dot.value !== null && (
                <span
                  key={dot.color}
                  aria-hidden
                  className={cn('pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface', dot.color)}
                  style={{ left: `${x(hover)}%`, top: `${y(dot.value)}%` }}
                />
              ))}
              <div
                role="status"
                className={cn(
                  'pointer-events-none absolute top-1 z-10 w-max rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12px] shadow-lg',
                  x(hover) > 55 ? '-translate-x-[calc(100%+10px)]' : 'translate-x-2.5',
                )}
                style={{ left: `${x(hover)}%` }}
              >
                <p className="mb-1 font-semibold">Día {hover}</p>
                <p className="flex items-center gap-2 text-ink-2"><i className="size-2 rounded-[2px] bg-cmp-base" />{base.label}<b className="ml-auto pl-3 text-ink tabular-nums">{hoverBase === null ? '—' : formatMoney(hoverBase)}</b></p>
                <p className="flex items-center gap-2 text-ink-2"><i className="size-2 rounded-[2px] bg-expense" />{target.label}<b className="ml-auto pl-3 text-ink tabular-nums">{hoverTarget === null ? 'Aún no' : formatMoney(hoverTarget)}</b></p>
                {hoverBase !== null && hoverTarget !== null && (
                  <p className="mt-1 border-t border-line pt-1 text-ink-2">Diferencia <b className="text-ink tabular-nums">{formatMoney(hoverTarget - hoverBase)}</b></p>
                )}
              </div>
            </>
          )}
        </div>

        <span />
        <div aria-hidden className="relative mt-1.5 h-4 font-mono text-[11px] text-muted">
          {xTicks.map((day) => (
            <span key={day} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${x(day)}%` }}>{day}</span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Gasto acumulado por día del mes</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">{base.label}</th><th scope="col">{target.label}</th></tr></thead>
        <tbody>
          {Array.from({ length: days }, (_, index) => (
            <tr key={index}>
              <th scope="row">{index + 1}</th>
              <td>{at(base.values, index + 1) === null ? '—' : formatMoney(base.values[index])}</td>
              <td>{at(target.values, index + 1) === null ? '—' : formatMoney(target.values[index])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
