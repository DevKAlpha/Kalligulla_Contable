import type { FxSnapshot } from '@kaligula/contracts'
import { FX_CODES, type FxCurrency } from '@kaligula/domain'
import type { FxProvider } from '../domain/fx-provider'

export interface FxTickerOptions {
  provider: FxProvider
  currencies?: readonly FxCurrency[]
  /** How often the source is polled while at least one client listens, and how long a reading is reused. */
  refreshMs?: number
  clock?: () => Date
}

type Listener = (snapshot: FxSnapshot) => void

/**
 * Use case: one shared, cached quote feed for every client.
 * The upstream source is polled only while someone is subscribed (live stream),
 * and every refresh is pushed to all subscribers. On failure the last good snapshot is served as `stale`.
 */
export function createFxTicker({ provider, currencies = FX_CODES, refreshMs = 60_000, clock = () => new Date() }: FxTickerOptions) {
  let snapshot: FxSnapshot | null = null
  let fetchedAtMs = 0
  let inFlight: Promise<FxSnapshot> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<Listener>()

  async function refresh(): Promise<FxSnapshot> {
    try {
      const reading = await provider.latest(currencies)
      const now = clock()
      snapshot = { base: 'COP', quotes: reading.quotes, source: reading.source, fetchedAt: now.toISOString(), stale: false }
      fetchedAtMs = now.getTime()
    } catch (error) {
      if (!snapshot) throw error
      snapshot = { ...snapshot, stale: true }
    }
    const current = snapshot
    listeners.forEach((listener) => listener(current))
    return current
  }

  function refreshOnce(): Promise<FxSnapshot> {
    inFlight ??= refresh().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  return {
    /** Latest snapshot, refreshed if older than `refreshMs`. */
    current(): Promise<FxSnapshot> {
      if (snapshot && !snapshot.stale && clock().getTime() - fetchedAtMs < refreshMs) return Promise.resolve(snapshot)
      return refreshOnce()
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener)
      if (!timer) {
        // First listener: refresh when the cached reading expires, then every `refreshMs`,
        // so a client never waits more than one interval for fresh data.
        const age = snapshot ? clock().getTime() - fetchedAtMs : refreshMs
        timer = setTimeout(function tick() {
          refreshOnce().catch(() => undefined)
          timer = setTimeout(tick, refreshMs)
        }, Math.max(0, refreshMs - age))
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && timer) {
          clearTimeout(timer)
          timer = undefined
        }
      }
    },

    get subscribers() {
      return listeners.size
    },

    /** Stops polling (process shutdown, tests). */
    stop() {
      listeners.clear()
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}

export type FxTicker = ReturnType<typeof createFxTicker>
