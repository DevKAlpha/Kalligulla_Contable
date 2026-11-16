'use client'

import { formatMoney, MOVEMENT_TYPE_LABELS, parseIsoDate, type Movement } from '@kaligula/domain'
import { Inbox, Pencil, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/panel'
import { useFinanceStore } from '@/features/finance/finance-store'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'
import { TYPE_STYLE } from '@/lib/navigation'

const dayFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })

function MovementRow({ movement }: { movement: Movement }) {
  const style = TYPE_STYLE[movement.type]
  const Icon = style.icon
  const openMovement = useUiStore((state) => state.openMovement)
  const notify = useUiStore((state) => state.notify)
  const removeMovement = useFinanceStore((state) => state.removeMovement)
  const restoreMovement = useFinanceStore((state) => state.restoreMovement)

  const remove = () => {
    const removed = removeMovement(movement.id)
    if (removed) notify(`“${removed.description}” eliminado`, 'info', { label: 'Deshacer', run: () => restoreMovement(removed) })
  }

  return (
    <li className="group flex items-center gap-3 py-3">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', style.soft, style.text)}>
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{movement.description}</p>
        <p className="truncate text-[13px] text-muted">
          {dayFormat.format(parseIsoDate(movement.occurredOn)).replace('.', '')} · {MOVEMENT_TYPE_LABELS[movement.type]} · {movement.category}
        </p>
      </div>
      <strong className={cn('shrink-0 text-[15px] font-semibold tabular-nums', movement.type === 'income' && 'text-positive')}>
        {style.sign}{formatMoney(movement.amountMinor)}
      </strong>
      <div className="flex shrink-0 gap-1 sm:opacity-60 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => openMovement(movement.type, movement.id)}
          aria-label={`Editar ${movement.description}`}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Pencil size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label={`Eliminar ${movement.description}`}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-loan-soft hover:text-loan"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  )
}

interface MovementListProps {
  movements: readonly Movement[]
  limit?: number
  groupByMonth?: boolean
  emptyTitle?: string
  emptyText?: string
}

export function MovementList({ movements, limit, groupByMonth = false, emptyTitle = 'Aún no hay registros', emptyText }: MovementListProps) {
  const visible = limit ? movements.slice(0, limit) : movements
  if (visible.length === 0) {
    return <EmptyState icon={<Inbox size={20} aria-hidden />} title={emptyTitle}>{emptyText}</EmptyState>
  }

  if (!groupByMonth) {
    return <ul className="divide-y divide-line">{visible.map((movement) => <MovementRow key={movement.id} movement={movement} />)}</ul>
  }

  const groups = new Map<string, Movement[]>()
  for (const movement of visible) {
    const key = movement.occurredOn.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), movement])
  }

  return (
    <div className="grid gap-5">
      {[...groups.entries()].map(([key, items]) => (
          <section key={key} aria-label={monthFormat.format(parseIsoDate(`${key}-01`))}>
            <h3 className="sticky top-0 z-[5] -mx-1 bg-surface/95 px-1 py-1.5 font-mono text-[11px] tracking-[0.12em] text-muted uppercase backdrop-blur">
              {monthFormat.format(parseIsoDate(`${key}-01`))} · {items.length} {items.length === 1 ? 'registro' : 'registros'}
            </h3>
            <ul className="divide-y divide-line">{items.map((movement) => <MovementRow key={movement.id} movement={movement} />)}</ul>
          </section>
      ))}
    </div>
  )
}
