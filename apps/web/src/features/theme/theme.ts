'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export const THEME_STORAGE_KEY = 'kaligula.theme'

/** Runs inline in <head> before paint to avoid a flash of the wrong theme. Keep it dependency-free. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||((!p||p==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`

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

  const toggle = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [setPreference, theme])

  return { theme, setPreference, toggle }
}
