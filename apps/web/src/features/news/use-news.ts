'use client'

import { newsSnapshotSchema, type NewsSnapshot } from '@kaligula/contracts'
import { useCallback, useSyncExternalStore } from 'react'
import { api } from '@/lib/api-client'

export type NewsStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

interface NewsState {
  snapshot: NewsSnapshot | null
  status: NewsStatus
}

const POLL_MS = 2 * 60_000
const LINGER_MS = 5_000
const SERVER_STATE: NewsState = { snapshot: null, status: 'connecting' }

/*
 * One live connection shared by every news widget (header, home panel, news page). It opens with the
 * first subscriber and closes a few seconds after the last one leaves, so moving between pages does
 * not reconnect. Server-Sent Events push new stories; if they are refused for good, it polls.
 */
let state: NewsState = SERVER_STATE
const listeners = new Set<() => void>()
let source: EventSource | null = null
let poll: number | undefined
let closeTimer: number | undefined

function set(next: Partial<NewsState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

function startPolling() {
  if (poll !== undefined) return
  const load = async () => {
    try {
      set({ snapshot: await api.news(), status: 'live' })
    } catch {
      set({ status: 'offline' })
    }
  }
  void load()
  poll = window.setInterval(load, POLL_MS)
}

function connect() {
  if (typeof EventSource === 'undefined') return startPolling()
  source = new EventSource('/api/news/stream')
  source.addEventListener('snapshot', (event) => {
    try {
      const parsed = newsSnapshotSchema.safeParse(JSON.parse((event as MessageEvent<string>).data))
      if (parsed.success) set({ snapshot: parsed.data, status: 'live' })
    } catch {
      /* malformed event: keep the previous snapshot */
    }
  })
  source.onerror = () => {
    if (source?.readyState === EventSource.CLOSED) {
      source = null
      set({ status: 'offline' })
      startPolling()
    } else {
      set({ status: 'reconnecting' })
    }
  }
}

function disconnect() {
  source?.close()
  source = null
  if (poll !== undefined) window.clearInterval(poll)
  poll = undefined
  state = { ...state, status: 'connecting' }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.clearTimeout(closeTimer)
  if (!source && poll === undefined) connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) closeTimer = window.setTimeout(disconnect, LINGER_MS)
  }
}

export function useNews(): NewsState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE)
}

/* ---------- "New since your last visit" ---------- */

const SEEN_KEY = 'kaligula.news.seenAt'
const SEEN_EVENT = 'kaligula:news-seen'

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function subscribeSeen(callback: () => void) {
  window.addEventListener(SEEN_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(SEEN_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

/** When the user last opened the news page; stories after it count as new. */
export function useNewsSeen(): [string | null, (iso: string) => void] {
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => null)
  const markSeen = useCallback((iso: string) => {
    try {
      if ((readSeen() ?? '') >= iso) return
      localStorage.setItem(SEEN_KEY, iso)
      window.dispatchEvent(new Event(SEEN_EVENT))
    } catch {
      /* storage unavailable: the counter just stays */
    }
  }, [])
  return [seen, markSeen]
}
