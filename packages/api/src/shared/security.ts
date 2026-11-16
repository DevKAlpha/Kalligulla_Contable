import type { Context, MiddlewareHandler } from 'hono'

/**
 * Until accounts exist the API has no login, so it only answers requests addressed to an
 * allowed host name. This blocks DNS-rebinding attacks against a server bound to localhost.
 * Deployments under another name must list it in KALIGULA_ALLOWED_HOSTS.
 */
export const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const

export function hostName(hostHeader: string | undefined): string {
  const host = (hostHeader ?? '').trim().toLowerCase()
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1)
  return host.split(':')[0]
}

/** Host the client addressed (Host header, or the URL when a runtime omits the header). */
export function requestHost(c: Context): string {
  return (c.req.header('host') ?? new URL(c.req.url).host).toLowerCase()
}

export function hostGuard(allowed: readonly string[] | '*'): MiddlewareHandler {
  const set = allowed === '*' ? null : new Set(allowed.map((host) => host.toLowerCase()))
  return async (c, next) => {
    if (set && !set.has(hostName(requestHost(c)))) {
      return c.json({ error: { code: 'forbidden_host', message: 'Host no permitido.' } }, 403)
    }
    await next()
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Cross-site request forgery protection for state-changing requests:
 * - the browser must report a same-origin request (Origin / Sec-Fetch-Site), and
 * - bodies must be JSON, which cross-site pages cannot send without a CORS preflight (never granted).
 */
export function sameOriginWrites(): MiddlewareHandler {
  return async (c, next) => {
    if (!UNSAFE_METHODS.has(c.req.method)) return next()

    const origin = c.req.header('origin')
    if (origin) {
      let originHost = ''
      try {
        originHost = new URL(origin).host.toLowerCase()
      } catch {
        /* malformed Origin: treated as foreign */
      }
      if (originHost !== requestHost(c)) {
        return c.json({ error: { code: 'forbidden_origin', message: 'Origen no permitido.' } }, 403)
      }
    }
    const fetchSite = c.req.header('sec-fetch-site')
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return c.json({ error: { code: 'forbidden_origin', message: 'Origen no permitido.' } }, 403)
    }
    if (c.req.method !== 'DELETE' && !(c.req.header('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return c.json({ error: { code: 'unsupported_media_type', message: 'Envía el cuerpo como application/json.' } }, 415)
    }
    await next()
  }
}
