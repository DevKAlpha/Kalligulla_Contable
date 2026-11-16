'use client'

import { DomainError, GOAL_NAME_MAX_LENGTH, parseMajorInput, toMajor } from '@kaligula/domain'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { useFinanceStore } from '@/features/finance/finance-store'
import { useUiStore } from '@/features/ui/ui-store'

const amountInputFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
type Errors = Partial<Record<'name' | 'saved' | 'target', string>>

function GoalForm({ onDone }: { onDone: () => void }) {
  const goal = useFinanceStore((state) => state.goal)
  const saveGoal = useFinanceStore((state) => state.saveGoal)
  const clearGoal = useFinanceStore((state) => state.clearGoal)
  const notify = useUiStore((state) => state.notify)

  const [name, setName] = useState(goal?.name ?? '')
  const [saved, setSaved] = useState(goal ? amountInputFormat.format(toMajor(goal.savedMinor)) : '0')
  const [target, setTarget] = useState(goal ? amountInputFormat.format(toMajor(goal.targetMinor)) : '')
  const [errors, setErrors] = useState<Errors>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const savedMinor = parseMajorInput(saved || '0')
    const targetMinor = parseMajorInput(target)
    if (savedMinor === null) return setErrors({ saved: 'Escribe un valor numérico.' })
    if (targetMinor === null) return setErrors({ target: 'Escribe un valor numérico.' })
    try {
      saveGoal({ name, savedMinor, targetMinor })
      notify('Meta actualizada', 'success')
      onDone()
    } catch (error) {
      if (error instanceof DomainError) setErrors({ [error.field ?? 'name']: error.message })
    }
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
        error={errors.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Ahorrado (COP)" value={saved} onChange={(event) => setSaved(event.target.value)} inputMode="decimal" error={errors.saved} />
        <TextField label="Objetivo (COP)" value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" placeholder="0" error={errors.target} />
      </div>
      <Button type="submit" size="lg" className="w-full">Guardar meta</Button>
      {goal && (
        <Button
          variant="ghost"
          className="w-full text-negative"
          onClick={() => {
            clearGoal()
            notify('Meta eliminada')
            onDone()
          }}
        >
          Quitar meta
        </Button>
      )}
    </form>
  )
}

export function GoalDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'goal')
  const closeDialog = useUiStore((state) => state.closeDialog)
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Meta de ahorro" title="Configurar meta">
      {open && <GoalForm onDone={closeDialog} />}
    </Dialog>
  )
}
