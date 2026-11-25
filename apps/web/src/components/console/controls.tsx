'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/*
 * Console controls. Hardware differences between themes are CSS only (`dark:` variants), so the
 * markup is identical on the server and the client and no control flickers after hydration.
 */

export type Direction = 'up' | 'right' | 'down' | 'left'
export type Tilt = Direction | 'press'

/** Leans a decorative stick for a moment. Writes a data attribute: no React render per press. */
export function useStick() {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef(0)
  const nudge = useCallback((tilt: Tilt) => {
    const element = ref.current
    if (!element) return
    element.dataset.tilt = tilt
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      delete element.dataset.tilt
    }, 220)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { ref, nudge }
}

export function Stick({ stickRef, className }: { stickRef: React.RefObject<HTMLSpanElement | null>; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-[76px] shrink-0 place-items-center rounded-full border-[3px] border-outline bg-pad-button [perspective:220px]',
        'shadow-[inset_0_-5px_0_rgb(0_0_0/0.35),0_3px_0_var(--outline)]',
        className,
      )}
    >
      <span ref={stickRef} className="stick grid size-[52px] place-items-center rounded-full border-2 border-outline bg-pad-button-hi shadow-[0_4px_0_var(--outline)]">
        <span className="size-8 rounded-full bg-[repeating-radial-gradient(circle,rgb(0_0_0/0.28)_0_1px,transparent_1px_4px)]" />
      </span>
    </span>
  )
}

// Colors are added per key: two utilities for the same property would depend on stylesheet order.
const KEY =
  'grid cursor-pointer place-items-center border-2 border-outline shadow-[0_3px_0_var(--outline)] select-none ' +
  'transition-[transform,box-shadow,background-color] duration-100 active:translate-y-[2px] active:shadow-[0_1px_0_var(--outline)]'

/* ---------- D-pad: one direction per module ---------- */

export interface PadItem {
  direction: Direction
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}

const DPAD_CELL: Record<Direction, string> = {
  up: 'col-start-2 row-start-1',
  right: 'col-start-3 row-start-2',
  down: 'col-start-2 row-start-3',
  left: 'col-start-1 row-start-2',
}
/** Inner corners of the cross arms, squared so the arms meet the hub. */
const CROSS_INNER: Record<Direction, string> = { up: 'rounded-b-[3px]', right: 'rounded-l-[3px]', down: 'rounded-t-[3px]', left: 'rounded-r-[3px]' }
const CROSS_INNER_DARK: Record<Direction, string> = { up: 'dark:rounded-b-[3px]', right: 'dark:rounded-l-[3px]', down: 'dark:rounded-t-[3px]', left: 'dark:rounded-r-[3px]' }
export const ARROW: Record<Direction, string> = { up: '▲', right: '▶', down: '▼', left: '◀' }

/** `theme`: four round arrow buttons in light, a one-piece cross in dark. `cross`: always a cross (brick handheld). */
export function DPad({ items, onPress, size = 'lg', variant = 'theme' }: {
  items: readonly PadItem[]
  onPress: (direction: Direction) => void
  size?: 'sm' | 'lg'
  variant?: 'theme' | 'cross'
}) {
  const cross = variant === 'cross'
  return (
    <div className={cn('grid shrink-0 grid-cols-3 grid-rows-3', size === 'lg' ? 'size-[132px]' : 'size-[102px]')}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
          onClick={() => onPress(item.direction)}
          className={cn(
            KEY,
            DPAD_CELL[item.direction],
            'bg-pad-button text-pad-button-text',
            cross ? ['rounded-[8px]', CROSS_INNER[item.direction]] : ['m-[3px] rounded-full dark:m-0 dark:rounded-[9px]', CROSS_INNER_DARK[item.direction]],
            'aria-[current=page]:bg-accent aria-[current=page]:text-on-accent aria-[current=page]:shadow-[0_0_0_3px_rgb(198_240_90/0.35),0_3px_0_var(--outline)]',
          )}
        >
          <item.icon aria-hidden className={size === 'lg' ? 'size-[18px]' : 'size-4'} strokeWidth={2.4} />
        </Link>
      ))}
      <span aria-hidden className={cn('col-start-2 row-start-2 border-y-2 border-outline bg-pad-button', cross ? 'block' : 'hidden dark:block')} />
    </div>
  )
}

/* ---------- Face buttons (A B X Y) ---------- */

export type FaceLetter = 'A' | 'B' | 'X' | 'Y'
export interface FaceItem {
  letter: FaceLetter
  label: string
  icon: LucideIcon
  onPress: () => void
}

/** Light uses the hybrid-handheld diamond (X top, A right); dark the PC-pad diamond (Y top, B right). */
const FACE_SLOT: Record<FaceLetter, string> = {
  X: 'col-start-2 row-start-1 dark:col-start-1 dark:row-start-2',
  A: 'col-start-3 row-start-2 dark:col-start-2 dark:row-start-3',
  B: 'col-start-2 row-start-3 dark:col-start-3 dark:row-start-2',
  Y: 'col-start-1 row-start-2 dark:col-start-2 dark:row-start-1',
}
const FACE_TILT: Record<FaceLetter, Direction> = { X: 'up', A: 'right', B: 'down', Y: 'left' }

export function FaceButtons({ items, onTilt, size = 'lg' }: { items: readonly FaceItem[]; onTilt: (tilt: Tilt) => void; size?: 'sm' | 'lg' }) {
  return (
    <div className={cn('grid shrink-0 grid-cols-3 grid-rows-3', size === 'lg' ? 'size-[132px]' : 'size-[108px]')}>
      {items.map((item) => (
        <button
          key={item.letter}
          type="button"
          title={`${item.letter} · ${item.label}`}
          aria-label={item.label}
          onClick={() => {
            onTilt(FACE_TILT[item.letter])
            item.onPress()
          }}
          className={cn(
            KEY,
            FACE_SLOT[item.letter],
            'm-[2px] rounded-full font-mono font-medium',
            size === 'lg' ? 'text-[15px]' : 'text-[13px]',
            item.letter === 'A' ? 'bg-accent text-on-accent' : 'bg-pad-button text-pad-button-text',
          )}
        >
          {size === 'lg' ? item.letter : <item.icon aria-hidden className="size-4" strokeWidth={2.4} />}
        </button>
      ))}
    </div>
  )
}

/* ---------- Legends printed on the controller ---------- */

export function Legend({ rows }: { rows: readonly { key: string; mark: ReactNode; icon: LucideIcon; label: string; active?: boolean }[] }) {
  return (
    <ul aria-hidden className="grid w-full max-w-[136px] gap-1 font-mono text-[11px] tracking-[0.06em] text-pad-ink uppercase">
      {rows.map((row) => (
        <li key={row.key} className={cn('flex items-center gap-1.5 rounded-md px-1.5 py-0.5', row.active && 'bg-outline/85 text-accent')}>
          <span className="w-3.5 shrink-0 text-center text-[10px]">{row.mark}</span>
          <row.icon className="size-3.5 shrink-0" strokeWidth={2.4} />
          <span className="truncate">{row.label}</span>
        </li>
      ))}
    </ul>
  )
}

/* ---------- Small system keys (−, +, home, capture…) ---------- */

const SYSTEM_SHAPE = {
  pill: 'h-7 w-11 rounded-full',
  round: 'size-11 rounded-full',
  square: 'size-10 rounded-[11px]',
  chip: 'size-9 rounded-[10px]',
}

export function SystemKey({ label, caption, href, onClick, shape = 'pill', className, children }: {
  label: string
  caption?: string
  href?: string
  onClick?: (event: MouseEvent<HTMLElement>) => void
  shape?: keyof typeof SYSTEM_SHAPE
  className?: string
  children: ReactNode
}) {
  const classes = cn('group flex shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl select-none', className)
  const body = (
    <>
      <span
        className={cn(
          'grid place-items-center border-2 border-outline bg-pad-button text-pad-button-text shadow-[0_3px_0_var(--outline)]',
          'transition-[transform,box-shadow] duration-100 group-active:translate-y-[2px] group-active:shadow-[0_1px_0_var(--outline)]',
          SYSTEM_SHAPE[shape],
        )}
      >
        {children}
      </span>
      {caption && <span className="font-mono text-[11px] leading-none tracking-[0.1em] text-pad-ink uppercase">{caption}</span>}
    </>
  )
  return href ? (
    <Link href={href} aria-label={label} title={label} onClick={onClick} className={classes}>{body}</Link>
  ) : (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={classes}>{body}</button>
  )
}

/* ---------- Trackpad (dark console) ---------- */

/**
 * Square trackpad with a glow that follows the pointer. Pointer positions are applied at most once per
 * frame (rAF) as CSS variables, so moving over it never re-renders React. With `scrolls`, dragging or
 * using the wheel over it scrolls the screen, like the trackpads of a PC handheld.
 */
export function Trackpad({ scrolls = false, className }: { scrolls?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const frame = useRef(0)
  const point = useRef({ x: 0, y: 0 })
  const drag = useRef<number | null>(null)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const screen = () => document.getElementById('contenido')
  const paint = () => {
    frame.current = 0
    ref.current?.style.setProperty('--px', `${point.current.x}px`)
    ref.current?.style.setProperty('--py', `${point.current.y}px`)
  }

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn('trackpad block shrink-0 rounded-[14px] border-2 border-outline shadow-[inset_0_2px_6px_rgb(0_0_0/0.45)]', className)}
      onPointerEnter={() => ref.current?.style.setProperty('--glow', '0.32')}
      onPointerLeave={() => {
        ref.current?.style.setProperty('--glow', '0')
        drag.current = null
      }}
      onPointerDown={(event) => {
        if (!scrolls) return
        drag.current = event.clientY
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerMove={(event) => {
        point.current = { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }
        if (!frame.current) frame.current = requestAnimationFrame(paint)
        if (drag.current !== null) {
          screen()?.scrollBy({ top: (drag.current - event.clientY) * 2 })
          drag.current = event.clientY
        }
      }}
      onWheel={(event) => {
        if (scrolls) screen()?.scrollBy({ top: event.deltaY })
      }}
    />
  )
}
