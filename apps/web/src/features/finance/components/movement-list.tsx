'use client'

import type { MovementDto } from '@kaligula/contracts'
import { formatMoney, MOVEMENT_TYPE_LABELS, parseIsoDate } from '@kaligula/domain'
import { useQueryClient } from '@tanstack/react-query'
import { Inbox, Pencil, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/panel'
import { useUiStore } from '@/features/ui/ui-store'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { TYPE_STYLE } from '@/lib/navigation'
import { restoreMovement, useDeleteMovement } from '../queries'

const dayFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })

function MovementRow({ movement }: { movement: MovementDto }) {
  const style = TYPE_STYLE[movement.type]
  const Icon = style.icon
  const openMovement = useUiStore((state) => state.openMovement)
  const notify = useUiStore((state) => state.notify)
  const client = useQueryClient()
  const deleteMovement = useDeleteMovement()

  // The row disappears at once (optimistic update), so per-call `mutate` callbacks would never run:
  // the promise of `mutateAsync` settles even after unmount.
  const remove = () => {
    deleteMovement.mutateAsync(movement).then(
      () => notify(`“${movement.description}” eliminado`, 'info', {
        label: 'Deshacer',
        run: () => {
          restoreMovement(client, movement).then(
            () => notify('Registro restaurado', 'success'),
            (error) => notify(errorMessage(error, 'No fue posible restaurar el registro.'), 'error'),
          )
        },
      }),
      (error) => notify(errorMessage(error, 'No fue posible eliminar el registro.'), 'error'),
    )
  }

  return (
    <li className="group flex items-center gap-3 py-3">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', style.soft, style.text)}>
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{movement.description}</p>
        <p className="truncate text-[13px] text-muted" title={movement.note ?? undefined}>
          {dayFormat.format(parseIsoDate(movement.occurredOn)).replace('.', '')} · {MOVEMENT_TYPE_LABELS[movement.type]} · {movement.category}
          {movement.note ? ` · ${movement.note}` : ''}
        </p>
      </div>
      <strong className={cn('shrink-0 text-[15px] font-semibold tabular-nums', movement.type === 'income' && 'text-positive')}>
        {style.sign}{formatMoney(movement.amountMinor)}
      </strong>
      <div className="flex shrink-0 gap-1 sm:opacity-60 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => openMovement(movement.type, movement)}
          aria-label={`Editar ${movement.description}`}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Pencil size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleteMovement.isPending}
          aria-label={`Eliminar ${movement.description}`}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-loan-soft hover:text-loan disabled:opacity-40"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  )
}

interface MovementListProps {
  movements: readonly MovementDto[]
  groupByMonth?: boolean
  emptyTitle?: string
  emptyText?: string
}

export function MovementList({ movements, groupByMonth = false, emptyTitle = 'Aún no hay registros', emptyText }: MovementListProps) {
  if (movements.length === 0) {
    return <EmptyState icon={<Inbox size={20} aria-hidden />} title={emptyTitle}>{emptyText}</EmptyState>
  }

  if (!groupByMonth) {
    return <ul className="divide-y divide-line">{movements.map((movement) => <MovementRow key={movement.id} movement={movement} />)}</ul>
  }

  const groups = new Map<string, MovementDto[]>()
  for (const movement of movements) {
    const key = movement.occurredOn.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), movement])
  }

  return (
    <div className="grid gap-5">
      {[...groups.entries()].map(([key, items]) => (
        <section key={key} aria-label={monthFormat.format(parseIsoDate(`${key}-01`))}>
          <h3 className="sticky top-0 z-[5] -mx-1 bg-surface/95 px-1 py-1.5 font-mono text-[11px] tracking-[0.12em] text-muted uppercase backdrop-blur">
            {monthFormat.format(parseIsoDate(`${key}-01`))}
          </h3>
          <ul className="divide-y divide-line">{items.map((movement) => <MovementRow key={movement.id} movement={movement} />)}</ul>
        </section>
      ))}
    </div>
  )
}
