import type { Health } from '@kaligula/contracts'
import type { DatabaseHandle } from '@kaligula/db'
import { Hono } from 'hono'
import type { AppEnv } from '../../shared/http'

export function healthRoutes(info: { service: string; version: string }, database: DatabaseHandle, clock: () => Date) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const databaseUp = await database.ping()
    const body: Health = {
      status: databaseUp ? 'ok' : 'degraded',
      service: info.service,
      version: info.version,
      time: clock().toISOString(),
      database: { status: databaseUp ? 'ok' : 'error', engine: database.engine },
    }
    c.header('Cache-Control', 'no-store')
    return c.json(body, databaseUp ? 200 : 503)
  })
}
