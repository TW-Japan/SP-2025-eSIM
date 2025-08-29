/* Service Worker for SP-2025-transport (cache-refresh) */
const CACHE_NAME = 'sp-2025-transport-v2';
const OFFLINE_URL = '/SP-2025-transport/index.html';

const URLS_TO_CACHE = [
  '/SP-2025-transport/',
  '/SP-2025-transport/index.html',
  '/SP-2025-transport/assets/manifest.json',
  '/SP-2025-transport/assets/icons/icon-192x192.png',
  '/SP-2025-transport/assets/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Optional: allow pages to tell the SW to activate immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Network-First for HTML/navigations to avoid stale index from cache
  const isNavigation = req.mode === 'navigate' || req.destination === 'document';
  const isIndex =
    (isSameOrigin && (
      url.pathname === '/SP-2025-transport/' ||
      url.pathname.endsWith('/SP-2025-transport/index.html')
    ));

  if (isNavigation || isIndex) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Stale-While-Revalidate for other same-origin assets
  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
