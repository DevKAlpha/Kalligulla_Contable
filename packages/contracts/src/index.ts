import { z } from 'zod'

/** Official Colombian exchange rate (TRM) as published by the Superintendencia Financiera. */
export const trmQuoteSchema = z.object({
  /** COP per 1 USD. */
  rate: z.number().positive(),
  currency: z.literal('COP'),
  base: z.literal('USD'),
  validFrom: z.iso.date(),
  validTo: z.iso.date(),
  source: z.string(),
  fetchedAt: z.iso.datetime(),
  /** True when the upstream source failed and a cached value is being served. */
  stale: z.boolean(),
})
export type TrmQuote = z.infer<typeof trmQuoteSchema>

export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  time: z.iso.datetime(),
})
export type Health = z.infer<typeof healthSchema>

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})
export type ApiError = z.infer<typeof apiErrorSchema>
