'use client'

import { DomainError, PROFILE_NAME_MAX_LENGTH } from '@kaligula/domain'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { useFinanceStore } from '@/features/finance/finance-store'
import { useUiStore } from '@/features/ui/ui-store'

function ProfileForm({ onDone }: { onDone: () => void }) {
  const currentName = useFinanceStore((state) => state.profile.name)
  const setProfileName = useFinanceStore((state) => state.setProfileName)
  const notify = useUiStore((state) => state.notify)
  const [name, setName] = useState(currentName)
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      setProfileName(name)
      notify('Perfil actualizado', 'success')
      onDone()
    } catch (reason) {
      setError(reason instanceof DomainError ? reason.message : 'No fue posible guardar el perfil.')
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <TextField
        label="¿Cómo te llamas?"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Tu nombre"
        maxLength={PROFILE_NAME_MAX_LENGTH}
        autoComplete="name"
        data-autofocus
        error={error}
        hint="Solo se usa para personalizar la consola. Se guarda en este dispositivo."
      />
      <Button type="submit" size="lg" className="w-full">Guardar perfil</Button>
    </form>
  )
}

export function ProfileDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'profile')
  const closeDialog = useUiStore((state) => state.closeDialog)
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Perfil" title="Tu consola">
      {open && <ProfileForm onDone={closeDialog} />}
    </Dialog>
  )
}
