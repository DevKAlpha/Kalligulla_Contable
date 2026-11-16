'use client'

import type { GoalDto } from '@kaligula/contracts'
import { formatMoney, goalProgress, GOAL_NAME_MAX_LENGTH, parseMajorInput, toIsoDate, toMajor } from '@kaligula/domain'
import { ArrowLeft, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/panel'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { useUiStore } from '@/features/ui/ui-store'
import { ApiError, errorMessage } from '@/lib/api-client'
import { useDeleteGoal, useGoals, useSaveGoal } from '../queries'
import { GoalProgressBar, goalHint } from './goals-card'

const amountInputFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
type Errors = Partial<Record<'name' | 'saved' | 'target' | 'targetDate' | 'form', string>>

function GoalForm({ goal, onDone }: { goal?: GoalDto; onDone: () => void }) {
  const saveGoal = useSaveGoal()
  const notify = useUiStore((state) => state.notify)
  const [name, setName] = useState(goal?.name ?? '')
  const [saved, setSaved] = useState(goal ? amountInputFormat.format(toMajor(goal.savedMinor)) : '0')
  const [target, setTarget] = useState(goal ? amountInputFormat.format(toMajor(goal.targetMinor)) : '')
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const savedMinor = parseMajorInput(saved || '0')
    const targetMinor = parseMajorInput(target)
    const next: Errors = {}
    if (!name.trim()) next.name = 'Ponle un nombre a la meta.'
    if (savedMinor === null) next.saved = 'Escribe un valor numérico.'
    if (targetMinor === null) next.target = 'Escribe un valor numérico.'
    if (savedMinor === null || targetMinor === null || Object.keys(next).length) return setErrors(next)

    saveGoal.mutate({ id: goal?.id, input: { name, savedMinor, targetMinor, targetDate: targetDate || null } }, {
      onSuccess: () => {
        notify(goal ? 'Meta actualizada' : 'Meta creada', 'success')
        onDone()
      },
      onError: (error) => {
        const field = error instanceof ApiError ? error.field : undefined
        const key = field === 'name' || field === 'saved' || field === 'target' || field === 'targetDate' ? field : 'form'
        setErrors({ [key]: errorMessage(error, 'No fue posible guardar la meta.') })
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <TextField
        label="Nombre"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ej. Fondo de emergencia"
        maxLength={GOAL_NAME_MAX_LENGTH}
        data-autofocus
        autoFocus
        error={errors.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Ahorrado (COP)" value={saved} onChange={(event) => setSaved(event.target.value)} inputMode="decimal" error={errors.saved} />
        <TextField label="Objetivo (COP)" value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" placeholder="0" error={errors.target} />
      </div>
      <TextField
        label="Fecha objetivo (opcional)"
        type="date"
        value={targetDate}
        min={toIsoDate(new Date())}
        onChange={(event) => setTargetDate(event.target.value)}
        error={errors.targetDate}
        hint="Con una fecha calculamos cuánto ahorrar cada mes."
      />
      {errors.form && <p role="alert" className="text-[13px] font-medium text-negative">{errors.form}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={saveGoal.isPending}>
        {saveGoal.isPending ? 'Guardando…' : goal ? 'Guardar cambios' : 'Crear meta'}
      </Button>
    </form>
  )
}

function GoalItem({ goal, onEdit }: { goal: GoalDto; onEdit: () => void }) {
  const saveGoal = useSaveGoal()
  const deleteGoal = useDeleteGoal()
  const notify = useUiStore((state) => state.notify)
  const [mode, setMode] = useState<'view' | 'contribute' | 'confirm'>('view')
  const [amount, setAmount] = useState('')
  const { pct, done } = goalProgress(goal)

  const contribute = (event: FormEvent) => {
    event.preventDefault()
    const value = parseMajorInput(amount)
    if (!value) return
    saveGoal.mutate(
      { id: goal.id, input: { name: goal.name, savedMinor: goal.savedMinor + value, targetMinor: goal.targetMinor, targetDate: goal.targetDate } },
      {
        onSuccess: () => {
          notify(`Sumaste ${formatMoney(value)} a «${goal.name}»`, 'success')
          setAmount('')
          setMode('view')
        },
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    )
  }

  // The item unmounts when the list refreshes; `mutateAsync` still reports the outcome.
  const remove = () => {
    deleteGoal.mutateAsync(goal.id).then(
      () => notify(`Meta «${goal.name}» eliminada`),
      (error) => notify(errorMessage(error), 'error'),
    )
  }

  return (
    <li className="grid gap-2.5 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{goal.name}</p>
          <p className="text-[12px] text-ink-2 tabular-nums">{formatMoney(goal.savedMinor)} de {formatMoney(goal.targetMinor)}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onEdit} aria-label={`Editar ${goal.name}`} className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink">
            <Pencil size={16} aria-hidden />
          </button>
          <button type="button" onClick={() => setMode('confirm')} aria-label={`Eliminar ${goal.name}`} className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-loan-soft hover:text-loan">
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>
      <GoalProgressBar pct={pct} label={`Progreso de ${goal.name}`} />
      <p className="text-[12px] text-ink-2">{goalHint(goal)}</p>

      {mode === 'view' && !done && (
        <Button size="sm" variant="secondary" className="justify-self-start" onClick={() => setMode('contribute')}>
          <PiggyBank size={15} aria-hidden />
          Aportar
        </Button>
      )}
      {mode === 'contribute' && (
        <form onSubmit={contribute} className="flex flex-wrap items-end gap-2">
          <TextField
            label="Aporte (COP)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0"
            autoFocus
            wrapperClassName="min-w-0 flex-1"
            hint={parseMajorInput(amount) ? `Nuevo total: ${formatMoney(goal.savedMinor + (parseMajorInput(amount) ?? 0))}` : undefined}
          />
          <div className="flex gap-2 pb-0.5">
            <Button type="submit" size="sm" disabled={!parseMajorInput(amount) || saveGoal.isPending}>Sumar</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancelar</Button>
          </div>
        </form>
      )}
      {mode === 'confirm' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-loan-soft p-3 text-[13px]">
          <span className="min-w-0 flex-1">¿Eliminar «{goal.name}»? Esta acción no se puede deshacer.</span>
          <Button size="sm" variant="danger" onClick={remove} disabled={deleteGoal.isPending}>Eliminar</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancelar</Button>
        </div>
      )}
    </li>
  )
}

function GoalsManager({ onDone }: { onDone: () => void }) {
  const goals = useGoals()
  const [editing, setEditing] = useState<GoalDto | 'new' | null>(null)

  if (editing) {
    return (
      <div className="grid gap-4">
        <button type="button" onClick={() => setEditing(null)} className="inline-flex cursor-pointer items-center gap-1.5 justify-self-start text-[13px] font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft size={15} aria-hidden />
          Volver a mis metas
        </button>
        <GoalForm goal={editing === 'new' ? undefined : editing} onDone={() => (goals.data?.length ? setEditing(null) : onDone())} />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {goals.isPending ? (
        <div className="grid gap-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : goals.isError ? (
        <ErrorState error={goals.error} onRetry={() => goals.refetch()} />
      ) : goals.data.length === 0 ? (
        <EmptyState icon={<PiggyBank size={20} aria-hidden />} title="Sin metas todavía">
          Crea tu primera meta: un fondo de emergencia de 3 a 6 meses de gastos es un buen comienzo.
        </EmptyState>
      ) : (
        <ul className="grid gap-3">{goals.data.map((goal) => <GoalItem key={goal.id} goal={goal} onEdit={() => setEditing(goal)} />)}</ul>
      )}
      <Button size="lg" className="w-full" onClick={() => setEditing('new')}>
        <Plus size={18} aria-hidden />
        Nueva meta
      </Button>
    </div>
  )
}

export function GoalsDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'goals')
  const closeDialog = useUiStore((state) => state.closeDialog)
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Ahorro" title="Mis metas">
      {open && <GoalsManager onDone={closeDialog} />}
    </Dialog>
  )
}
