'use client'

import { ChartColumnBig, HardDriveDownload, Moon, Newspaper, Sun, Tags, Target, UserRound, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { useTheme } from '@/features/theme/theme'
import { useUiStore } from '@/features/ui/ui-store'

interface Entry {
  label: string
  hint: string
  icon: LucideIcon
  run: (event: MouseEvent<HTMLButtonElement>) => void
}

/** SELECT on the handheld: every action that has no button of its own on a phone. */
function MenuContent() {
  const router = useRouter()
  const closeDialog = useUiStore((state) => state.closeDialog)
  const openDialog = useUiStore((state) => state.openDialog)
  const openCategories = useUiStore((state) => state.openCategories)
  const { theme, toggle } = useTheme()
  const go = (href: string) => {
    closeDialog()
    router.push(href)
  }

  const entries: Entry[] = [
    { label: 'Noticias', hint: 'En vivo', icon: Newspaper, run: () => go('/noticias') },
    { label: 'Comparar', hint: 'Mes a mes', icon: ChartColumnBig, run: () => go('/gastos/comparar') },
    { label: 'Metas', hint: 'Ahorro', icon: Target, run: () => openDialog('goals') },
    { label: 'Categorías', hint: 'Organizar', icon: Tags, run: () => openCategories('expense') },
    { label: 'Respaldo', hint: 'Copia CSV', icon: HardDriveDownload, run: () => openDialog('backup') },
    { label: 'Perfil', hint: 'Tu nombre', icon: UserRound, run: () => openDialog('profile') },
    {
      label: 'Tema',
      hint: theme === 'dark' ? 'A claro' : 'A oscuro',
      icon: theme === 'dark' ? Sun : Moon,
      run: (event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        closeDialog()
        toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      },
    },
  ]

  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {entries.map(({ label, hint, icon: Icon, run }) => (
        <li key={label}>
          <button
            type="button"
            onClick={run}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-outline bg-surface p-2.5 text-left shadow-[3px_3px_0_var(--outline)] transition-transform duration-100 active:translate-y-[2px] active:shadow-[1px_1px_0_var(--outline)]"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2"><Icon size={17} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">{label}</span>
              <span className="block truncate text-[12px] text-muted">{hint}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ConsoleMenuDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'console-menu')
  const closeDialog = useUiStore((state) => state.closeDialog)
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Select" title="Menú">
      {open && <MenuContent />}
    </Dialog>
  )
}
