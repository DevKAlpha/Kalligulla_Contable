import { Hono } from 'hono'
import type { Health } from '@kaligula/contracts'

export function healthRoutes(info: { service: string; version: string }, clock: () => Date) {
  return new Hono().get('/', (c) => {
    const body: Health = { status: 'ok', service: info.service, version: info.version, time: clock().toISOString() }
    c.header('Cache-Control', 'no-store')
    return c.json(body)
  })
}
