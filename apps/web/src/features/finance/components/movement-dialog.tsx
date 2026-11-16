'use client'

import {
  CATEGORIES_BY_TYPE, DESCRIPTION_MAX_LENGTH, DomainError, formatMoney, MOVEMENT_TYPE_LABELS, MOVEMENT_TYPES,
  NOTE_MAX_LENGTH, parseMajorInput, toIsoDate, toMajor, type Movement, type MovementType,
} from '@kaligula/domain'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/field'
import { useFinanceStore } from '@/features/finance/finance-store'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'
import { TYPE_STYLE } from '@/lib/navigation'

type Errors = Partial<Record<'type' | 'description' | 'amount' | 'occurredOn' | 'note' | 'form', string>>

const amountInputFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, useGrouping: true })

function MovementForm({ type: initialType, movement, onDone }: { type: MovementType; movement?: Movement; onDone: () => void }) {
  const addMovement = useFinanceStore((state) => state.addMovement)
  const updateMovement = useFinanceStore((state) => state.updateMovement)
  const notify = useUiStore((state) => state.notify)

  const [type, setType] = useState<MovementType>(movement?.type ?? initialType)
  const [description, setDescription] = useState(movement?.description ?? '')
  const [amount, setAmount] = useState(movement ? amountInputFormat.format(toMajor(movement.amountMinor)) : '')
  const [occurredOn, setOccurredOn] = useState(movement?.occurredOn ?? toIsoDate(new Date()))
  const [category, setCategory] = useState(movement?.category ?? CATEGORIES_BY_TYPE[initialType][0])
  const [note, setNote] = useState(movement?.note ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const categories = CATEGORIES_BY_TYPE[type]
  const categoryOptions = categories.includes(category) ? categories : [category, ...categories]
  const parsedAmount = parseMajorInput(amount)

  const changeType = (next: MovementType) => {
    setType(next)
    if (!CATEGORIES_BY_TYPE[next].includes(category)) setCategory(CATEGORIES_BY_TYPE[next][0])
  }

  /** Clears a field's error as soon as the user edits it. */
  const edit = <T,>(field: keyof Errors, setter: (value: T) => void) => (value: T) => {
    setter(value)
    setErrors((current) => (current[field] || current.form ? { ...current, [field]: undefined, form: undefined } : current))
  }

  const showErrors = (form: HTMLFormElement, next: Errors) => {
    setErrors(next)
    requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    // Report every empty required field at once; the domain still validates the full draft below.
    const missing: Errors = {}
    if (!description.trim()) missing.description = 'Escribe una descripción.'
    if (parsedAmount === null) missing.amount = 'Escribe un valor numérico, por ejemplo 12.500.'
    if (parsedAmount === null || Object.keys(missing).length > 0) return showErrors(form, missing)

    const draft = { type, description, category, amountMinor: parsedAmount, occurredOn, note }
    try {
      if (movement) updateMovement(movement.id, draft)
      else addMovement(draft)
      notify(movement ? 'Registro actualizado' : `${MOVEMENT_TYPE_LABELS[type]} guardado en este dispositivo`, 'success')
      onDone()
    } catch (error) {
      if (error instanceof DomainError) showErrors(form, { [error.field ?? 'form']: error.message })
      else setErrors({ form: 'No fue posible guardar el registro.' })
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <fieldset>
        <legend className="mb-1.5 font-mono text-[11px] font-medium tracking-[0.1em] text-ink-2 uppercase">Tipo</legend>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line-strong bg-surface p-1.5 sm:grid-cols-4">
          {MOVEMENT_TYPES.map((value) => {
            const Icon = TYPE_STYLE[value].icon
            return (
              <label key={value} className="relative">
                <input type="radio" name="type" value={value} checked={type === value} onChange={() => changeType(value)} className="peer sr-only" />
                <span
                  className={cn(
                    'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-ink-2 transition-colors',
                    'peer-checked:bg-bezel peer-checked:text-white peer-focus-visible:outline-[3px] peer-focus-visible:outline-focus hover:bg-surface-2',
                  )}
                >
                  <Icon size={15} aria-hidden />
                  {MOVEMENT_TYPE_LABELS[value]}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <TextField
        label="Descripción"
        value={description}
        onChange={(event) => edit('description', setDescription)(event.target.value)}
        placeholder="Ej. Mercado de la semana"
        maxLength={DESCRIPTION_MAX_LENGTH}
        autoComplete="off"
        data-autofocus
        required
        error={errors.description}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Valor (COP)"
          value={amount}
          onChange={(event) => edit('amount', setAmount)(event.target.value)}
          inputMode="decimal"
          placeholder="0"
          autoComplete="off"
          required
          error={errors.amount}
          hint={parsedAmount ? formatMoney(parsedAmount) : 'Usa punto para miles: 12.500'}
        />
        <TextField
          label="Fecha"
          type="date"
          value={occurredOn}
          onChange={(event) => edit('occurredOn', setOccurredOn)(event.target.value)}
          max={toIsoDate(new Date(new Date().getFullYear() + 1, 11, 31))}
          required
          error={errors.occurredOn}
        />
      </div>

      <SelectField label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)}>
        {categoryOptions.map((option) => <option key={option}>{option}</option>)}
      </SelectField>

      <TextAreaField
        label="Nota (opcional)"
        value={note}
        onChange={(event) => edit('note', setNote)(event.target.value)}
        maxLength={NOTE_MAX_LENGTH}
        rows={2}
        error={errors.note}
      />

      {errors.form && <p role="alert" className="text-[13px] font-medium text-negative">{errors.form}</p>}

      <Button type="submit" size="lg" className="mt-1 w-full">{movement ? 'Guardar cambios' : 'Guardar registro'}</Button>
      <p className="text-center text-[12px] text-muted">Los registros se guardan en este dispositivo. Usa el respaldo CSV para copiarlos.</p>
    </form>
  )
}

export function MovementDialog() {
  const dialog = useUiStore((state) => state.dialog)
  const closeDialog = useUiStore((state) => state.closeDialog)
  const movements = useFinanceStore((state) => state.movements)
  const open = dialog?.kind === 'movement'
  const movement = open && dialog.movementId ? movements.find((item) => item.id === dialog.movementId) : undefined

  return (
    <Dialog open={open} onClose={closeDialog} eyebrow={movement ? 'Editar registro' : 'Nuevo registro'} title={movement ? movement.description : 'Añadir movimiento'}>
      {open && <MovementForm key={dialog.movementId ?? dialog.type} type={dialog.type} movement={movement} onDone={closeDialog} />}
    </Dialog>
  )
}
