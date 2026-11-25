'use client'

import { CircleDot, Copy, Ellipsis, HardDriveDownload, House, Menu, Minus, Plus, Tags, Target } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { useTheme } from '@/features/theme/theme'
import { useUiStore } from '@/features/ui/ui-store'
import { isActive, NAV_ITEMS } from '@/lib/navigation'
import {
  ARROW, DPad, FaceButtons, Legend, Stick, SystemKey, Trackpad, useStick, type Direction, type FaceItem, type PadItem,
} from './controls'
import { ScreenHeader } from './screen-header'
import { StatusStrip } from './status-strip'

/*
 * Control map. Desktop:
 *   D-pad      ▲ Inicio  ▶ Gastos  ▼ Inversión  ◀ Préstamos
 *   A Nuevo registro · B Metas · X Categorías · Y Respaldo
 *   − / View   Perfil      + / Menu   Tema claro/oscuro
 *   Home / K   Inicio      Capture / …   Comparar gastos
 * Phones and tablets (brick handheld): same D-pad, A Nuevo, B Metas, SELECT menú, START noticias.
 */

const DIRECTIONS: Record<string, Direction> = { '/': 'up', '/gastos': 'right', '/inversiones': 'down', '/prestamos': 'left' }
const COMPARE_HREF = '/gastos/comparar'

function usePadItems(): PadItem[] {
  const pathname = usePathname()
  return NAV_ITEMS.map((item) => ({
    direction: DIRECTIONS[item.href] ?? 'up',
    href: item.href,
    label: item.label,
    icon: item.icon,
    active: isActive(pathname, item.href),
  }))
}

function useFaceItems(): FaceItem[] {
  const openMovement = useUiStore((state) => state.openMovement)
  const openDialog = useUiStore((state) => state.openDialog)
  const openCategories = useUiStore((state) => state.openCategories)
  return [
    { letter: 'A', label: 'Nuevo registro', icon: Plus, onPress: () => openMovement('expense') },
    { letter: 'B', label: 'Metas de ahorro', icon: Target, onPress: () => openDialog('goals') },
    { letter: 'X', label: 'Categorías', icon: Tags, onPress: () => openCategories('expense') },
    { letter: 'Y', label: 'Respaldo', icon: HardDriveDownload, onPress: () => openDialog('backup') },
  ]
}

const FACE_LEGEND = { A: 'Nuevo', B: 'Metas', X: 'Categorías', Y: 'Respaldo' } as const

function useThemeKey() {
  const { theme, toggle } = useTheme()
  return {
    label: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
    // The new theme is revealed from the centre of the pressed key.
    onClick: (event: MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    },
  }
}

/** Left controller (desktop): profile key, stick, D-pad with its legend, compare/home key. */
function LeftPad({ pad, stick }: { pad: PadItem[]; stick: ReturnType<typeof useStick> }) {
  const openDialog = useUiStore((state) => state.openDialog)
  return (
    <aside className="console-pad console-pad-left boot-left" aria-label="Control izquierdo: módulos">
      <SystemKey label="Editar perfil" caption="Perfil" onClick={() => openDialog('profile')} className="order-1 self-end">
        <Minus aria-hidden className="size-4 dark:hidden" strokeWidth={3} />
        <Copy aria-hidden className="hidden size-3.5 dark:block" strokeWidth={2.4} />
      </SystemKey>
      <Stick stickRef={stick.ref} className="order-2 dark:order-3" />
      <nav aria-label="Navegación principal" className="order-3 flex flex-col items-center gap-3 dark:order-2">
        <DPad items={pad} onPress={stick.nudge} />
        <Legend rows={pad.map((item) => ({ key: item.href, mark: ARROW[item.direction], icon: item.icon, label: item.label, active: item.active }))} />
      </nav>
      <Trackpad className="order-4 hidden aspect-square w-[124px] dark:block" />
      <SystemKey label="Comparar gastos por mes" caption="Comparar" href={COMPARE_HREF} shape="square" className="order-5 mt-auto self-end dark:hidden">
        <CircleDot aria-hidden className="size-4" strokeWidth={2.4} />
      </SystemKey>
      <SystemKey label="Ir al inicio" caption="Inicio" href="/" shape="chip" onClick={() => stick.nudge('press')} className="order-5 mt-auto hidden self-start dark:flex">
        <span aria-hidden className="font-mono text-[15px] font-medium">K</span>
      </SystemKey>
    </aside>
  )
}

/** Right controller (desktop): theme key, A B X Y with legend, stick, home/compare key. */
function RightPad({ stick }: { stick: ReturnType<typeof useStick> }) {
  const face = useFaceItems()
  const themeKey = useThemeKey()
  return (
    <aside className="console-pad console-pad-right boot-right" aria-label="Control derecho: acciones">
      <SystemKey label={themeKey.label} caption="Tema" onClick={themeKey.onClick} className="self-start">
        <Plus aria-hidden className="size-4 dark:hidden" strokeWidth={3} />
        <Menu aria-hidden className="hidden size-4 dark:block" strokeWidth={2.6} />
      </SystemKey>
      <div className="flex flex-col items-center gap-3" role="group" aria-label="Acciones rápidas">
        <FaceButtons items={face} onTilt={stick.nudge} />
        <Legend rows={face.map((item) => ({ key: item.letter, mark: item.letter, icon: item.icon, label: FACE_LEGEND[item.letter] }))} />
      </div>
      <Stick stickRef={stick.ref} />
      <Trackpad scrolls className="hidden aspect-square w-[124px] dark:block" />
      <SystemKey label="Ir al inicio" caption="Inicio" href="/" shape="round" onClick={() => stick.nudge('press')} className="mt-auto self-start dark:hidden">
        <House aria-hidden className="size-[18px]" strokeWidth={2.4} />
      </SystemKey>
      <SystemKey label="Comparar gastos por mes" caption="Comparar" href={COMPARE_HREF} shape="chip" className="mt-auto hidden self-end dark:flex">
        <Ellipsis aria-hidden className="size-[18px]" strokeWidth={2.6} />
      </SystemKey>
    </aside>
  )
}

/** Select / Start: small tilted rubber keys under the screen. */
function PillKey({ label, title, href, onClick }: { label: string; title: string; href?: string; onClick?: () => void }) {
  const classes = 'group flex min-h-11 min-w-10 cursor-pointer flex-col items-center justify-end gap-1.5 select-none'
  const body = (
    <>
      <span aria-hidden className="block h-3 w-9 -rotate-[25deg] rounded-full border-2 border-outline bg-gb-pill shadow-[0_2px_0_var(--outline)] transition-transform duration-100 group-active:translate-y-px" />
      <span aria-hidden className="font-mono text-[10px] font-medium tracking-[0.1em] text-gb-ink uppercase">{label}</span>
    </>
  )
  return href ? (
    <Link href={href} aria-label={title} title={title} className={classes}>{body}</Link>
  ) : (
    <button type="button" aria-label={title} title={title} onClick={onClick} className={classes}>{body}</button>
  )
}

function GbButton({ letter, label, onClick, className }: { letter: string; label: string; onClick: () => void; className: string }) {
  return (
    <button type="button" aria-label={label} title={`${letter} · ${label}`} onClick={onClick} className={`absolute flex cursor-pointer flex-col items-center gap-1 select-none ${className}`}>
      <span className="gb-ab grid size-12 place-items-center rounded-full border-2 border-outline font-mono text-[15px] font-medium">{letter}</span>
      <span aria-hidden className="font-mono text-[10px] font-medium tracking-[0.1em] text-gb-ink uppercase">{label.split(' ')[0]}</span>
    </button>
  )
}

/**
 * Phones and tablets: classic brick handheld. D-pad for modules, A new record, B goals,
 * SELECT opens the menu with every other action, START opens the news.
 */
function BrickDeck({ pad }: { pad: PadItem[] }) {
  const openMovement = useUiStore((state) => state.openMovement)
  const openDialog = useUiStore((state) => state.openDialog)
  const noop = () => undefined
  return (
    <div className="mt-2.5 shrink-0 px-1 pb-[max(2px,env(safe-area-inset-bottom))] lg:hidden">
      <p aria-hidden className="mb-1.5 flex items-baseline gap-2 pl-1 text-gb-ink select-none">
        <span className="text-[19px] leading-none font-bold tracking-[-0.02em] italic">Kaligula</span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase">K-1 Finance</span>
      </p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center">
        <nav aria-label="Navegación principal">
          <DPad items={pad} onPress={noop} size="sm" variant="cross" />
        </nav>
        <div role="group" aria-label="Sistema" className="flex min-w-0 items-end justify-center gap-1.5 self-end">
          <PillKey label="Select" title="Select: abrir el menú" onClick={() => openDialog('console-menu')} />
          <PillKey label="Start" title="Start: noticias" href="/noticias" />
        </div>
        <div role="group" aria-label="Acciones rápidas" className="relative h-[112px] w-[112px]">
          <GbButton letter="B" label="Metas de ahorro" onClick={() => openDialog('goals')} className="top-[40px] left-0" />
          <GbButton letter="A" label="Nuevo registro" onClick={() => openMovement('expense')} className="top-0 right-0" />
          <span aria-hidden className="gb-grille pointer-events-none absolute right-0 bottom-0 flex -rotate-[30deg] gap-[5px]">
            <i /><i /><i /><i />
          </span>
        </div>
      </div>
    </div>
  )
}

/** Clears the one-per-session boot flag once the power-on animation has played. */
function useBootDone() {
  useEffect(() => {
    if (!document.documentElement.dataset.boot) return
    const timer = window.setTimeout(() => {
      delete document.documentElement.dataset.boot
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [])
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pad = usePadItems()
  const left = useStick()
  const right = useStick()
  useBootDone()

  return (
    <div className="flex h-dvh flex-col p-1.5 pt-[max(6px,env(safe-area-inset-top))] sm:p-3 lg:p-5">
      <div className="console">
        <LeftPad pad={pad} stick={left} />

        <div className="console-tablet">
          <div className="console-bezel">
            <StatusStrip />
            <div className="scanlines boot-screen relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-screen text-ink">
              <ScreenHeader />
              <main id="contenido" className="scroll-area min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
        </div>

        <RightPad stick={right} />
        <BrickDeck pad={pad} />
      </div>
    </div>
  )
}
