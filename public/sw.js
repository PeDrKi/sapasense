// Offline support: the app computes plans in the browser, so once its files are cached it works without network.
// Same-origin GET only. Pages: network first (fresh deploys), fallback to cache. Assets/fonts: cache first.
const CACHE = 'sapasense-v3'
const TILES = 'sapasense-tiles'   // OSM map tiles the user has already viewed (cache-first, capped)
const TILE_MAX = 400
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './favicon.svg', './manifest.webmanifest']).catch(() => {}))) })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (/^[abc]\.tile\.openstreetmap\.org$/.test(url.hostname)) {   // map tiles viewed before stay available offline
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req)
      if (hit) return hit
      try {
        const r = await fetch(req)
        if (r.ok) { c.put(req, r.clone()); c.keys().then(ks => { if (ks.length > TILE_MAX) ks.slice(0, ks.length - TILE_MAX).forEach(k => c.delete(k)) }) }
        return r
      } catch { return Response.error() }
    }))
    return
  }
  if (url.origin !== self.location.origin) return          // weather etc.: let the browser handle them
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('./', c)); return r }).catch(() => caches.match('./')))
    return
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)) }
    return r
  })))
})
