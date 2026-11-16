'use client'

import { formatMoney } from '@kaligula/domain'
import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/ui/panel'
import { cn } from '@/lib/cn'
import { useSummary } from '../use-finance'

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

function StatCard({ icon, iconClass, label, value, footer }: { icon: ReactNode; iconClass: string; label: string; value: string; footer: ReactNode }) {
  return (
    // Phones: compact full-width row (icon · label/footer · value). From `sm`: vertical tile.
    <article className="col-span-2 flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-4 sm:col-span-1 sm:flex-col sm:items-stretch sm:gap-0 sm:p-5">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg sm:hidden', iconClass)}>{icon}</span>
      <div className="min-w-0 flex-1 sm:flex sm:flex-none sm:items-center sm:justify-between sm:gap-2">
        <span className="block truncate text-[13px] font-medium text-ink-2">{label}</span>
        <span className={cn('hidden size-8 shrink-0 place-items-center rounded-lg sm:grid', iconClass)}>{icon}</span>
        <span className="mt-0.5 block truncate text-[12px] text-muted sm:hidden">{footer}</span>
      </div>
      <strong className="shrink-0 text-lg font-semibold tracking-tight tabular-nums sm:mt-3 sm:truncate sm:text-2xl">{value}</strong>
      <span className="mt-1 hidden text-[13px] text-muted sm:block">{footer}</span>
    </article>
  )
}

export function SummaryCards() {
  const summary = useSummary()
  const { currentMonth, monthlyChangePct, expenseRatioPct } = summary
  const trendUp = (monthlyChangePct ?? 0) >= 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-[1.55fr_1fr_1fr_1fr]">
      <article className="relative col-span-2 overflow-hidden rounded-2xl border-2 border-outline bg-bezel p-5 text-white sm:col-span-3 xl:col-span-1">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow className="text-bezel-text">Saldo disponible</Eyebrow>
          <span className="rounded-full border border-accent/40 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-accent uppercase">En vivo</span>
        </div>
        <strong className="mt-3 block truncate text-[clamp(1.9rem,4vw,2.6rem)] leading-none font-semibold tracking-tight tabular-nums">
          {formatMoney(summary.balanceMinor)}
        </strong>
        <p className="mt-3 max-w-[30ch] text-[13px] text-bezel-text">Ingresos menos gastos de todo tu historial.</p>
        <div aria-hidden className="pointer-events-none absolute -right-3 -bottom-4 h-20 w-28 opacity-40">
          <i className="absolute bottom-0 left-0 size-11 rounded-full border-[5px] border-accent" />
          <i className="absolute right-0 bottom-3 size-11 rounded-full border-[5px] border-accent" />
          <i className="absolute bottom-7 left-7 size-11 rounded-full border-[5px] border-accent" />
        </div>
      </article>

      <StatCard
        label="Ingresos del mes"
        icon={<ArrowDownLeft size={17} aria-hidden />}
        iconClass="bg-income-soft text-income"
        value={formatMoney(currentMonth.incomeMinor)}
        footer={`Histórico ${formatMoney(summary.totals.income, { compact: true })}`}
      />
      <StatCard
        label="Gastos del mes"
        icon={<ArrowUpRight size={17} aria-hidden />}
        iconClass="bg-expense-soft text-expense"
        value={formatMoney(currentMonth.expenseMinor)}
        footer={expenseRatioPct === null ? 'Sin ingresos este mes' : `${percent.format(expenseRatioPct)}% de tus ingresos`}
      />
      <StatCard
        label="Ahorro del mes"
        icon={trendUp ? <TrendingUp size={17} aria-hidden /> : <TrendingDown size={17} aria-hidden />}
        iconClass={trendUp ? 'bg-accent text-on-accent' : 'bg-loan-soft text-loan'}
        value={formatMoney(currentMonth.netMinor)}
        footer={
          monthlyChangePct === null ? (
            'Sin datos del mes anterior'
          ) : (
            <span className={trendUp ? 'text-positive' : 'text-negative'}>
              {trendUp ? '▲' : '▼'} {percent.format(Math.abs(monthlyChangePct))}% vs. mes anterior
            </span>
          )
        }
      />
    </div>
  )
}
