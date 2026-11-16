'use client'

import { formatMoney, monthKey, type Movement, type MovementType } from '@kaligula/domain'
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eyebrow, Panel, PanelHeader } from '@/components/ui/panel'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'
import { TYPE_STYLE } from '@/lib/navigation'
import { MovementList } from '../components/movement-list'
import { PageFrame } from '../components/page-frame'
import { useCategoryBreakdown, useMovements, useSummary } from '../use-finance'

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

const EXPENSE_TYPES = ['income', 'expense'] as const
const INVESTMENT_TYPES = ['investment'] as const
const LOAN_TYPES = ['loan'] as const

export const MODULES: Record<ModuleId, ModuleConfig> = {
  gastos: {
    number: '02', title: 'Gastos', entryType: 'expense', listTypes: EXPENSE_TYPES, action: 'Registrar gasto', band: 'bg-expense-soft',
    description: 'Registra ingresos y gastos para entender el movimiento real de tu dinero.', historyTitle: 'Ingresos y gastos',
  },
  inversiones: {
    number: '03', title: 'Inversiones', entryType: 'investment', listTypes: INVESTMENT_TYPES, action: 'Añadir inversión', band: 'bg-invest-soft',
    description: 'Registra el capital que destinas a cada inversión y consulta tus posiciones.', historyTitle: 'Historial de inversiones',
  },
  prestamos: {
    number: '04', title: 'Préstamos', entryType: 'loan', listTypes: LOAN_TYPES, action: 'Añadir préstamo', band: 'bg-loan-soft',
    description: 'Mantén visibles las obligaciones que necesitas controlar y elimina las que hayas cerrado.', historyTitle: 'Historial de préstamos',
  },
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

const sum = (items: readonly Movement[]) => items.reduce((total, item) => total + item.amountMinor, 0)

function useModuleStats(id: ModuleId, movements: readonly Movement[]) {
  const summary = useSummary()
  const breakdown = useCategoryBreakdown('expense')
  return useMemo(() => {
    if (id === 'gastos') {
      const top = breakdown[0]
      const thisMonth = movements.filter((item) => item.type === 'expense' && monthKey(item.occurredOn) === monthKey(new Date()))
      return [
        { label: 'Gastos del mes', value: formatMoney(summary.currentMonth.expenseMinor), detail: `${thisMonth.length} registros este mes` },
        { label: 'Mayor categoría', value: top?.category ?? 'Sin registros', detail: top ? `${formatMoney(top.amountMinor)} este mes` : 'Aún no hay gastos este mes' },
        { label: 'Saldo disponible', value: formatMoney(summary.balanceMinor), detail: 'Ingresos menos gastos' },
      ]
    }
    const latest = movements[0]
    const noun = id === 'inversiones' ? 'Posiciones' : 'Obligaciones'
    return [
      { label: id === 'inversiones' ? 'Capital registrado' : 'Saldo registrado', value: formatMoney(sum(movements)), detail: 'Total bajo seguimiento' },
      { label: noun, value: String(movements.length), detail: id === 'inversiones' ? 'Inversiones registradas' : 'Préstamos registrados' },
      { label: id === 'inversiones' ? 'Último aporte' : 'Último préstamo', value: formatMoney(latest?.amountMinor ?? 0), detail: latest?.description ?? 'Sin registros' },
    ]
  }, [id, movements, summary, breakdown])
}

export function ModuleView({ id }: { id: ModuleId }) {
  const config = MODULES[id]
  const openMovement = useUiStore((state) => state.openMovement)
  const movements = useMovements(config.listTypes)
  const stats = useModuleStats(id, movements)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<MovementType | 'all'>('all')
  const Icon = TYPE_STYLE[config.entryType].icon

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es-CO')
    return movements.filter((item) =>
      (typeFilter === 'all' || item.type === typeFilter) &&
      (!needle || `${item.description} ${item.category} ${item.note ?? ''}`.toLocaleLowerCase('es-CO').includes(needle)),
    )
  }, [movements, query, typeFilter])

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
          <Button size="lg" onClick={() => openMovement(config.entryType)}>
            <Plus size={18} aria-hidden />
            {config.action}
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => <StatTile key={stat.label} {...stat} />)}
      </div>

      <Panel className="mt-3" aria-labelledby={`${id}-history`}>
        <PanelHeader
          id={`${id}-history`}
          eyebrow="Historial"
          title={config.historyTitle}
          action={<span className={cn('grid size-9 place-items-center rounded-xl', TYPE_STYLE[config.entryType].soft, TYPE_STYLE[config.entryType].text)}><Icon size={18} aria-hidden /></span>}
        />
        {movements.length > 0 && (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Buscar registros</span>
              <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por descripción, categoría o nota"
                className="h-11 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-9 text-[14px] placeholder:text-muted focus:border-outline focus:outline-none focus-visible:outline-[3px] focus-visible:outline-focus"
              />
            </label>
            {id === 'gastos' && (
              <div role="group" aria-label="Filtrar por tipo" className="flex gap-1 rounded-xl border border-line-strong bg-surface p-1">
                {([['all', 'Todos'], ['income', 'Ingresos'], ['expense', 'Gastos']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={typeFilter === value}
                    onClick={() => setTypeFilter(value)}
                    className="h-9 flex-1 cursor-pointer rounded-lg px-3 text-[13px] font-semibold text-ink-2 aria-pressed:bg-bezel aria-pressed:text-white"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <MovementList
          movements={filtered}
          groupByMonth
          emptyTitle={movements.length ? 'Sin resultados' : 'Aún no hay registros'}
          emptyText={movements.length ? 'Prueba con otra búsqueda o filtro.' : `Usa “${config.action}” para empezar.`}
        />
      </Panel>
    </PageFrame>
  )
}
