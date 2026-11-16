'use client'

import type { MovementDto } from '@kaligula/contracts'
import {
  CATEGORY_NAME_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, formatMoney, MOVEMENT_TYPE_LABELS, MOVEMENT_TYPES,
  NOTE_MAX_LENGTH, parseMajorInput, toIsoDate, toMajor, type MovementType,
} from '@kaligula/domain'
import { Check, Plus, X } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/field'
import { useUiStore } from '@/features/ui/ui-store'
import { ApiError, errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { TYPE_STYLE } from '@/lib/navigation'
import { useCategoriesOf, useCreateCategory, useSaveMovement } from '../queries'

type Field = 'type' | 'description' | 'amount' | 'occurredOn' | 'categoryId' | 'note' | 'form'
type Errors = Partial<Record<Field, string>>

const NEW_CATEGORY = '__new__'
const amountInputFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, useGrouping: true })
const ALL_TYPES = [...MOVEMENT_TYPES]

/** Maps a server field name to the form field that shows the message. */
function formField(field: string | undefined): Field {
  if (field === 'amount' || field === 'amountMinor') return 'amount'
  if (field === 'description' || field === 'occurredOn' || field === 'categoryId' || field === 'note' || field === 'type') return field
  return 'form'
}

function MovementForm({ type: initialType, movement, onDone }: { type: MovementType; movement?: MovementDto; onDone: () => void }) {
  const saveMovement = useSaveMovement()
  const createCategory = useCreateCategory()
  const notify = useUiStore((state) => state.notify)
  const categories = useCategoriesOf(ALL_TYPES)

  const [type, setType] = useState<MovementType>(movement?.type ?? initialType)
  const [description, setDescription] = useState(movement?.description ?? '')
  const [amount, setAmount] = useState(movement ? amountInputFormat.format(toMajor(movement.amountMinor)) : '')
  const [occurredOn, setOccurredOn] = useState(movement?.occurredOn ?? toIsoDate(new Date()))
  const [chosenCategory, setChosenCategory] = useState<string | null>(movement?.categoryId ?? null)
  const [note, setNote] = useState(movement?.note ?? '')
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})

  const options = categories.items.filter((category) => category.type === type)
  // Default to the first custom category of the type; "Otro" (system) is listed last.
  const categoryId = options.some((category) => category.id === chosenCategory) ? chosenCategory! : (options[0]?.id ?? '')
  const parsedAmount = parseMajorInput(amount)

  /** Clears a field's error as soon as the user edits it. */
  const edit = <T,>(field: Field, setter: (value: T) => void) => (value: T) => {
    setter(value)
    setErrors((current) => (current[field] || current.form ? { ...current, [field]: undefined, form: undefined } : current))
  }

  const showErrors = (form: HTMLFormElement, next: Errors) => {
    setErrors(next)
    requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  const addCategory = () => {
    const name = newCategory?.trim()
    if (!name) return
    createCategory.mutate({ type, name }, {
      onSuccess: (category) => {
        setChosenCategory(category.id)
        setNewCategory(null)
        setErrors((current) => ({ ...current, categoryId: undefined }))
        notify(`Categoría «${category.name}» creada`, 'success')
      },
      onError: (error) => setErrors((current) => ({ ...current, categoryId: errorMessage(error) })),
    })
  }

  const onNewCategoryKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addCategory()
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      event.preventDefault()
      setNewCategory(null)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    // Report every empty required field at once; the server validates the full record again.
    const missing: Errors = {}
    if (!description.trim()) missing.description = 'Escribe una descripción.'
    if (parsedAmount === null) missing.amount = 'Escribe un valor numérico, por ejemplo 12.500.'
    if (!categoryId) missing.categoryId = 'Selecciona una categoría.'
    if (parsedAmount === null || Object.keys(missing).length > 0) return showErrors(form, missing)

    saveMovement.mutate(
      { id: movement?.id, input: { type, description, categoryId, amountMinor: parsedAmount, occurredOn, note: note.trim() || null } },
      {
        onSuccess: () => {
          notify(movement ? 'Registro actualizado' : `${MOVEMENT_TYPE_LABELS[type]} guardado`, 'success')
          onDone()
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 400) showErrors(form, { [formField(error.field)]: error.message })
          else setErrors({ form: errorMessage(error, 'No fue posible guardar el registro.') })
        },
      },
    )
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
                <input type="radio" name="type" value={value} checked={type === value} onChange={() => edit<MovementType>('type', setType)(value)} className="peer sr-only" />
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

      {newCategory === null ? (
        <SelectField
          label="Categoría"
          value={categoryId}
          disabled={categories.isPending}
          error={errors.categoryId}
          onChange={(event) => {
            if (event.target.value === NEW_CATEGORY) setNewCategory('')
            else edit('categoryId', setChosenCategory)(event.target.value)
          }}
        >
          {categories.isPending && <option value="">Cargando…</option>}
          {options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          <option value={NEW_CATEGORY}>＋ Nueva categoría…</option>
        </SelectField>
      ) : (
        <div className="grid gap-1.5">
          <TextField
            label={`Nueva categoría de ${MOVEMENT_TYPE_LABELS[type].toLowerCase()}`}
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={onNewCategoryKey}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            placeholder="Ej. Mascotas"
            autoFocus
            error={errors.categoryId}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addCategory} disabled={!newCategory.trim() || createCategory.isPending}>
              <Check size={15} aria-hidden />
              {createCategory.isPending ? 'Creando…' : 'Crear categoría'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewCategory(null)}>
              <X size={15} aria-hidden />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <TextAreaField
        label="Nota (opcional)"
        value={note}
        onChange={(event) => edit('note', setNote)(event.target.value)}
        maxLength={NOTE_MAX_LENGTH}
        rows={2}
        error={errors.note}
      />

      {errors.form && <p role="alert" className="text-[13px] font-medium text-negative">{errors.form}</p>}

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={saveMovement.isPending || newCategory !== null}>
        {movement ? <Check size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
        {saveMovement.isPending ? 'Guardando…' : movement ? 'Guardar cambios' : 'Guardar registro'}
      </Button>
    </form>
  )
}

export function MovementDialog() {
  const dialog = useUiStore((state) => state.dialog)
  const closeDialog = useUiStore((state) => state.closeDialog)
  const open = dialog?.kind === 'movement'
  const movement = open ? dialog.movement : undefined

  return (
    <Dialog open={open} onClose={closeDialog} eyebrow={movement ? 'Editar registro' : 'Nuevo registro'} title={movement ? movement.description : 'Añadir movimiento'}>
      {open && <MovementForm key={movement?.id ?? dialog.type} type={dialog.type} movement={movement} onDone={closeDialog} />}
    </Dialog>
  )
}
