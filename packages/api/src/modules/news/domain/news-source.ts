import type { NewsCurrency } from '@kaligula/domain'

/** A curated, fixed news feed. URLs never come from users, so the server cannot be pointed elsewhere. */
export interface NewsSourceConfig {
  id: string
  name: string
  /** Public page of the outlet, shown to the user as attribution. */
  homepage: string
  /** RSS or Atom feed. */
  url: string
  lang: 'es' | 'en'
  /** Central bank or government release. */
  official: boolean
  /** Currencies the source covers by nature. */
  currencies: readonly NewsCurrency[]
  /** The feed is already an economy section, so every item counts as relevant. */
  economyOnly: boolean
  /** Minimum time between two requests to this feed. */
  refreshMs: number
  /** UTC offset for dates published without a time zone ("2026-11-25 17:40:00"). */
  naiveOffset?: string
}

export interface FeedEntry {
  title: string
  link: string
  summary: string
  publishedAt: Date | null
}

/** HTTP cache validators: an unchanged feed answers 304 and costs almost nothing. */
export interface FeedValidators {
  etag?: string | null
  lastModified?: string | null
}

export type FeedFetchResult =
  | { notModified: true }
  | { notModified: false; entries: FeedEntry[]; validators: FeedValidators }

/** Port: anything that returns the latest entries of one source. */
export interface NewsSource {
  config: NewsSourceConfig
  fetch(validators: FeedValidators): Promise<FeedFetchResult>
}
