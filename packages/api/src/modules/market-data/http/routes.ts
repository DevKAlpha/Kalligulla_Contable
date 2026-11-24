import { assetClassSchema, type FxSnapshot } from '@kaligula/contracts'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { readQuery, type AppEnv } from '../../../shared/http'
import type { FxTicker } from '../application/fx-ticker'
import type { MarketMovers } from '../application/market-movers'
import type { GetLatestTrm } from '../application/get-latest-trm'
import { UpstreamUnavailableError } from '../domain/trm-provider'

const upstreamError = (error: UpstreamUnavailableError) => ({ error: { code: 'upstream_unavailable', message: error.message } })

export interface MarketDataRoutesOptions {
  getLatestTrm: GetLatestTrm
  fxTicker: FxTicker
  marketMovers: MarketMovers
  /** Keep-alive comment interval for the live stream (proxies drop idle connections). */
  heartbeatMs?: number
}

const moversQuery = z.object({ class: assetClassSchema })

export function marketDataRoutes({ getLatestTrm, fxTicker, marketMovers, heartbeatMs = 15_000 }: MarketDataRoutesOptions) {
  return new Hono<AppEnv>()
    .get('/trm', async (c) => {
      try {
        const quote = await getLatestTrm()
        c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
        return c.json(quote)
      } catch (error) {
        if (error instanceof UpstreamUnavailableError) return c.json(upstreamError(error), 503)
        throw error
      }
    })

    .get('/fx', async (c) => {
      try {
        c.header('Cache-Control', 'no-store')
        return c.json(await fxTicker.current())
      } catch (error) {
        if (error instanceof UpstreamUnavailableError) return c.json(upstreamError(error), 503)
        throw error
      }
    })

    /** Best performers of the last 30 days per niche: `?class=stocks|etfs|crypto`. */
    .get('/movers', async (c) => {
      const { class: assetClass } = readQuery(c, moversQuery)
      try {
        const movers = await marketMovers.get(assetClass)
        c.header('Cache-Control', 'private, max-age=60')
        return c.json(movers)
      } catch (error) {
        if (error instanceof UpstreamUnavailableError) return c.json(upstreamError(error), 503)
        throw error
      }
    })

    /** Server-Sent Events: pushes a `snapshot` event on connect and on every refresh of the shared ticker. */
    .get('/fx/stream', (c) => {
      // `no-transform` keeps compression middleware from buffering the stream.
      c.header('Cache-Control', 'no-cache, no-transform')
      c.header('X-Accel-Buffering', 'no')
      return streamSSE(c, async (stream) => {
        let sequence = 0
        const send = (snapshot: FxSnapshot) =>
          stream.writeSSE({ event: 'snapshot', id: String((sequence += 1)), data: JSON.stringify(snapshot) }).catch(() => undefined)

        const unsubscribe = fxTicker.subscribe((snapshot) => {
          void send(snapshot)
        })
        stream.onAbort(unsubscribe)

        try {
          await send(await fxTicker.current())
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Divisas no disponibles.'
          await stream.writeSSE({ event: 'unavailable', data: JSON.stringify({ message }) })
        }

        while (!stream.aborted && !stream.closed) {
          await stream.sleep(heartbeatMs)
          if (!stream.aborted && !stream.closed) await stream.write(': keep-alive\n\n').catch(() => undefined)
        }
        unsubscribe()
      })
    })
}
