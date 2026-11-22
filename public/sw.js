const CACHE_NAME = 'incifact-pwa-v2026.11-4';
const CORE_ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.webmanifest',
  './assets/incifact-app-icon.svg',
  './assets/incifact-app-icon-192.png',
  './src/engine/ruleEngine.mjs',
  './src/engine/barcode1dDecoder.mjs',
  './src/engine/nutriScore.mjs',
  './src/i18n/locales.mjs',
  './src/data/generated/sources.mjs',
  './src/data/generated/substances.mjs',
  './src/data/generated/halal_rules.mjs',
  './src/data/generated/hidden_sugars.mjs',
  './src/data/generated/cosing_regulated.mjs',
  './src/data/generated/cosing_permitted.mjs',
  './src/data/generated/cosing_ingredients.mjs'
];

// Large/optional visual icons warmed best-effort without blocking atomic install
const OPTIONAL_ASSETS = [
  './assets/hero-shield-crest.jpg',
  './assets/incifact-app-icon.jpg',
  './assets/incifact-app-icon.png',
  './assets/incifact-app-icon-maskable-512.png',
  './assets/incifact-corporate-seal.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(CORE_ASSETS);
        await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(url)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isStaticAssetOrData =
    url.pathname.includes('/src/data/generated/') || url.pathname.includes('/assets/');

  if (isStaticAssetOrData) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }
        const net = await networkPromise;
        return net || Response.error();
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }
        return Response.error();
      })
  );
});
