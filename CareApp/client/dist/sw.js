const STATIC_CACHE = 'careapp-static-v2';
const RUNTIME_CACHE = 'careapp-runtime-v2';
const CURRENT_CACHES = [STATIC_CACHE, RUNTIME_CACHE];
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);

const isApiRequest = (url) => url.pathname.startsWith('/api') || (url.port === '4000' && url.pathname.startsWith('/api'));

const builtAssetsFromIndex = async (cache) => {
  const response = await fetch(new Request('/index.html', { cache: 'reload' }));
  if (!response.ok) return [];

  await cache.put('/index.html', response.clone());
  const html = await response.text();
  return [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const builtAssets = await builtAssetsFromIndex(cache).catch(() => []);
      await Promise.allSettled(
        [...SHELL_ASSETS, ...builtAssets].map((asset) => cache.add(new Request(asset, { cache: 'reload' })))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (isApiRequest(url) || url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  if (STATIC_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
            return response;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
