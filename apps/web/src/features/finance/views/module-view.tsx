'use client'

import type { MovementDto, OverviewDto } from '@kaligula/contracts'
import { formatMoney, shiftMonth, toIsoDate, monthKey, type MovementType } from '@kaligula/domain'
import { Plus, Search, Tags } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eyebrow, Panel, PanelHeader } from '@/components/ui/panel'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'
import { TYPE_STYLE } from '@/lib/navigation'
import { MovementList } from '../components/movement-list'
import { PageFrame } from '../components/page-frame'
import { useCategoriesOf, useMovementPages, useOverview, type MovementFilters } from '../queries'

export type ModuleId = 'gastos' | 'inversiones' | 'prestamos'

interface ModuleConfig {
  number: string
  title: string
  description: string
  entryType: MovementType
  listTypes: readonly MovementType[]
  action: string
  band: string
  historyTitle: string
}

export const MODULES: Record<ModuleId, ModuleConfig> = {
  gastos: {
    number: '02', title: 'Gastos', entryType: 'expense', listTypes: ['income', 'expense'], action: 'Registrar gasto', band: 'bg-expense-soft',
    description: 'Registra ingresos y gastos para entender el movimiento real de tu dinero.', historyTitle: 'Ingresos y gastos',
  },
  inversiones: {
    number: '03', title: 'Inversiones', entryType: 'investment', listTypes: ['investment'], action: 'Añadir inversión', band: 'bg-invest-soft',
    description: 'Registra el capital que destinas a cada inversión y consulta tus posiciones.', historyTitle: 'Historial de inversiones',
  },
  prestamos: {
    number: '04', title: 'Préstamos', entryType: 'loan', listTypes: ['loan'], action: 'Añadir préstamo', band: 'bg-loan-soft',
    description: 'Mantén visibles las obligaciones que necesitas controlar y elimina las que hayas cerrado.', historyTitle: 'Historial de préstamos',
  },
}

type Period = 'all' | 'month' | 'previous' | 'quarter' | 'year'
const PERIODS: [Period, string][] = [['all', 'Todo'], ['month', 'Este mes'], ['previous', 'Mes anterior'], ['quarter', 'Últimos 3 meses'], ['year', 'Este año']]

function periodRange(period: Period, today = new Date()): { from?: string; to?: string } {
  const current = monthKey(today)
  const endOfMonth = (key: string) => {
    const [year, month] = key.split('-').map(Number)
    return toIsoDate(new Date(year, month, 0))
  }
  switch (period) {
    case 'month': return { from: `${current}-01`, to: endOfMonth(current) }
    case 'previous': {
      const previous = shiftMonth(current, -1)
      return { from: `${previous}-01`, to: endOfMonth(previous) }
    }
    case 'quarter': return { from: `${shiftMonth(current, -2)}-01`, to: endOfMonth(current) }
    case 'year': return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` }
    default: return {}
  }
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <Eyebrow>{label}</Eyebrow>
      <strong className="mt-2 block truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</strong>
      <span className="mt-1 block truncate text-[13px] text-muted">{detail}</span>
    </article>
  )
}

function moduleStats(id: ModuleId, overview: OverviewDto, latest: MovementDto | undefined) {
  if (id === 'gastos') {
    const top = overview.expenseBreakdown[0]
    const count = top ? overview.expenseBreakdown.reduce((sum, row) => sum + row.count, 0) : 0
    return [
      { label: 'Gastos del mes', value: formatMoney(overview.currentMonth.expenseMinor), detail: `${count} ${count === 1 ? 'registro' : 'registros'} este mes` },
      { label: 'Mayor categoría', value: top?.category ?? 'Sin registros', detail: top ? `${formatMoney(top.amountMinor)} este mes` : 'Aún no hay gastos este mes' },
      { label: 'Saldo disponible', value: formatMoney(overview.balanceMinor), detail: 'Ingresos menos gastos' },
    ]
  }
  const type: MovementType = id === 'inversiones' ? 'investment' : 'loan'
  return [
    { label: id === 'inversiones' ? 'Capital registrado' : 'Saldo registrado', value: formatMoney(overview.totals[type]), detail: 'Total bajo seguimiento' },
    { label: id === 'inversiones' ? 'Posiciones' : 'Obligaciones', value: String(overview.counts[type]), detail: id === 'inversiones' ? 'Inversiones registradas' : 'Préstamos registrados' },
    { label: id === 'inversiones' ? 'Último aporte' : 'Último préstamo', value: formatMoney(latest?.amountMinor ?? 0), detail: latest?.description ?? 'Sin registros' },
  ]
}

const FILTER_CONTROL = 'h-11 rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-ink focus:border-outline focus:outline-none focus-visible:outline-[3px] focus-visible:outline-focus'

export function ModuleView({ id }: { id: ModuleId }) {
  const config = MODULES[id]
  const openMovement = useUiStore((state) => state.openMovement)
  const openCategories = useUiStore((state) => state.openCategories)
  const overview = useOverview()
  const categories = useCategoriesOf(config.listTypes)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<MovementType | 'all'>('all')
  const [categoryId, setCategoryId] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const search = useDeferredValue(query.trim())

  const filters = useMemo<MovementFilters>(() => ({
    types: typeFilter === 'all' ? config.listTypes : [typeFilter],
    categoryId: categoryId || undefined,
    q: search || undefined,
    ...periodRange(period),
  }), [config.listTypes, typeFilter, categoryId, search, period])
  const list = useMovementPages(filters, 30)
  const latest = useMovementPages(useMemo(() => ({ types: config.listTypes }), [config.listTypes]), 1)
  const filtering = Boolean(search || categoryId || period !== 'all' || typeFilter !== 'all')

  const Icon = TYPE_STYLE[config.entryType].icon
  const visibleCategories = categories.items.filter((category) => typeFilter === 'all' || category.type === typeFilter)

  return (
    <PageFrame label={config.title}>
      <section className={cn('relative mb-3 overflow-hidden rounded-3xl border-2 border-outline px-5 pt-6 pb-6 shadow-[4px_4px_0_var(--outline)] sm:px-8 sm:pt-8', config.band)}>
        <span aria-hidden className="pointer-events-none absolute -top-6 right-2 font-mono text-[9rem] leading-none font-medium text-ink opacity-[0.06] sm:text-[12rem]">
          {config.number}
        </span>
        <Eyebrow className="text-ink-2">Módulo {config.number}</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.4rem,7vw,4.5rem)] leading-[0.9] font-semibold tracking-[-0.05em]">{config.title}</h1>
            <p className="mt-3 text-[15px] text-ink-2">{config.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" variant="secondary" onClick={() => openCategories(config.entryType)}>
              <Tags size={18} aria-hidden />
              Categorías
            </Button>
            <Button size="lg" onClick={() => openMovement(config.entryType)}>
              <Plus size={18} aria-hidden />
              {config.action}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {overview.isSuccess
          ? moduleStats(id, overview.data, latest.items[0]).map((stat) => <StatTile key={stat.label} {...stat} />)
          : [0, 1, 2].map((key) => <Skeleton key={key} className="h-[104px] rounded-2xl" />)}
      </div>

      <Panel className="mt-3" aria-labelledby={`${id}-history`}>
        <PanelHeader
          id={`${id}-history`}
          eyebrow={list.isSuccess ? `${list.total} ${list.total === 1 ? 'registro' : 'registros'}${filtering ? ' con estos filtros' : ''}` : 'Historial'}
          title={config.historyTitle}
          action={<span className={cn('grid size-9 place-items-center rounded-xl', TYPE_STYLE[config.entryType].soft, TYPE_STYLE[config.entryType].text)}><Icon size={18} aria-hidden /></span>}
        />

        <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative">
            <span className="sr-only">Buscar registros</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por descripción, categoría o nota"
              className={cn(FILTER_CONTROL, 'w-full pl-9 placeholder:text-muted')}
            />
          </label>
          <label className="contents">
            <span className="sr-only">Categoría</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={cn(FILTER_CONTROL, 'cursor-pointer')}>
              <option value="">Todas las categorías</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{config.listTypes.length > 1 ? ` (${category.type === 'income' ? 'ingreso' : 'gasto'})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="contents">
            <span className="sr-only">Periodo</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className={cn(FILTER_CONTROL, 'cursor-pointer')}>
              {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {id === 'gastos' && (
          <div role="group" aria-label="Filtrar por tipo" className="mb-3 flex gap-1 rounded-xl border border-line-strong bg-surface p-1 sm:inline-flex">
            {([['all', 'Todos'], ['income', 'Ingresos'], ['expense', 'Gastos']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={typeFilter === value}
                onClick={() => {
                  setTypeFilter(value)
                  setCategoryId('')
                }}
                className="h-9 flex-1 cursor-pointer rounded-lg px-4 text-[13px] font-semibold text-ink-2 aria-pressed:bg-bezel aria-pressed:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {list.isPending ? (
          <div className="grid gap-3">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-12" />)}</div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <>
            <MovementList
              movements={list.items}
              groupByMonth
              emptyTitle={filtering ? 'Sin resultados' : 'Aún no hay registros'}
              emptyText={filtering ? 'Prueba con otra búsqueda o filtro.' : `Usa «${config.action}» para empezar.`}
            />
            {list.hasNextPage && (
              <Button variant="secondary" className="mt-4 w-full" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? 'Cargando…' : `Cargar más (${list.total - list.items.length} restantes)`}
              </Button>
            )}
          </>
        )}
      </Panel>
    </PageFrame>
  )
}
