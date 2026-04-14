/**
 * TechMart Network — Service Worker
 * Strategy: Cache-first for static assets, network-first for API/data.
 * Provides offline fallback so the shell loads even without connectivity.
 */

const CACHE_VERSION  = 'v1';
const STATIC_CACHE   = `techmart-static-${CACHE_VERSION}`;
const RUNTIME_CACHE  = `techmart-runtime-${CACHE_VERSION}`;

// Assets to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// ── Install: pre-cache the app shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  const allowedCaches = [STATIC_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !allowedCaches.includes(k))
          .map(k  => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take control immediately
  );
});

// ── Fetch: tiered caching strategy ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ① Skip non-GET and cross-origin requests (Supabase API, fonts, etc.)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // ② Skip browser-extension and dev-server noise
  if (url.protocol === 'chrome-extension:') return;

  // ③ HTML navigation → network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a fresh copy
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then(r => r || caches.match('/'))
        )
    );
    return;
  }

  // ④ Static assets (JS, CSS, images, fonts) → cache-first
  const isStatic = /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)(\?.*)?$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // ⑤ Everything else → network-first (data pages)
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Background sync message ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});