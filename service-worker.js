/* Service Worker for SP-2025-eSIM (network-first HTML, cache-first assets) */
const CACHE_VERSION = 'v2025-08-29-1';
const CACHE_NAME = `sp-2025-esim-${CACHE_VERSION}`;
const BASE = '/SP-2025-eSIM';

const PRECACHE_URLS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/assets/manifest.json`,
  `${BASE}/assets/icons/icon-192x192.png`,
  `${BASE}/assets/icons/icon-512x512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.endsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';
  const isIndex = url.pathname === `${BASE}/` || url.pathname.endsWith(`${BASE}/index.html`);

  // Network-first for navigations/HTML
  if (isNavigation || isIndex) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match(`${BASE}/index.html`));
      }
    })());
    return;
  }

  // Cache-first with background refresh for other same-origin assets
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) {
      fetch(req).then(resp => { if (resp && resp.ok) cache.put(req, resp.clone()); }).catch(() => {});
      return cached;
    }
    try {
      const resp = await fetch(req);
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
