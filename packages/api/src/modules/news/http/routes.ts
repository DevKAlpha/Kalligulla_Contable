import type { NewsSnapshot } from '@kaligula/contracts'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AppEnv } from '../../../shared/http'
import type { NewsFeed } from '../application/news-feed'

/** Read-only: news are only consulted, never written. */
export function newsRoutes(feed: NewsFeed, heartbeatMs = 15_000) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      c.header('Cache-Control', 'no-store')
      return c.json(await feed.current())
    })

    /** Server-Sent Events: a `snapshot` on connect and whenever stories or source states change. */
    .get('/stream', (c) => {
      c.header('Cache-Control', 'no-cache, no-transform')
      c.header('X-Accel-Buffering', 'no')
      return streamSSE(c, async (stream) => {
        let sequence = 0
        const send = (snapshot: NewsSnapshot) =>
          stream.writeSSE({ event: 'snapshot', id: String((sequence += 1)), data: JSON.stringify(snapshot) }).catch(() => undefined)

        const unsubscribe = feed.subscribe((snapshot) => {
          void send(snapshot)
        })
        stream.onAbort(unsubscribe)
        await send(await feed.current())

        while (!stream.aborted && !stream.closed) {
          await stream.sleep(heartbeatMs)
          if (!stream.aborted && !stream.closed) await stream.write(': keep-alive\n\n').catch(() => undefined)
        }
        unsubscribe()
      })
    })
}
