'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Eyebrow, Panel, PanelHeader } from '@/components/ui/panel'
import { useUiStore } from '@/features/ui/ui-store'
import { CashFlowChart } from '../components/cash-flow-chart'
import { CategoryBreakdown } from '../components/category-breakdown'
import { GoalCard } from '../components/goal-card'
import { MovementList } from '../components/movement-list'
import { PageFrame } from '../components/page-frame'
import { SummaryCards } from '../components/summary-cards'
import { useMovements } from '../use-finance'

const period = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })

export function DashboardView() {
  const openMovement = useUiStore((state) => state.openMovement)
  const movements = useMovements()

  return (
    <PageFrame label="Resumen">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <Eyebrow>Resumen · {period.format(new Date())}</Eyebrow>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3.25rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
            Tu dinero, <span className="text-loan">bajo control.</span>
          </h1>
        </div>
        <Button size="lg" className="max-sm:hidden" onClick={() => openMovement('expense')}>
          <Plus size={18} aria-hidden />
          Nuevo registro
        </Button>
      </div>

      <SummaryCards />

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <CashFlowChart className="xl:col-span-2" />
        <GoalCard />
        <Panel className="xl:col-span-2" aria-labelledby="recent-title">
          <PanelHeader
            id="recent-title"
            eyebrow="Historial"
            title="Movimientos recientes"
            action={movements.length > 0 && (
              <Link href="/gastos" className="shrink-0 text-[13px] font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">Ver todos →</Link>
            )}
          />
          <MovementList movements={movements} limit={5} emptyText="Pulsa el botón + de la consola para añadir tu primer registro." />
        </Panel>
        <CategoryBreakdown />
      </div>
    </PageFrame>
  )
}
