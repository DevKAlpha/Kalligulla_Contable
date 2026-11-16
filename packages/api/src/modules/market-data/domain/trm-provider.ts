import type { TrmQuote } from '@kaligula/contracts'

/** Upstream quote, before the application layer adds freshness metadata. */
export type TrmReading = Omit<TrmQuote, 'fetchedAt' | 'stale'>

/** Port: any source able to return the latest official TRM. */
export interface TrmProvider {
  readonly name: string
  latest(): Promise<TrmReading>
}

export class UpstreamUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'UpstreamUnavailableError'
  }
}
