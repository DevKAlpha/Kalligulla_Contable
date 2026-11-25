import { newsSnapshotSchema, type NewsSnapshot } from '@kaligula/contracts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createNewsFeed } from './modules/news/application/news-feed'
import type { FeedEntry, NewsSource, NewsSourceConfig } from './modules/news/domain/news-source'
import { parseFeed, parseFeedDate, toPlainText } from './modules/news/infrastructure/feed-parser'
import { createRssSource } from './modules/news/infrastructure/rss-source'
import { createTestApp, type TestApp } from './test-support'

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Canal</title>
<item><title><![CDATA[La Fed mantiene las tasas &amp; el dólar sube]]></title>
<link><![CDATA[https://news.test/fed?utm_source=rss]]></link>
<description>&lt;p&gt;El &lt;b&gt;dólar&lt;/b&gt; gana terreno frente al peso colombiano.&lt;/p&gt;</description>
<pubDate>Wed, 25 Nov 2026 17:11:40 GMT</pubDate><image><title>Imagen</title><link>https://img.test/x</link></image></item>
<item><title>Script</title><link>javascript:alert(1)</link></item>
<item><title>Selección Colombia gana</title><link>https://news.test/futbol</link><pubDate>Wed, 25 Nov 2026 16:00:00 GMT</pubDate></item>
</channel></rss>`

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">ECB raises rates</title>
<link rel="alternate" href="https://ecb.test/pr1"/><updated>2026-11-25T10:00:00+01:00</updated><summary>Euro area inflation</summary></entry></feed>`

describe('feed parser', () => {
  it('reads RSS items as plain text and keeps only http(s) links', () => {
    const entries = parseFeed(RSS)
    expect(entries.map((entry) => entry.link)).toEqual(['https://news.test/fed?utm_source=rss', 'https://news.test/futbol'])
    expect(entries[0]).toMatchObject({ title: 'La Fed mantiene las tasas & el dólar sube', summary: 'El dólar gana terreno frente al peso colombiano.' })
  })

  it('reads Atom entries and dates with or without time zone', () => {
    expect(parseFeed(ATOM)[0]).toMatchObject({ title: 'ECB raises rates', link: 'https://ecb.test/pr1', summary: 'Euro area inflation' })
    expect(parseFeedDate('Wed, 25 Nov 2026 22:05:55 +0900')?.toISOString()).toBe('2026-11-25T13:05:55.000Z')
    expect(parseFeedDate('Wed, 25 Nov 2026 15:01 GMT')?.toISOString()).toBe('2026-11-25T15:01:00.000Z')
    expect(parseFeedDate('2026-11-25 17:40:00')?.toISOString()).toBe('2026-11-25T17:40:00.000Z')
    expect(parseFeedDate('2026-11-25 12:40:00', '-05:00')?.toISOString()).toBe('2026-11-25T17:40:00.000Z')
    expect(parseFeedDate('mañana')).toBeNull()
    expect(toPlainText('<script>x()</script>Hola &aacute;')).toBe('Hola á')
  })
})

const config = (id: string, extra: Partial<NewsSourceConfig> = {}): NewsSourceConfig => ({
  id, name: id.toUpperCase(), homepage: `https://${id}.test`, url: `https://${id}.test/rss`, lang: 'es', official: false,
  currencies: [], economyOnly: false, refreshMs: 60_000, ...extra,
})

describe('rss source', () => {
  it('sends cache validators and understands 304', async () => {
    const seen: Headers[] = []
    let calls = 0
    const source = createRssSource(config('a'), (async (_url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers))
      calls += 1
      return calls === 1
        ? new Response(RSS, { headers: { etag: '"v1"', 'content-type': 'application/rss+xml; charset=utf-8' } })
        : new Response(null, { status: 304 })
    }) as typeof fetch)
    const first = await source.fetch({})
    expect(first.notModified).toBe(false)
    if (first.notModified) return
    expect(first.entries[0].publishedAt?.toISOString()).toBe('2026-11-25T17:11:40.000Z')
    expect(await source.fetch(first.validators)).toEqual({ notModified: true })
    expect(seen[1].get('if-none-match')).toBe('"v1"')
    expect(seen[0].get('user-agent')).toBe('Kaligula-NewsReader/1.0')
  })

  it('reports HTTP errors and non-feeds clearly', async () => {
    const failing = createRssSource(config('b'), (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch)
    await expect(failing.fetch({})).rejects.toThrow('B respondió con el estado 503.')
    const html = createRssSource(config('c'), (async () => new Response('<html>login</html>')) as unknown as typeof fetch)
    await expect(html.fetch({})).rejects.toThrow('no devolvió un feed válido')
  })
})

function fakeSource(cfg: NewsSourceConfig, batches: (FeedEntry[] | Error)[]): NewsSource & { calls: number } {
  const source = {
    config: cfg,
    calls: 0,
    async fetch() {
      const batch = batches[Math.min(source.calls, batches.length - 1)]
      source.calls += 1
      if (batch instanceof Error) throw batch
      return { notModified: false as const, entries: batch, validators: {} }
    },
  }
  return source
}

const entry = (title: string, link: string, iso: string | null, summary = ''): FeedEntry => ({ title, link, summary, publishedAt: iso ? new Date(iso) : null })

describe('news feed', () => {
  it('merges sources newest first, filters irrelevant stories and removes duplicates', async () => {
    let now = new Date('2026-11-25T18:00:00Z')
    const fed = fakeSource(config('fed', { official: true, currencies: ['USD'], economyOnly: true }), [[entry('FOMC statement', 'https://fed.test/1', '2026-11-25T17:00:00Z')]])
    const outlet = fakeSource(config('outlet', { currencies: ['COP'] }), [[
      entry('El dólar en Colombia cae', 'https://o.test/1', '2026-11-25T17:30:00Z'),
      entry('Fomc Statement', 'https://o.test/copy', '2026-11-25T16:00:00Z'),
      entry('Gol de la Selección', 'https://o.test/2', '2026-11-25T17:45:00Z'),
      entry('Petróleo sube por la OPEP', 'https://o.test/3', null),
    ]])
    const feed = createNewsFeed({ sources: [fed, outlet], clock: () => now })
    const snapshot = newsSnapshotSchema.parse(await feed.current())
    expect(snapshot.items.map((item) => item.title)).toEqual(['Petróleo sube por la OPEP', 'El dólar en Colombia cae', 'FOMC statement'])
    expect(snapshot.items[0]).toMatchObject({ dated: false, global: true, publishedAt: '2026-11-25T18:00:00.000Z' })
    expect(snapshot.items[1].currencies).toEqual(['COP', 'USD'])
    expect(snapshot.sources.map((source) => source.status)).toEqual(['ok', 'ok'])

    // Within the refresh interval the sources are not asked again.
    now = new Date('2026-11-25T18:00:30Z')
    await feed.current()
    expect(fed.calls + outlet.calls).toBe(2)
  })

  it('keeps the last stories of a failing source and reports the error', async () => {
    let now = new Date('2026-11-25T18:00:00Z')
    const flaky = fakeSource(config('flaky', { currencies: ['KRW'], economyOnly: true }), [[entry('Bank of Korea holds rate', 'https://k.test/1', '2026-11-25T17:00:00Z')], new Error('Flaky no respondió.')])
    const feed = createNewsFeed({ sources: [flaky], clock: () => now })
    await feed.current()
    now = new Date('2026-11-25T18:02:00Z')
    const snapshot = await feed.current()
    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.sources[0]).toMatchObject({ status: 'error', error: 'Flaky no respondió.', items: 1 })
  })

  it('notifies subscribers only when stories change', async () => {
    let now = new Date('2026-11-25T18:00:00Z')
    const source = fakeSource(config('s', { currencies: ['EUR'], economyOnly: true, refreshMs: 1 }), [
      [entry('ECB speech', 'https://e.test/1', '2026-11-25T17:00:00Z')],
      [entry('ECB speech', 'https://e.test/1', '2026-11-25T17:00:00Z')],
      [entry('ECB decision', 'https://e.test/2', '2026-11-25T17:59:00Z'), entry('ECB speech', 'https://e.test/1', '2026-11-25T17:00:00Z')],
    ])
    const feed = createNewsFeed({ sources: [source], clock: () => now })
    const received: NewsSnapshot[] = []
    const stop = feed.subscribe((snapshot) => received.push(snapshot))
    await feed.current()
    now = new Date('2026-11-25T18:01:00Z')
    await feed.current()
    now = new Date('2026-11-25T18:02:00Z')
    await feed.current()
    stop()
    expect(received.map((snapshot) => snapshot.items.length)).toEqual([1, 2])
    feed.stop()
  })
})

describe('news API', () => {
  let api: TestApp

  beforeAll(async () => {
    api = await createTestApp({
      newsSources: [fakeSource(config('fed', { official: true, currencies: ['USD'], economyOnly: true }), [[entry('Fed holds rates', 'https://fed.test/1', '2026-11-16T14:00:00Z')]])],
    })
  })

  afterAll(async () => {
    await api.close()
  })

  it('serves the snapshot without owner data and accepts no writes', async () => {
    const { status, body } = await api.json<NewsSnapshot>('GET', '/api/news')
    expect(status).toBe(200)
    expect(newsSnapshotSchema.parse(body).items[0]).toMatchObject({ title: 'Fed holds rates', currencies: ['USD'], sourceId: 'fed' })
    expect((await api.request('POST', '/api/news', { title: 'x' })).status).toBe(404)
  })
})
