'use client'

import {
  ChartColumnBig, CircleDot, Copy, Ellipsis, HardDriveDownload, House, Menu, Minus, Moon, Plus, Sun, Tags, Target, UserRound,
} from 'lucide-react'
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
 * Control map (same on every layout):
 *   D-pad      ▲ Inicio  ▶ Gastos  ▼ Inversión  ◀ Préstamos
 *   A Nuevo registro · B Metas · X Categorías · Y Respaldo
 *   − / View   Perfil      + / Menu   Tema claro/oscuro
 *   Home / K   Inicio      Capture / …   Comparar gastos
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

/** Phones and tablets: D-pad on the left pad, A B X Y on the right, system keys in the middle. */
function ControlDeck({ pad }: { pad: PadItem[] }) {
  const face = useFaceItems()
  const themeKey = useThemeKey()
  const openDialog = useUiStore((state) => state.openDialog)
  const noop = () => undefined
  return (
    <div className="mt-2 grid shrink-0 grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 pb-[max(0px,env(safe-area-inset-bottom))] sm:mt-3 lg:hidden">
      <nav aria-label="Navegación principal" className="deck-pad deck-pad-left grid place-items-center py-2">
        <DPad items={pad} onPress={noop} size="sm" />
      </nav>
      <div className="grid grid-cols-2 place-content-center gap-2 px-0.5" role="group" aria-label="Sistema">
        <SystemKey label="Editar perfil" onClick={() => openDialog('profile')} shape="chip"><UserRound aria-hidden className="size-4" /></SystemKey>
        <SystemKey label={themeKey.label} onClick={themeKey.onClick} shape="chip">
          <Moon aria-hidden className="size-4 dark:hidden" />
          <Sun aria-hidden className="hidden size-4 dark:block" />
        </SystemKey>
        <SystemKey label="Ir al inicio" href="/" shape="chip"><House aria-hidden className="size-4" /></SystemKey>
        <SystemKey label="Comparar gastos por mes" href={COMPARE_HREF} shape="chip"><ChartColumnBig aria-hidden className="size-4" /></SystemKey>
      </div>
      <div role="group" aria-label="Acciones rápidas" className="deck-pad deck-pad-right grid place-items-center py-2">
        <FaceButtons items={face} onTilt={noop} size="sm" />
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
          <div className="flex min-h-0 flex-1 flex-col rounded-[22px] border-2 border-outline bg-bezel p-2 sm:p-2.5">
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
        <ControlDeck pad={pad} />
      </div>
    </div>
  )
}
