import type { TrmQuote } from '@kaligula/contracts'
import type { TrmProvider } from '../domain/trm-provider'

export interface GetLatestTrmOptions {
  provider: TrmProvider
  /** How long a successful reading is reused before asking upstream again. */
  ttlMs?: number
  clock?: () => Date
}

/**
 * Use case: latest TRM with an in-memory cache.
 * Serves the last good value (flagged `stale`) when the upstream source fails.
 */
export function createGetLatestTrm({ provider, ttlMs = 30 * 60_000, clock = () => new Date() }: GetLatestTrmOptions) {
  let cached: TrmQuote | null = null
  let cachedAt = 0
  let inFlight: Promise<TrmQuote> | null = null

  async function refresh(): Promise<TrmQuote> {
    try {
      const reading = await provider.latest()
      const now = clock()
      cached = { ...reading, fetchedAt: now.toISOString(), stale: false }
      cachedAt = now.getTime()
      return cached
    } catch (error) {
      if (cached) return { ...cached, stale: true }
      throw error
    }
  }

  return async function getLatestTrm(): Promise<TrmQuote> {
    if (cached && clock().getTime() - cachedAt < ttlMs) return cached
    inFlight ??= refresh().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}

export type GetLatestTrm = ReturnType<typeof createGetLatestTrm>
