import type { FeedFetchResult, FeedValidators, NewsSource, NewsSourceConfig } from '../domain/news-source'
import { parseFeed, parseFeedDate } from './feed-parser'

const MAX_FEED_BYTES = 4 * 1024 * 1024
const TIMEOUT_MS = 10_000
// Generic client name: no personal or account details travel to the outlets.
const USER_AGENT = 'Kaligula-NewsReader/1.0'

export class FeedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedError'
  }
}

function charsetOf(contentType: string | null, head: string): string {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType ?? '')?.[1] ?? /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1]
  return declared?.toLowerCase() ?? 'utf-8'
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_FEED_BYTES) {
      await reader.cancel()
      throw new FeedError('El feed supera el tamaño permitido.')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return bytes
}

function decode(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200))
  try {
    return new TextDecoder(charsetOf(contentType, head)).decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

/** One RSS/Atom feed over HTTP with conditional requests, a timeout and a size cap. */
export function createRssSource(config: NewsSourceConfig, fetcher: typeof fetch = fetch): NewsSource {
  return {
    config,
    async fetch(validators: FeedValidators): Promise<FeedFetchResult> {
      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
      }
      if (validators.etag) headers['If-None-Match'] = validators.etag
      if (validators.lastModified) headers['If-Modified-Since'] = validators.lastModified
      let response: Response
      try {
        response = await fetcher(config.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
      } catch {
        throw new FeedError(`${config.name} no respondió.`)
      }
      if (response.status === 304) return { notModified: true }
      if (!response.ok) throw new FeedError(`${config.name} respondió con el estado ${response.status}.`)
      const xml = decode(await readLimited(response), response.headers.get('content-type'))
      const entries = parseFeed(xml).map((entry) => ({
        title: entry.title,
        link: entry.link,
        summary: entry.summary,
        publishedAt: parseFeedDate(entry.published, config.naiveOffset),
      }))
      if (entries.length === 0 && !/<(rss|feed|rdf)\b/i.test(xml)) throw new FeedError(`${config.name} no devolvió un feed válido.`)
      return {
        notModified: false,
        entries,
        validators: { etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') },
      }
    },
  }
}
