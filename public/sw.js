const CACHE_NAME = 'incifact-pwa-v2026.10';
const CORE_ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.webmanifest',
  './assets/incifact-app-icon.jpg',
  './assets/incifact-corporate-seal.jpg',
  './src/engine/ruleEngine.mjs',
  './src/i18n/locales.mjs',
  './src/data/generated/sources.mjs',
  './src/data/generated/substances.mjs',
  './src/data/generated/halal_rules.mjs',
  './src/data/generated/hidden_sugars.mjs',
  './src/data/generated/cosing_ingredients.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
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

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
