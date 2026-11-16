import {
  categoryCreateSchema, categoryUpdateSchema, movementInputSchema, movementListQuerySchema,
} from '@kaligula/contracts'
import { Hono } from 'hono'
import { readJson, readQuery, uuidParam, type AppEnv } from '../../shared/http'
import type { LedgerService } from './ledger-service'

export function categoryRoutes(service: LedgerService) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json({ items: await service.listCategories(c.var.owner) }))
    .post('/', async (c) => c.json(await service.createCategory(c.var.owner, await readJson(c, categoryCreateSchema)), 201))
    .patch('/:id', async (c) => {
      const { name } = await readJson(c, categoryUpdateSchema)
      return c.json(await service.renameCategory(c.var.owner, uuidParam(c), name))
    })
    .delete('/:id', async (c) => c.json(await service.deleteCategory(c.var.owner, uuidParam(c))))
}

export function movementRoutes(service: LedgerService) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      const { type, ...query } = readQuery(c, movementListQuerySchema)
      const page = await service.listMovements(c.var.owner, { ...query, types: type })
      return c.json({ ...page, limit: query.limit, offset: query.offset })
    })
    .get('/:id', async (c) => c.json(await service.getMovement(c.var.owner, uuidParam(c))))
    .post('/', async (c) => c.json(await service.createMovement(c.var.owner, await readJson(c, movementInputSchema)), 201))
    .put('/:id', async (c) => {
      const input = await readJson(c, movementInputSchema)
      return c.json(await service.updateMovement(c.var.owner, uuidParam(c), input))
    })
    .delete('/:id', async (c) => {
      await service.deleteMovement(c.var.owner, uuidParam(c))
      return c.body(null, 204)
    })
}

export function overviewRoutes(service: LedgerService) {
  return new Hono<AppEnv>().get('/', async (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json(await service.overview(c.var.owner))
  })
}
