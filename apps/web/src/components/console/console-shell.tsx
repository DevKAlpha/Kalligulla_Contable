'use client'

import { HardDriveDownload, Moon, Plus, Sun, Tags, Target } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useTheme } from '@/features/theme/theme'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'
import { isActive, NAV_ITEMS } from '@/lib/navigation'
import { ConsoleButtonKey, ConsoleLinkKey } from './console-key'
import { ScreenHeader } from './screen-header'
import { StatusStrip } from './status-strip'

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-12 place-items-center rounded-xl border-2 border-outline bg-accent font-mono text-xl font-medium text-on-accent shadow-[3px_3px_0_var(--outline)]',
        className,
      )}
    >
      K
    </span>
  )
}

/** Left rail (desktop): brand + module keys + speaker grille. */
function LeftRail({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden min-h-0 flex-col items-center gap-4 py-3 lg:flex" aria-label="Módulos">
      <BrandMark />
      <nav className="mt-3 flex flex-col gap-3.5" aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => (
          <ConsoleLinkKey
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.shortLabel}
            active={isActive(pathname, item.href)}
            className="h-[68px] w-[76px]"
          />
        ))}
      </nav>
      <div aria-hidden className="grille mt-auto h-24 w-14 rounded-lg" />
    </aside>
  )
}

/** Right rail (desktop): primary action + secondary function keys. */
function RightRail() {
  const openMovement = useUiStore((state) => state.openMovement)
  const openDialog = useUiStore((state) => state.openDialog)
  const openCategories = useUiStore((state) => state.openCategories)
  const { theme, toggle } = useTheme()
  return (
    <aside className="hidden min-h-0 flex-col items-center gap-3.5 py-3 lg:flex" aria-label="Acciones rápidas">
      <ConsoleButtonKey
        icon={Plus}
        label="Nuevo"
        tone="accent"
        shape="round"
        onClick={() => openMovement('expense')}
        className="size-[76px] text-[11px]"
      />
      <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">Registro</span>
      <div className="mt-3 flex flex-col gap-3.5">
        <ConsoleButtonKey icon={Target} label="Metas" onClick={() => openDialog('goals')} className="h-[60px] w-[76px]" />
        <ConsoleButtonKey icon={Tags} label="Categorías" onClick={() => openCategories('expense')} className="h-[60px] w-[76px] text-[10px]" />
        <ConsoleButtonKey icon={HardDriveDownload} label="Respaldo" onClick={() => openDialog('backup')} className="h-[60px] w-[76px]" />
        <ConsoleButtonKey
          icon={theme === 'dark' ? Sun : Moon}
          label={theme === 'dark' ? 'Claro' : 'Oscuro'}
          onClick={toggle}
          className="h-[60px] w-[76px]"
        />
      </div>
      <div aria-hidden className="grille mt-auto h-24 w-14 rounded-lg" />
    </aside>
  )
}

/** Bottom control deck (phones and tablets): module keys around a central "+" key. */
function ControlDeck({ pathname }: { pathname: string }) {
  const openMovement = useUiStore((state) => state.openMovement)
  const [first, second, third, fourth] = NAV_ITEMS
  const key = (item: (typeof NAV_ITEMS)[number]) => (
    <ConsoleLinkKey
      key={item.href}
      href={item.href}
      icon={item.icon}
      label={item.shortLabel}
      active={isActive(pathname, item.href)}
      className="h-14 w-full text-[10px] sm:h-16 sm:text-[11px]"
    />
  )
  return (
    <nav aria-label="Navegación principal" className="shrink-0 px-1 pt-3 pb-[max(6px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-2 sm:gap-3">
        {key(first)}
        {key(second)}
        <ConsoleButtonKey
          icon={Plus}
          label="Nuevo registro"
          hideLabel
          tone="accent"
          shape="round"
          onClick={() => openMovement('expense')}
          className="size-16 sm:size-[72px] [&_svg]:size-7"
        />
        {key(third)}
        {key(fourth)}
      </div>
      <div aria-hidden className="mx-auto mt-2.5 flex max-w-xl items-center justify-between px-2">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">Kaligula · K-1</span>
        <span className="grille h-3 w-20 rounded-sm" />
      </div>
    </nav>
  )
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex h-dvh flex-col p-1.5 pt-[max(6px,env(safe-area-inset-top))] sm:p-3 lg:p-5">
      <div
        className={cn(
          'relative mx-auto flex min-h-0 w-full max-w-[1640px] flex-1 flex-col rounded-[28px] border-[3px] border-outline bg-shell p-2',
          'shadow-[inset_2px_2px_0_var(--shell-hi),inset_-3px_-3px_0_var(--shell-lo),6px_8px_0_var(--outline)]',
          'sm:rounded-[34px] sm:p-3 md:max-w-3xl lg:grid lg:max-w-[1640px] lg:grid-cols-[96px_minmax(0,1fr)_96px] lg:gap-4 lg:rounded-[40px] lg:p-4',
        )}
      >
        <LeftRail pathname={pathname} />

        <div className="flex min-h-0 flex-1 flex-col rounded-[22px] border-2 border-outline bg-bezel p-2 sm:p-2.5">
          <StatusStrip />
          <div className="scanlines relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-screen text-ink">
            <ScreenHeader />
            <main id="contenido" className="scroll-area min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              {children}
            </main>
          </div>
        </div>

        <RightRail />
        <ControlDeck pathname={pathname} />
      </div>
    </div>
  )
}
