'use client'

import { PROFILE_NAME_MAX_LENGTH } from '@kaligula/domain'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { useUiStore } from '@/features/ui/ui-store'
import { errorMessage } from '@/lib/api-client'
import { useProfile, useSaveProfile } from '../queries'

function ProfileForm({ initialName, onDone }: { initialName: string; onDone: () => void }) {
  const saveProfile = useSaveProfile()
  const notify = useUiStore((state) => state.notify)
  const [name, setName] = useState(initialName)
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveProfile.mutate(name, {
      onSuccess: () => {
        notify('Perfil actualizado', 'success')
        onDone()
      },
      onError: (reason) => setError(errorMessage(reason, 'No fue posible guardar el perfil.')),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <TextField
        label="¿Cómo te llamas?"
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setError('')
        }}
        placeholder="Tu nombre"
        maxLength={PROFILE_NAME_MAX_LENGTH}
        autoComplete="name"
        data-autofocus
        error={error}
        hint="Solo se usa para personalizar la consola."
      />
      <Button type="submit" size="lg" className="w-full" disabled={saveProfile.isPending}>{saveProfile.isPending ? 'Guardando…' : 'Guardar perfil'}</Button>
    </form>
  )
}

export function ProfileDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'profile')
  const closeDialog = useUiStore((state) => state.closeDialog)
  const profile = useProfile()
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Perfil" title="Tu consola">
      {open && profile.isSuccess && <ProfileForm initialName={profile.data.name} onDone={closeDialog} />}
    </Dialog>
  )
}
