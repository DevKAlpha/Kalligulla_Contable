'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Eyebrow, Panel, PanelHeader } from '@/components/ui/panel'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { FxBoard } from '@/features/market/fx-board'
import { MarketMovers } from '@/features/market/market-movers'
import { NewsPanel } from '@/features/news/news-panel'
import { useUiStore } from '@/features/ui/ui-store'
import { CashFlowChart } from '../components/cash-flow-chart'
import { CategoryBreakdown } from '../components/category-breakdown'
import { GoalsCard } from '../components/goals-card'
import { LocalImportBanner } from '../components/local-import-banner'
import { MovementList } from '../components/movement-list'
import { PageFrame } from '../components/page-frame'
import { SummaryCards, SummaryCardsSkeleton } from '../components/summary-cards'
import { useMovementPages, useOverview } from '../queries'

const period = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const RECENT = {}

function RecentMovements({ className }: { className?: string }) {
  const recent = useMovementPages(RECENT, 5)
  return (
    <Panel className={className} aria-labelledby="recent-title">
      <PanelHeader
        id="recent-title"
        eyebrow="Historial"
        title="Movimientos recientes"
        action={recent.total > 0 && (
          <Link href="/gastos" className="shrink-0 text-[13px] font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">Ver todos →</Link>
        )}
      />
      {recent.isPending ? (
        <div className="grid gap-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-12" />)}</div>
      ) : recent.isError ? (
        <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
      ) : (
        <MovementList movements={recent.items} emptyText="Pulsa el botón + de la consola para añadir tu primer registro." />
      )}
    </Panel>
  )
}

export function DashboardView() {
  const openMovement = useUiStore((state) => state.openMovement)
  const overview = useOverview()

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

      <LocalImportBanner />
      <FxBoard className="mb-3" />

      {overview.isPending ? (
        <SummaryCardsSkeleton />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : (
        <SummaryCards overview={overview.data} />
      )}

      <NewsPanel className="mt-3" />

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-3">
          {overview.isSuccess ? <CashFlowChart flow={overview.data.cashFlow} /> : <Skeleton className="h-72 rounded-2xl" />}
          <RecentMovements />
        </div>
        <div className="grid min-w-0 content-start gap-3">
          <GoalsCard />
          {overview.isSuccess ? <CategoryBreakdown breakdown={overview.data.expenseBreakdown} /> : <Skeleton className="h-56 rounded-2xl" />}
        </div>
      </div>

      <MarketMovers className="mt-3" />
    </PageFrame>
  )
}
