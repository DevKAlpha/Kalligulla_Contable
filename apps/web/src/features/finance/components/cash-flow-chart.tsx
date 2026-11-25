'use client'

import { formatMoney, type CashFlowMonth } from '@kaligula/domain'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { niceMax } from '@/lib/chart'
import { cn } from '@/lib/cn'

const monthShort = new Intl.DateTimeFormat('es-CO', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })

function monthDate(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function Bar({ value, max, delay, className }: { value: number; max: number; delay: number; className: string }) {
  const height = value > 0 ? Math.max(2, (value / max) * 100) : 0
  // Grows with transform (no layout work); bars enter one month after another.
  return <span className={cn('grow-y block w-[min(16px,38%)] rounded-t-[4px]', className)} style={{ height: `${height}%`, animationDelay: `${delay}ms` }} />
}

function MonthColumn({ month, max, align, index }: { month: CashFlowMonth; max: number; align: 'start' | 'end'; index: number }) {
  const label = monthLong.format(monthDate(month.key))
  return (
    <div
      tabIndex={0}
      aria-label={`${label}: ingresos ${formatMoney(month.incomeMinor)}, gastos ${formatMoney(month.expenseMinor)}`}
      className="group relative flex h-full min-w-0 cursor-default items-end justify-center gap-[2px] rounded-md outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
    >
      <Bar value={month.incomeMinor} max={max} delay={index * 60} className="bg-income" />
      <Bar value={month.expenseMinor} max={max} delay={index * 60 + 30} className="bg-expense" />
      <div
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-[calc(100%+6px)] z-10 w-max rounded-lg border border-line-strong bg-surface px-3 py-2 text-left text-[12px] shadow-lg',
          'invisible opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100',
          align === 'start' ? 'left-0' : 'right-0',
        )}
      >
        <p className="mb-1 font-semibold capitalize">{label}</p>
        <p className="flex items-center gap-2 text-ink-2"><i className="size-2 rounded-[2px] bg-income" />Ingresos <b className="ml-auto pl-3 font-semibold text-ink tabular-nums">{formatMoney(month.incomeMinor)}</b></p>
        <p className="flex items-center gap-2 text-ink-2"><i className="size-2 rounded-[2px] bg-expense" />Gastos <b className="ml-auto pl-3 font-semibold text-ink tabular-nums">{formatMoney(month.expenseMinor)}</b></p>
      </div>
    </div>
  )
}

export function CashFlowChart({ flow, className }: { flow: readonly CashFlowMonth[]; className?: string }) {
  const hasData = flow.some((month) => month.incomeMinor || month.expenseMinor)
  const max = niceMax(Math.max(0, ...flow.flatMap((month) => [month.incomeMinor, month.expenseMinor])))
  const ticks = [max, max / 2, 0]
  const current = flow.at(-1)

  return (
    <Panel className={className} aria-labelledby="cashflow-title">
      <PanelHeader
        id="cashflow-title"
        eyebrow="Flujo de dinero"
        title="Últimos 6 meses"
        action={
          <div className="flex items-center gap-3 text-[12px] text-ink-2" aria-label="Leyenda">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-income" />Ingresos</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-expense" />Gastos</span>
          </div>
        }
      />

      <figure className="m-0">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          <div aria-hidden className="relative h-44 w-11 font-mono text-[10px] text-muted sm:h-48">
            {ticks.map((tick, index) => (
              <span key={tick} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: `${index * 50}%` }}>
                {hasData ? formatMoney(tick, { compact: true }).replace(/\s/g, '') : ''}
              </span>
            ))}
          </div>
          <div className="relative h-44 sm:h-48">
            <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
              {ticks.map((tick) => <span key={tick} className="block border-t border-dashed border-line last:border-solid last:border-line-strong" />)}
            </div>
            {!hasData && (
              <p className="absolute inset-0 z-[1] grid place-items-center font-mono text-[12px] tracking-[0.08em] text-muted uppercase">
                Añade tu primer movimiento
              </p>
            )}
            <div className="relative grid h-full grid-cols-6 gap-1 sm:gap-2">
              {flow.map((month, index) => (
                <MonthColumn key={month.key} month={month} max={max} index={index} align={index < flow.length / 2 ? 'start' : 'end'} />
              ))}
            </div>
          </div>
          <span />
          <div aria-hidden className="mt-2 grid grid-cols-6 gap-1 text-center font-mono text-[11px] text-muted uppercase sm:gap-2">
            {flow.map((month, index) => (
              <span key={month.key} className={cn(index === flow.length - 1 && 'font-medium text-ink')}>
                {monthShort.format(monthDate(month.key)).replace('.', '')}
              </span>
            ))}
          </div>
        </div>
        {current && hasData && (
          <figcaption className="mt-3 text-[13px] text-ink-2">
            Este mes: ingresos <b className="text-ink tabular-nums">{formatMoney(current.incomeMinor)}</b> · gastos{' '}
            <b className="text-ink tabular-nums">{formatMoney(current.expenseMinor)}</b>
          </figcaption>
        )}

        <table className="sr-only">
          <caption>Ingresos y gastos por mes</caption>
          <thead><tr><th scope="col">Mes</th><th scope="col">Ingresos</th><th scope="col">Gastos</th></tr></thead>
          <tbody>
            {flow.map((month) => (
              <tr key={month.key}>
                <th scope="row">{monthLong.format(monthDate(month.key))}</th>
                <td>{formatMoney(month.incomeMinor)}</td>
                <td>{formatMoney(month.expenseMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </Panel>
  )
}
