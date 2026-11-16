'use client'

import type { CategoryDto } from '@kaligula/contracts'
import { CATEGORY_NAME_MAX_LENGTH, MOVEMENT_TYPE_PLURALS, MOVEMENT_TYPES, type MovementType } from '@kaligula/domain'
import { Check, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { useUiStore } from '@/features/ui/ui-store'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { TYPE_STYLE } from '@/lib/navigation'
import { useCategoriesOf, useCreateCategory, useDeleteCategory, useRenameCategory } from '../queries'

const ALL_TYPES = [...MOVEMENT_TYPES]
const uses = (count: number) => (count === 1 ? '1 registro' : `${count} registros`)

function CategoryRow({ category }: { category: CategoryDto }) {
  const renameCategory = useRenameCategory()
  const deleteCategory = useDeleteCategory()
  const notify = useUiStore((state) => state.notify)
  const [mode, setMode] = useState<'view' | 'rename' | 'confirm'>('view')
  const [name, setName] = useState(category.name)
  const [error, setError] = useState('')

  const rename = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() === category.name) return setMode('view')
    renameCategory.mutate({ id: category.id, name }, {
      onSuccess: (updated) => {
        notify(`Categoría renombrada a «${updated.name}»`, 'success')
        setMode('view')
        setError('')
      },
      onError: (reason) => setError(errorMessage(reason)),
    })
  }

  // The row unmounts when the list refreshes; `mutateAsync` still reports the outcome.
  const remove = () => {
    deleteCategory.mutateAsync(category.id).then(
      ({ reassigned }) => notify(reassigned ? `«${category.name}» eliminada · ${uses(reassigned)} ${reassigned === 1 ? 'pasó' : 'pasaron'} a «Otro»` : `«${category.name}» eliminada`),
      (reason) => notify(errorMessage(reason), 'error'),
    )
  }

  if (mode === 'rename') {
    return (
      <li className="py-2.5">
        <form onSubmit={rename} className="flex items-start gap-2">
          <TextField
            label={`Renombrar «${category.name}»`}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            autoFocus
            error={error}
            wrapperClassName="min-w-0 flex-1"
          />
          <div className="flex gap-1 pt-6">
            <button type="submit" aria-label="Guardar nombre" disabled={renameCategory.isPending} className="grid size-11 cursor-pointer place-items-center rounded-xl border-2 border-outline bg-accent text-on-accent">
              <Check size={18} aria-hidden />
            </button>
            <button type="button" aria-label="Cancelar" onClick={() => setMode('view')} className="grid size-11 cursor-pointer place-items-center rounded-xl border border-line-strong">
              <X size={18} aria-hidden />
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
            {category.name}
            {category.system && <Lock size={13} aria-label="Categoría del sistema" className="text-muted" />}
          </p>
          <p className="text-[12px] text-muted">{uses(category.movementCount)}{category.system ? ' · recibe los registros de categorías eliminadas' : ''}</p>
        </div>
        {!category.system && (
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setMode('rename')} aria-label={`Renombrar ${category.name}`} className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink">
              <Pencil size={16} aria-hidden />
            </button>
            <button type="button" onClick={() => setMode('confirm')} aria-label={`Eliminar ${category.name}`} className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-loan-soft hover:text-loan">
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        )}
      </div>
      {mode === 'confirm' && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-loan-soft p-3 text-[13px]">
          <span className="min-w-0 flex-1">
            ¿Eliminar «{category.name}»?{category.movementCount > 0 ? ` Sus ${uses(category.movementCount)} pasarán a «Otro».` : ''}
          </span>
          <Button size="sm" variant="danger" onClick={remove} disabled={deleteCategory.isPending}>Eliminar</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancelar</Button>
        </div>
      )}
    </li>
  )
}

function CategoriesManager({ initialType }: { initialType: MovementType }) {
  const [type, setType] = useState<MovementType>(initialType)
  const categories = useCategoriesOf(ALL_TYPES)
  const createCategory = useCreateCategory()
  const notify = useUiStore((state) => state.notify)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const items = categories.items.filter((category) => category.type === type)

  const create = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Escribe un nombre para la categoría.')
    createCategory.mutate({ type, name }, {
      onSuccess: (category) => {
        notify(`Categoría «${category.name}» creada`, 'success')
        setName('')
      },
      onError: (reason) => setError(errorMessage(reason)),
    })
  }

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Tipo de categoría" className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line-strong bg-surface p-1.5 sm:grid-cols-4">
        {MOVEMENT_TYPES.map((value) => {
          const Icon = TYPE_STYLE[value].icon
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={type === value}
              onClick={() => {
                setType(value)
                setError('')
              }}
              className={cn(
                'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-ink-2 transition-colors hover:bg-surface-2',
                type === value && 'bg-bezel text-white hover:bg-bezel',
              )}
            >
              <Icon size={15} aria-hidden />
              {MOVEMENT_TYPE_PLURALS[value]}
            </button>
          )
        })}
      </div>

      <form onSubmit={create} className="flex items-start gap-2">
        <TextField
          label={`Nueva categoría de ${MOVEMENT_TYPE_PLURALS[type].toLowerCase()}`}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError('')
          }}
          placeholder="Ej. Mascotas"
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          error={error}
          wrapperClassName="min-w-0 flex-1"
        />
        <button
          type="submit"
          aria-label="Crear categoría"
          disabled={createCategory.isPending}
          className="mt-6 grid size-12 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-outline bg-accent text-on-accent shadow-[3px_3px_0_var(--outline)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
        >
          <Plus size={20} aria-hidden />
        </button>
      </form>

      {categories.isPending ? (
        <div className="grid gap-2">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-12" />)}</div>
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : (
        <ul className="divide-y divide-line" aria-label={`Categorías de ${MOVEMENT_TYPE_PLURALS[type].toLowerCase()}`}>
          {items.map((category) => <CategoryRow key={category.id} category={category} />)}
        </ul>
      )}
    </div>
  )
}

export function CategoriesDialog() {
  const dialog = useUiStore((state) => state.dialog)
  const closeDialog = useUiStore((state) => state.closeDialog)
  const open = dialog?.kind === 'categories'
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Organización" title="Categorías">
      {open && <CategoriesManager initialType={dialog.type} />}
    </Dialog>
  )
}
