import type { FxQuote, FxSnapshot } from '@kaligula/contracts'
import type { FxCurrency } from '@kaligula/domain'

export interface FxReading {
  quotes: FxQuote[]
  source: FxSnapshot['source']
}

/** Port: any source able to quote foreign currencies in Colombian pesos. */
export interface FxProvider {
  readonly name: string
  latest(currencies: readonly FxCurrency[]): Promise<FxReading>
}
