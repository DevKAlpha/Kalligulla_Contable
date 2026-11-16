'use client'

import { formatMoney } from '@kaligula/domain'
import { Pencil, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'
import { useGoal } from '../use-finance'

const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

export function GoalCard({ className }: { className?: string }) {
  const { goal, pct, remainingMinor, done } = useGoal()
  const openDialog = useUiStore((state) => state.openDialog)

  return (
    <Panel className={cn('flex flex-col', goal && 'bg-[color-mix(in_oklab,var(--accent)_22%,var(--surface))]', className)}>
      <PanelHeader
        eyebrow="Meta activa"
        title={goal?.name ?? 'Meta de ahorro'}
        action={
          <button
            type="button"
            onClick={() => openDialog('goal')}
            aria-label={goal ? 'Editar meta' : 'Crear meta'}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-2 border-outline bg-accent text-on-accent shadow-[2px_2px_0_var(--outline)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {goal ? <Pencil size={16} aria-hidden /> : <Plus size={18} aria-hidden />}
          </button>
        }
      />
      {goal ? (
        <div className="mt-auto">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <strong className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(goal.savedMinor)}</strong>
            <span className="text-[13px] text-ink-2">de {formatMoney(goal.targetMinor)}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Progreso de la meta"
            className="mt-3 h-4 rounded-md border-2 border-outline bg-surface p-[2px]"
          >
            <span className="pixel-progress block h-full text-loan transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-2 text-[13px] text-ink-2">
            <span>{percent.format(pct)}% completado</span>
            <span>{done ? '¡Meta cumplida!' : `Faltan ${formatMoney(remainingMinor)}`}</span>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Target size={20} aria-hidden />}
          title="Aún no tienes una meta"
          action={<Button size="sm" onClick={() => openDialog('goal')}>Crear meta</Button>}
        >
          Define cuánto quieres ahorrar y sigue tu avance desde aquí.
        </EmptyState>
      )}
    </Panel>
  )
}
