'use client'

import type { OverviewDto } from '@kaligula/contracts'
import { formatMoney } from '@kaligula/domain'
import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Eyebrow } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/cn'

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
// Counting values pass through fractions of a peso; show whole minor units while animating.
const money = (minor: number) => formatMoney(Math.round(minor))

function StatCard({ icon, iconClass, label, minor, footer }: { icon: ReactNode; iconClass: string; label: string; minor: number; footer: ReactNode }) {
  return (
    // Phones: compact full-width row (icon · label/footer · value). From `sm`: vertical tile.
    <article className="col-span-2 flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-4 sm:col-span-1 sm:flex-col sm:items-stretch sm:gap-0 sm:p-5">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg sm:hidden', iconClass)}>{icon}</span>
      <div className="min-w-0 flex-1 sm:flex sm:flex-none sm:items-center sm:justify-between sm:gap-2">
        <span className="block truncate text-[13px] font-medium text-ink-2">{label}</span>
        <span className={cn('hidden size-8 shrink-0 place-items-center rounded-lg sm:grid', iconClass)}>{icon}</span>
        <span className="mt-0.5 block truncate text-[12px] text-muted sm:hidden">{footer}</span>
      </div>
      <strong className="shrink-0 text-lg font-semibold tracking-tight tabular-nums sm:mt-3 sm:truncate sm:text-2xl"><AnimatedNumber value={minor} format={money} /></strong>
      <span className="mt-1 hidden text-[13px] text-muted sm:block">{footer}</span>
    </article>
  )
}

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-[1.55fr_1fr_1fr_1fr]'

export function SummaryCardsSkeleton() {
  return (
    <div className={GRID} aria-hidden>
      <Skeleton className="col-span-2 h-36 rounded-2xl sm:col-span-3 xl:col-span-1" />
      {[0, 1, 2].map((key) => <Skeleton key={key} className="col-span-2 h-[72px] rounded-2xl sm:col-span-1 sm:h-36" />)}
    </div>
  )
}

export function SummaryCards({ overview }: { overview: OverviewDto }) {
  const { currentMonth, monthlyChangePct, expenseRatioPct } = overview
  const trendUp = (monthlyChangePct ?? 0) >= 0

  return (
    <div className={GRID}>
      <article className="relative col-span-2 overflow-hidden rounded-2xl border-2 border-outline bg-bezel p-5 text-white sm:col-span-3 xl:col-span-1">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow className="text-bezel-text">Saldo disponible</Eyebrow>
          <span className="rounded-full border border-accent/40 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-accent uppercase">Guardado</span>
        </div>
        <strong className="mt-3 block truncate text-[clamp(1.9rem,4vw,2.6rem)] leading-none font-semibold tracking-tight tabular-nums">
          <AnimatedNumber value={overview.balanceMinor} format={money} duration={800} />
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
        minor={currentMonth.incomeMinor}
        footer={`Histórico ${formatMoney(overview.totals.income, { compact: true })}`}
      />
      <StatCard
        label="Gastos del mes"
        icon={<ArrowUpRight size={17} aria-hidden />}
        iconClass="bg-expense-soft text-expense"
        minor={currentMonth.expenseMinor}
        footer={expenseRatioPct === null ? 'Sin ingresos este mes' : `${percent.format(expenseRatioPct)}% de tus ingresos`}
      />
      <StatCard
        label="Ahorro del mes"
        icon={trendUp ? <TrendingUp size={17} aria-hidden /> : <TrendingDown size={17} aria-hidden />}
        iconClass={trendUp ? 'bg-accent text-on-accent' : 'bg-loan-soft text-loan'}
        minor={currentMonth.netMinor}
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
