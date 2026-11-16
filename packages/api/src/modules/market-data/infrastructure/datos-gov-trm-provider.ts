import { z } from 'zod'
import { UpstreamUnavailableError, type TrmProvider, type TrmReading } from '../domain/trm-provider'

/** Open data dataset "Tasa de Cambio Representativa del Mercado - Histórico" (Socrata). */
const DEFAULT_ENDPOINT = 'https://www.datos.gov.co/resource/32sa-8pi3.json'

const rowSchema = z.object({
  valor: z.string(),
  unidad: z.string(),
  vigenciadesde: z.string(),
  vigenciahasta: z.string(),
})

export interface DatosGovTrmProviderOptions {
  endpoint?: string
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
}

/** Adapter for datos.gov.co. Uses only web-standard APIs (fetch, URL, AbortSignal) so it runs on Node or Bun. */
export function createDatosGovTrmProvider(options: DatosGovTrmProviderOptions = {}): TrmProvider {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const timeoutMs = options.timeoutMs ?? 8_000
  const fetchImpl = options.fetch ?? globalThis.fetch

  return {
    name: 'datos.gov.co',
    async latest(): Promise<TrmReading> {
      const url = new URL(endpoint)
      url.searchParams.set('$order', 'vigenciadesde DESC')
      url.searchParams.set('$limit', '1')
      let body: unknown
      try {
        const response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        body = await response.json()
      } catch (error) {
        throw new UpstreamUnavailableError('No fue posible consultar la TRM oficial.', { cause: error })
      }
      const parsed = z.array(rowSchema).min(1).safeParse(body)
      if (!parsed.success) throw new UpstreamUnavailableError('La respuesta de la TRM no tiene el formato esperado.')
      const [row] = parsed.data
      const rate = Number(row.valor)
      if (!Number.isFinite(rate) || rate <= 0 || row.unidad !== 'COP') {
        throw new UpstreamUnavailableError('La TRM recibida no es válida.')
      }
      return {
        rate,
        currency: 'COP',
        base: 'USD',
        validFrom: row.vigenciadesde.slice(0, 10),
        validTo: row.vigenciahasta.slice(0, 10),
        source: 'Superintendencia Financiera de Colombia · datos.gov.co',
      }
    },
  }
}
