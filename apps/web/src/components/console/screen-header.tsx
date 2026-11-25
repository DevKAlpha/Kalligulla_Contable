'use client'

import { initials } from '@kaligula/domain'
import { useProfile } from '@/features/finance/queries'
import { useUiStore } from '@/features/ui/ui-store'

export function ScreenHeader() {
  const profile = useProfile()
  const name = profile.data?.name ?? ''
  const ready = profile.isSuccess
  const openDialog = useUiStore((state) => state.openDialog)

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-screen/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={() => openDialog('profile')}
        className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl text-left"
        aria-label="Editar perfil"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border-2 border-outline bg-income font-mono text-[13px] font-medium text-white shadow-[3px_3px_0_var(--outline)]">
          {ready ? initials(name) : ''}
        </span>
        <span className="min-w-0">
          <span className="hidden font-mono text-[11px] tracking-[0.1em] text-muted uppercase sm:block">{name ? 'Bienvenido de nuevo' : 'Configura tu perfil'}</span>
          <strong className="block truncate text-[15px] font-semibold">{ready ? name || 'Invitado' : ' '}</strong>
        </span>
      </button>

      {/* Actions live on the console controls: A B X Y and the system keys. */}
      <span aria-hidden className="hidden font-mono text-[11px] tracking-[0.14em] text-muted uppercase sm:block">Kaligula</span>
    </header>
  )
}
