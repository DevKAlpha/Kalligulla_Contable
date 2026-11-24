'use client'

import type { ComparisonDto, ComparisonInsightDto } from '@kaligula/contracts'
import {
  defaultComparison, formatMoney, isMonthKey, monthKey, parseIsoDate, sameMonthLastYear, shiftMonth,
} from '@kaligula/domain'
import { ArrowLeftRight, CalendarRange, Info, ReceiptText, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState, Eyebrow, Panel, PanelHeader } from '@/components/ui/panel'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { CategoryComparison, SpendDelta } from '../components/category-comparison'
import { PaceChart } from '../components/pace-chart'
import { PageFrame } from '../components/page-frame'
import { useComparison } from '../queries'

const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(2026, index, 1)))
const monthLong = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
const monthShort = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3)} ${key.slice(2, 4)}`
const dayMonth = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

/* ---------- Period selection (kept in the URL so it survives reloads and the back button) ---------- */

function useMonthPair() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const fallback = defaultComparison()
  const base = isMonthKey(params.get('base')) ? params.get('base')! : fallback.base
  const target = isMonthKey(params.get('target')) ? params.get('target')! : fallback.target
  const set = useCallback((next: { base: string; target: string }) => {
    router.replace(`${pathname}?${new URLSearchParams(next)}`, { scroll: false })
  }, [pathname, router])
  return { base, target, set }
}

function MonthPicker({ label, value, years, onChange, tone }: { label: string; value: string; years: number[]; onChange: (key: string) => void; tone: string }) {
  const [year, month] = value.split('-')
  const control = 'h-11 cursor-pointer rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-ink capitalize focus:border-outline focus:outline-none focus-visible:outline-[3px] focus-visible:outline-focus'
  return (
    <fieldset className="grid min-w-0 gap-1.5">
      <legend className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.1em] text-ink-2 uppercase">
        <i aria-hidden className={cn('size-2.5 rounded-[3px]', tone)} />
        {label}
      </legend>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <select aria-label={`${label}: mes`} value={month} onChange={(event) => onChange(`${year}-${event.target.value}`)} className={control}>
          {MONTHS.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}
        </select>
        <select aria-label={`${label}: año`} value={year} onChange={(event) => onChange(`${event.target.value}-${month}`)} className={control}>
          {years.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    </fieldset>
  )
}

/* ---------- Summary ---------- */

function Tile({ label, value, base, delta }: { label: string; value: string; base: string; delta: ReactNode }) {
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <Eyebrow>{label}</Eyebrow>
      <strong className="mt-2 block truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</strong>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[12px] text-muted">
        <span className="tabular-nums">{base}</span>
        {delta}
      </div>
    </article>
  )
}

/** Change badge where more is better (income, savings). */
function GainDelta({ from, to }: { from: number; to: number }) {
  const delta = to - from
  if (delta === 0) return <span className="font-semibold text-ink-2">Igual</span>
  const up = delta > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', up ? 'text-positive' : 'text-negative')}>
      <Icon size={13} aria-hidden />
      {up ? '+' : '−'}{formatMoney(Math.abs(delta))}
    </span>
  )
}

function Summary({ data }: { data: ComparisonDto }) {
  const { base, target } = data
  const b = monthShort(base.key)
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Gastos" value={formatMoney(target.expenseMinor)} base={`${b}: ${formatMoney(base.expenseMinor)}`}
        delta={<SpendDelta deltaMinor={target.expenseMinor - base.expenseMinor} deltaPct={base.expenseMinor ? ((target.expenseMinor - base.expenseMinor) / base.expenseMinor) * 100 : null} />} />
      <Tile label="Gasto diario promedio" value={formatMoney(target.dailyAvgExpenseMinor)} base={`${b}: ${formatMoney(base.dailyAvgExpenseMinor)}`}
        delta={<SpendDelta deltaMinor={target.dailyAvgExpenseMinor - base.dailyAvgExpenseMinor} deltaPct={base.dailyAvgExpenseMinor ? ((target.dailyAvgExpenseMinor - base.dailyAvgExpenseMinor) / base.dailyAvgExpenseMinor) * 100 : null} />} />
      <Tile label="Ingresos" value={formatMoney(target.incomeMinor)} base={`${b}: ${formatMoney(base.incomeMinor)}`} delta={<GainDelta from={base.incomeMinor} to={target.incomeMinor} />} />
      <Tile label="Ahorro neto" value={formatMoney(target.netMinor)} base={`${b}: ${formatMoney(base.netMinor)}`} delta={<GainDelta from={base.netMinor} to={target.netMinor} />} />
    </div>
  )
}

/* ---------- Insights ---------- */

function describe(insight: ComparisonInsightDto, base: string, target: string): { text: ReactNode; icon: typeof Info; tone: string } {
  const pct = (value: number | null) => (value === null ? '' : ` (${value > 0 ? '+' : '−'}${percent.format(Math.abs(value))} %)`)
  const money = (minor: number) => <b className="text-ink tabular-nums">{formatMoney(Math.abs(minor))}</b>
  switch (insight.kind) {
    case 'total':
      if (insight.deltaMinor === 0) return { text: <>Gastaste lo mismo en {target} que en {base}.</>, icon: Info, tone: 'text-ink-2' }
      return insight.deltaMinor > 0
        ? { text: <>En {target} gastas {money(insight.deltaMinor)} más que en {base}{pct(insight.deltaPct)}.</>, icon: TrendingUp, tone: 'text-negative' }
        : { text: <>En {target} gastas {money(insight.deltaMinor)} menos que en {base}{pct(insight.deltaPct)}.</>, icon: TrendingDown, tone: 'text-positive' }
    case 'pace': {
      const ahead = insight.targetMinor > insight.baseMinor
      return {
        text: <>Al día {insight.day} llevas {money(insight.targetMinor)}; a esa misma fecha de {base} llevabas {money(insight.baseMinor)}{pct(insight.deltaPct)}. {ahead ? 'Vas por encima del ritmo.' : 'Vas por debajo del ritmo.'}</>,
        icon: CalendarRange,
        tone: ahead ? 'text-negative' : 'text-positive',
      }
    }
    case 'category_up':
      return { text: <><b className="text-ink">{insight.category}</b> es lo que más subió: {money(insight.deltaMinor)} más{pct(insight.deltaPct)}.</>, icon: TrendingUp, tone: 'text-negative' }
    case 'category_down':
      return { text: <><b className="text-ink">{insight.category}</b> es lo que más bajó: {money(insight.deltaMinor)} menos{pct(insight.deltaPct)}.</>, icon: TrendingDown, tone: 'text-positive' }
    case 'new_category':
      return { text: <>Gasto nuevo en <b className="text-ink">{insight.category}</b>: {money(insight.amountMinor)} (en {base} no hubo).</>, icon: Sparkles, tone: 'text-ink-2' }
    case 'gone_category':
      return { text: <>Sin gastos en <b className="text-ink">{insight.category}</b> este periodo (en {base} fueron {money(insight.amountMinor)}).</>, icon: TrendingDown, tone: 'text-positive' }
    case 'biggest_expense':
      return {
        text: <>Tu mayor gasto de {target}: <b className="text-ink">{insight.description}</b> ({insight.category}) por {money(insight.amountMinor)} el {dayMonth.format(parseIsoDate(insight.occurredOn)).replace('.', '')}.</>,
        icon: ReceiptText,
        tone: 'text-ink-2',
      }
  }
}

function Insights({ data }: { data: ComparisonDto }) {
  const base = monthLong(data.base.key)
  const target = monthLong(data.target.key)
  return (
    <ul className="grid gap-2.5">
      {data.insights.map((insight, index) => {
        const { text, icon: Icon, tone } = describe(insight, base, target)
        return (
          <li key={`${insight.kind}-${index}`} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3 text-[14px] leading-snug text-ink-2">
            <Icon size={18} aria-hidden className={cn('mt-0.5 shrink-0', tone)} />
            <span>{text}</span>
          </li>
        )
      })}
    </ul>
  )
}

function TopExpenses({ items, label, tone }: { items: ComparisonDto['topExpenses']['base']; label: string; tone: string }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] text-muted uppercase"><i aria-hidden className={cn('size-2.5 rounded-[3px]', tone)} />{label}</h3>
      {items.length === 0 ? (
        <p className="py-3 text-[13px] text-muted">Sin gastos.</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{item.description}</p>
                <p className="truncate text-[12px] text-muted">{dayMonth.format(parseIsoDate(item.occurredOn)).replace('.', '')} · {item.category}</p>
              </div>
              <strong className="shrink-0 text-[14px] tabular-nums">{formatMoney(item.amountMinor)}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* ---------- Page ---------- */

export function ComparisonView() {
  const { base, target, set } = useMonthPair()
  const comparison = useComparison(base, target)
  const data = comparison.data
  // Years offered: from the first year with records (at least last year) to this year, plus any year already chosen.
  const currentYear = Number(monthKey(new Date()).slice(0, 4))
  const firstYear = Math.min(currentYear - 1, data?.range.first ? Number(data.range.first.slice(0, 4)) : currentYear)
  const years = [...new Set([
    ...Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index),
    Number(base.slice(0, 4)),
    Number(target.slice(0, 4)),
  ])].sort((a, b) => b - a)
  const nothing = data && data.base.expenseMinor === 0 && data.target.expenseMinor === 0

  return (
    <PageFrame label="Comparar gastos">
      <section className="relative mb-3 overflow-hidden rounded-3xl border-2 border-outline bg-expense-soft px-5 pt-6 pb-6 shadow-[4px_4px_0_var(--outline)] sm:px-8 sm:pt-8">
        <Eyebrow className="text-ink-2"><Link href="/gastos" className="hover:underline">Gastos</Link> · Análisis</Eyebrow>
        <h1 className="mt-2 text-[clamp(2.2rem,6vw,4rem)] leading-[0.9] font-semibold tracking-[-0.05em]">Comparar gastos</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-ink-2">
          Elige dos meses para ver en qué gastas más o menos. Si el mes comparado sigue en curso, también los medimos al mismo día.
        </p>
      </section>

      <Panel className="mb-3" aria-label="Meses a comparar">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <MonthPicker label="Mes base" value={base} years={years} tone="bg-cmp-base" onChange={(key) => set({ base: key, target })} />
          <button
            type="button"
            onClick={() => set({ base: target, target: base })}
            aria-label="Intercambiar meses"
            title="Intercambiar meses"
            className="grid size-11 cursor-pointer place-items-center justify-self-center rounded-xl border border-line-strong text-ink-2 hover:border-outline hover:text-ink max-md:rotate-90"
          >
            <ArrowLeftRight size={18} aria-hidden />
          </button>
          <MonthPicker label="Mes a comparar" value={target} years={years} tone="bg-cmp-target" onChange={(key) => set({ base, target: key })} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => set({ base: shiftMonth(target, -1), target })}>Contra el mes anterior</Button>
          <Button size="sm" variant="secondary" onClick={() => set({ base: sameMonthLastYear(target), target })}>Contra el mismo mes del año pasado</Button>
          <Button size="sm" variant="ghost" onClick={() => set(defaultComparison())}>Este mes vs. el anterior</Button>
        </div>
        {base === target && <p className="mt-3 text-[13px] text-muted">Elegiste el mismo mes en ambos lados.</p>}
      </Panel>

      {comparison.isPending ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-28 rounded-2xl" />)}</div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : comparison.isError && !data ? (
        <ErrorState error={comparison.error} onRetry={() => comparison.refetch()} />
      ) : data && (
        <div className={cn('grid gap-3 transition-opacity', comparison.isPlaceholderData && 'opacity-60')} aria-busy={comparison.isFetching}>
          <Summary data={data} />

          {nothing ? (
            <Panel>
              <EmptyState icon={<CalendarRange size={20} aria-hidden />} title="No hay gastos en estos meses">
                Registra gastos o elige otros meses para compararlos.
              </EmptyState>
            </Panel>
          ) : (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="grid min-w-0 content-start gap-3">
                <Panel aria-labelledby="pace-title">
                  <PanelHeader id="pace-title" eyebrow="Ritmo de gasto" title="Gasto acumulado día a día" />
                  <PaceChart
                    base={{ label: monthShort(data.base.key), values: data.pace.base }}
                    target={{ label: monthShort(data.target.key), values: data.pace.target }}
                    compareDay={data.pace.compareDay}
                  />
                </Panel>
                <Panel aria-labelledby="categories-compare-title">
                  <PanelHeader id="categories-compare-title" eyebrow="Por categoría" title="¿En qué cambió tu gasto?" />
                  <CategoryComparison rows={data.categories} baseLabel={monthShort(data.base.key)} targetLabel={monthShort(data.target.key)} />
                </Panel>
              </div>
              <div className="grid min-w-0 content-start gap-3">
                <Panel aria-labelledby="insights-title">
                  <PanelHeader id="insights-title" eyebrow="Control de gastos" title="Lo más importante" />
                  <Insights data={data} />
                </Panel>
                <Panel aria-labelledby="top-title">
                  <PanelHeader id="top-title" eyebrow="Gastos más grandes" title="Top 5 de cada mes" />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <TopExpenses items={data.topExpenses.target} label={monthLong(data.target.key)} tone="bg-cmp-target" />
                    <TopExpenses items={data.topExpenses.base} label={monthLong(data.base.key)} tone="bg-cmp-base" />
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </div>
      )}
    </PageFrame>
  )
}
