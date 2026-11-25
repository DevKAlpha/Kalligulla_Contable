import type { NewsItem, NewsSnapshot, NewsSourceStatus } from '@kaligula/contracts'
import { classifyNews, headlineKey, newsId, summarize } from '@kaligula/domain'
import type { FeedValidators, NewsSource } from '../domain/news-source'

export interface NewsFeedOptions {
  sources: readonly NewsSource[]
  clock?: () => Date
  /** How often due sources are checked while someone listens. Each source keeps its own `refreshMs`. */
  tickMs?: number
  /** Stories kept in the snapshot (newest first). */
  maxItems?: number
  /** Outlet stories older than this are dropped; official releases are kept 4 times longer. */
  maxAgeMs?: number
}

type Listener = (snapshot: NewsSnapshot) => void

interface SourceState {
  source: NewsSource
  items: NewsItem[]
  validators: FeedValidators
  checkedAtMs: number
  status: NewsSourceStatus['status']
  error: string | null
  inFlight: Promise<void> | null
}

const PER_SOURCE = 60
const FUTURE_TOLERANCE_MS = 5 * 60_000

/**
 * Use case: one shared news snapshot for every client, built from curated feeds.
 * Feeds are polled only while someone is subscribed (live stream), each at its own pace and with
 * conditional requests. A failing source keeps its last stories and is reported in `sources`.
 */
export function createNewsFeed({ sources, clock = () => new Date(), tickMs = 30_000, maxItems = 150, maxAgeMs = 3 * 24 * 3_600_000 }: NewsFeedOptions) {
  const states: SourceState[] = sources.map((source) => ({
    source, items: [], validators: {}, checkedAtMs: 0, status: 'pending', error: null, inFlight: null,
  }))
  // When a dateless story was first seen, so its position does not jump on every refresh.
  const firstSeen = new Map<string, number>()
  const listeners = new Set<Listener>()
  let snapshot: NewsSnapshot = build()
  let signature = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  function toItems(state: SourceState, entries: Awaited<ReturnType<NewsSource['fetch']>> & { notModified: false }): NewsItem[] {
    const { config } = state.source
    const now = clock().getTime()
    const oldest = now - (config.official ? maxAgeMs * 4 : maxAgeMs)
    const items: NewsItem[] = []
    for (const entry of entries.entries) {
      const summary = summarize(entry.summary)
      const classification = classifyNews(`${entry.title} ${summary}`, { currencies: config.currencies, economyOnly: config.economyOnly, official: config.official })
      if (!classification.relevant) continue
      const id = newsId(entry.link)
      if (!firstSeen.has(id)) firstSeen.set(id, now)
      const dated = entry.publishedAt !== null
      const time = Math.min(entry.publishedAt?.getTime() ?? firstSeen.get(id)!, now + FUTURE_TOLERANCE_MS)
      if (time < oldest) continue
      items.push({
        id,
        title: entry.title,
        summary,
        url: entry.link,
        sourceId: config.id,
        publishedAt: new Date(Math.min(time, now)).toISOString(),
        dated,
        currencies: classification.currencies,
        topics: classification.topics,
        global: classification.global,
      })
      if (items.length >= PER_SOURCE) break
    }
    return items
  }

  function build(): NewsSnapshot {
    const all = states.flatMap((state) => state.items).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    const seenIds = new Set<string>()
    const seenTitles = new Set<string>()
    const items: NewsItem[] = []
    for (const item of all) {
      const title = headlineKey(item.title)
      if (seenIds.has(item.id) || seenTitles.has(title)) continue
      seenIds.add(item.id)
      seenTitles.add(title)
      items.push(item)
      if (items.length >= maxItems) break
    }
    const checked = Math.max(0, ...states.map((state) => state.checkedAtMs))
    return {
      items,
      sources: states.map(({ source: { config }, status, error, checkedAtMs, items: own }) => ({
        id: config.id,
        name: config.name,
        homepage: config.homepage,
        lang: config.lang,
        official: config.official,
        currencies: [...config.currencies],
        status,
        checkedAt: checkedAtMs ? new Date(checkedAtMs).toISOString() : null,
        error,
        items: own.length,
      })),
      updatedAt: new Date(checked || clock().getTime()).toISOString(),
      refreshMs: Math.min(...sources.map((source) => source.config.refreshMs), 5 * 60_000),
    }
  }

  function refreshSource(state: SourceState): Promise<void> {
    state.inFlight ??= (async () => {
      try {
        const result = await state.source.fetch(state.validators)
        if (!result.notModified) {
          state.items = toItems(state, result)
          state.validators = result.validators
        }
        state.status = 'ok'
        state.error = null
      } catch (error) {
        state.status = 'error'
        state.error = error instanceof Error ? error.message : 'Fuente no disponible.'
      } finally {
        state.checkedAtMs = clock().getTime()
        state.inFlight = null
      }
    })()
    return state.inFlight
  }

  function publish() {
    snapshot = build()
    const next = `${snapshot.items.map((item) => item.id).join(',')}|${snapshot.sources.map((source) => `${source.status}:${source.items}`).join(',')}`
    if (next === signature) return
    signature = next
    const current = snapshot
    listeners.forEach((listener) => listener(current))
  }

  async function refreshDue(): Promise<NewsSnapshot> {
    const now = clock().getTime()
    const due = states.filter((state) => state.inFlight !== null || now - state.checkedAtMs >= state.source.config.refreshMs)
    if (due.length > 0) {
      await Promise.all(due.map(refreshSource))
      publish()
    }
    return snapshot
  }

  return {
    /** Latest snapshot; sources whose interval has passed are refreshed first. */
    current: refreshDue,

    subscribe(listener: Listener): () => void {
      listeners.add(listener)
      if (!timer) {
        timer = setTimeout(function tick() {
          refreshDue().catch(() => undefined)
          timer = setTimeout(tick, tickMs)
        }, tickMs)
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

    stop() {
      listeners.clear()
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}

export type NewsFeed = ReturnType<typeof createNewsFeed>
