const VERSION_PARAM = new URL(self.location).searchParams.get('v');
const VERSION = VERSION_PARAM || 'dev';
const CACHE_NAME = `barlink-cache-${VERSION}`;
const SUFFIX = VERSION_PARAM ? `?v=${VERSION_PARAM}` : '';

const ASSETS = [
  '/',
  '/?source=pwa',
  '/index.html',
  `/css/style.css${SUFFIX}`,
  `/js/app.js${SUFFIX}`,
  `/js/waiter.js${SUFFIX}`,
  `/js/bartender.js${SUFFIX}`,
  `/js/network.js${SUFFIX}`,
  `/js/state.js${SUFFIX}`,
  `/js/data.js${SUFFIX}`,
  `/js/session.js${SUFFIX}`,
  `/js/qr.js${SUFFIX}`,
  `/js/i18n.js${SUFFIX}`,
  `/js/locales.js${SUFFIX}`,
  `/js/ux.js${SUFFIX}`,
  `/js/trystero.min.js${SUFFIX}`,
  `/manifest.json${SUFFIX}`,
  `/icon-192.png${SUFFIX}`,
  `/icon-512.png${SUFFIX}`,
  `/icon-192.png`,
  `/icon-512.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const resp = await fetch(request);
  cache.put(request, resp.clone());
  return resp;
};

const networkFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  try {
    const resp = await fetch(request);
    cache.put(request, resp.clone());
    return resp;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.searchParams.get('v')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
