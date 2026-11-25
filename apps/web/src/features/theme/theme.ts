'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY } from './init-scripts'

export type ThemePreference = 'light' | 'dark' | 'system'

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function resolve(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onMedia = () => {
    if (readPreference() === 'system') apply('system')
  }
  media.addEventListener('change', onMedia)
  return () => {
    listeners.delete(callback)
    media.removeEventListener('change', onMedia)
  }
}

function apply(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolve(preference)
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
    () => 'light' as const,
  )

  const setPreference = useCallback((preference: ThemePreference) => {
    try {
      if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    apply(preference)
  }, [])

  /** Switches theme; with an origin point, the new console is revealed in a circle from there (View Transitions API). */
  const toggle = useCallback((origin?: { x: number; y: number }) => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown }
    if (!origin || !doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setPreference(next)
    document.documentElement.style.setProperty('--vt-x', `${origin.x}px`)
    document.documentElement.style.setProperty('--vt-y', `${origin.y}px`)
    doc.startViewTransition(() => setPreference(next))
  }, [setPreference, theme])

  return { theme, setPreference, toggle }
}
