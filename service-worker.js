/* eslint-disable no-restricted-globals */
const VERSION = 'v2025-08-30-02';
const CACHE_NAME = `sp-2025-esim-${VERSION}`;

const APP_SHELL = [
  '/SP-2025-eSIM/',
  '/SP-2025-eSIM/index.html',
  '/SP-2025-eSIM/assets/manifest.json',
  '/SP-2025-eSIM/assets/icons/icon-192x192.png',
  '/SP-2025-eSIM/assets/icons/icon-512x512.png',
  '/SP-2025-eSIM/assets/icons/favicon-16.png',
  '/SP-2025-eSIM/assets/icons/favicon-32.png',
  '/SP-2025-eSIM/offline.html',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sp-2025-esim-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of clientsList) {
      client.postMessage({ type: 'NEW_VERSION_ACTIVATED', version: VERSION });
    }
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

async function networkFirstNavigation(request) {
  const NETWORK_TIMEOUT_MS = 3500;
  try {
    const response = await promiseWithTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    const cache = await caches.open(CACHE_NAME);
    cache.put('/SP-2025-eSIM/index.html', response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match('/SP-2025-eSIM/index.html') ||
                   await caches.match('/SP-2025-eSIM/offline.html');
    return cached;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (!response || (!response.ok && response.type !== 'opaque')) return response;
    cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || networkFetch || fetch(request);
}

function promiseWithTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}
