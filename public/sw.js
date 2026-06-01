const CACHE_NAME = 'opentube-v1'
const STATIC_CACHE = 'opentube-static-v1'

const STATIC_ASSETS = [
  '/',
  '/library',
  '/settings',
  '/manifest.json',
]

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore cache failures
      })
    })
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch: strategy based on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API calls: network first, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: '오프라인 상태입니다', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    return
  }

  // Storage files (videos): cache first
  if (url.pathname.startsWith('/api/storage/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone())
            return response
          }).catch(() => new Response('오프라인', { status: 503 }))
        })
      })
    )
    return
  }

  // Static assets: cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, response.clone())
          })
        }
        return response
      }).catch(() => {
        // Return offline page for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/') || new Response('<h1>오프라인</h1>', {
            headers: { 'Content-Type': 'text/html' }
          })
        }
        return new Response('오프라인', { status: 503 })
      })
    })
  )
})
