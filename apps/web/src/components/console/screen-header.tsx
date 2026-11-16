'use client'

import { initials } from '@kaligula/domain'
import { HardDriveDownload, Moon, Sun, Target } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { useFinanceHydrated, useFinanceStore } from '@/features/finance/finance-store'
import { useTheme } from '@/features/theme/theme'
import { useUiStore } from '@/features/ui/ui-store'

export function ScreenHeader() {
  const name = useFinanceStore((state) => state.profile.name)
  const hydrated = useFinanceHydrated()
  const openDialog = useUiStore((state) => state.openDialog)
  const { theme, toggle } = useTheme()

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-screen/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={() => openDialog('profile')}
        className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl text-left"
        aria-label="Editar perfil"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border-2 border-outline bg-income font-mono text-[13px] font-medium text-white shadow-[3px_3px_0_var(--outline)]">
          {hydrated ? initials(name) : ''}
        </span>
        <span className="min-w-0">
          <span className="hidden font-mono text-[11px] tracking-[0.1em] text-muted uppercase sm:block">{name ? 'Bienvenido de nuevo' : 'Configura tu perfil'}</span>
          <strong className="block truncate text-[15px] font-semibold">{hydrated ? name || 'Invitado' : ' '}</strong>
        </span>
      </button>

      {/* On large screens these actions live on the right rail of the console. */}
      <div className="flex items-center gap-2 lg:hidden">
        <IconButton label="Meta de ahorro" onClick={() => openDialog('goal')}>
          <Target size={18} aria-hidden />
        </IconButton>
        <IconButton label="Respaldo CSV" onClick={() => openDialog('backup')}>
          <HardDriveDownload size={18} aria-hidden />
        </IconButton>
        <IconButton label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} onClick={toggle}>
          {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        </IconButton>
      </div>
    </header>
  )
}
