'use client'

import { fxSnapshotSchema, type FxSnapshot } from '@kaligula/contracts'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

export type FxStreamStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

const POLL_MS = 60_000

/**
 * Live COP quotes pushed by the server over Server-Sent Events (`/api/market/fx/stream`).
 * EventSource reconnects by itself; if the stream is refused for good, it falls back to polling.
 */
export function useFxStream(): { snapshot: FxSnapshot | null; status: FxStreamStatus } {
  const [snapshot, setSnapshot] = useState<FxSnapshot | null>(null)
  const [status, setStatus] = useState<FxStreamStatus>('connecting')

  useEffect(() => {
    let poll: number | undefined
    let source: EventSource | undefined

    const startPolling = () => {
      if (poll !== undefined) return
      const load = async () => {
        try {
          setSnapshot(await api.fx())
          setStatus('live')
        } catch {
          setStatus('offline')
        }
      }
      void load()
      poll = window.setInterval(load, POLL_MS)
    }

    if (typeof EventSource === 'undefined') {
      startPolling()
    } else {
      source = new EventSource('/api/market/fx/stream')
      source.addEventListener('snapshot', (event) => {
        try {
          const parsed = fxSnapshotSchema.safeParse(JSON.parse((event as MessageEvent<string>).data))
          if (!parsed.success) return
          setSnapshot(parsed.data)
          setStatus('live')
        } catch {
          /* malformed event: keep the previous snapshot */
        }
      })
      source.addEventListener('unavailable', () => setStatus('offline'))
      source.onerror = () => {
        if (source?.readyState === EventSource.CLOSED) {
          setStatus('offline')
          startPolling()
        } else {
          setStatus('reconnecting')
        }
      }
    }

    return () => {
      source?.close()
      if (poll !== undefined) window.clearInterval(poll)
    }
  }, [])

  return { snapshot, status }
}

/** Re-renders every `intervalMs` so relative times ("hace 5 s") stay current. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
