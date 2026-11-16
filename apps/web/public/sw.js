/* Kaligula service worker: offline shell for the installable web app. */
const CACHE_NAME = 'kaligula-v11'
const CORE_FILES = ['/', '/gastos', '/inversiones', '/prestamos', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function putInCache(request, response) {
  if (!response.ok) return response
  const copy = response.clone()
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API: always network. The UI already handles an unavailable TRM.
  if (url.pathname.startsWith('/api/')) return

  // Pages: network first, cached copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    )
    return
  }

  // Hashed build assets are immutable: cache first.
  if (url.pathname.startsWith('/_next/static/') || /\.(png|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => putInCache(request, response))))
  }
})
