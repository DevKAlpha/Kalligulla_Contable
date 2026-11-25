'use client'

import type { GoalDto } from '@kaligula/contracts'
import { formatMoney, goalProgress, parseIsoDate } from '@kaligula/domain'
import { Settings2, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'
import { useGoals } from '../queries'

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const monthYear = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })
const VISIBLE = 3

export function GoalProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className="h-4 rounded-md border-2 border-outline bg-surface p-[2px]"
    >
      <span className="pixel-progress grow-x block h-full text-loan" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** One-line advice for a goal: amount left, monthly contribution or deadline status. */
export function goalHint(goal: GoalDto): string {
  const progress = goalProgress(goal)
  if (progress.done) return '¡Meta cumplida!'
  if (progress.overdue) return `Venció en ${monthYear.format(parseIsoDate(goal.targetDate!))} · faltan ${formatMoney(progress.remainingMinor)}`
  if (progress.suggestedMonthlyMinor !== null) {
    return `Ahorra ${formatMoney(progress.suggestedMonthlyMinor)}/mes hasta ${monthYear.format(parseIsoDate(goal.targetDate!))}`
  }
  return `Faltan ${formatMoney(progress.remainingMinor)}`
}

function GoalRow({ goal }: { goal: GoalDto }) {
  const { pct } = goalProgress(goal)
  return (
    <li className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-semibold">{goal.name}</span>
        <span className="shrink-0 text-[13px] text-ink-2 tabular-nums">{percent.format(pct)}%</span>
      </div>
      <GoalProgressBar pct={pct} label={`Progreso de ${goal.name}`} />
      <div className="flex flex-wrap justify-between gap-x-2 text-[12px] text-ink-2">
        <span className="tabular-nums">{formatMoney(goal.savedMinor)} de {formatMoney(goal.targetMinor)}</span>
        <span>{goalHint(goal)}</span>
      </div>
    </li>
  )
}

export function GoalsCard({ className }: { className?: string }) {
  const goals = useGoals()
  const openDialog = useUiStore((state) => state.openDialog)
  const items = goals.data ?? []

  return (
    <Panel className={cn(items.length > 0 && 'bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface))]', className)} aria-labelledby="goals-title">
      <PanelHeader
        id="goals-title"
        eyebrow={items.length > 1 ? `${items.length} metas activas` : 'Meta activa'}
        title="Metas de ahorro"
        action={
          <button
            type="button"
            onClick={() => openDialog('goals')}
            aria-label="Gestionar metas"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-2 border-outline bg-accent text-on-accent shadow-[2px_2px_0_var(--outline)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <Settings2 size={16} aria-hidden />
          </button>
        }
      />
      {goals.isPending ? (
        <div className="grid gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : goals.isError ? (
        <ErrorState error={goals.error} onRetry={() => goals.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Target size={20} aria-hidden />}
          title="Aún no tienes metas"
          action={<Button size="sm" onClick={() => openDialog('goals')}>Crear meta</Button>}
        >
          Define cuánto quieres ahorrar y para cuándo. Kaligula te dirá cuánto apartar cada mes.
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-4">{items.slice(0, VISIBLE).map((goal) => <GoalRow key={goal.id} goal={goal} />)}</ul>
          {items.length > VISIBLE && (
            <button type="button" onClick={() => openDialog('goals')} className="mt-3 cursor-pointer text-[13px] font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Ver las {items.length} metas →
            </button>
          )}
        </>
      )}
    </Panel>
  )
}
