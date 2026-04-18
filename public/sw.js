/**
 * TechMart Network — Service Worker
 *
 * CRITICAL FIX vs previous version:
 *   The old code used cache.addAll([...icons...]) which is ATOMIC —
 *   if ANY single URL returns a 404 (e.g. icons not yet deployed),
 *   the entire SW install fails, Chrome never fires beforeinstallprompt,
 *   and the user sees no install prompt — especially on mobile where
 *   there is no warm browser cache.
 *
 *   This version caches each URL individually and silently ignores failures,
 *   so the SW always installs and activates regardless of missing assets.
 */

const CACHE_NAME = 'techmart-v1';

// Attempt to cache these on install, but NEVER abort if any fail.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Cache each URL individually — a single 404 will NOT abort the install.
      Promise.all(
        PRECACHE_URLS.map(url =>
          fetch(url)
            .then(res => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => { /* silently ignore — SW still installs */ })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k  => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our own origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.protocol === 'chrome-extension:') return;

  // Navigation requests (HTML pages) — network first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // Static assets — cache first, network fallback
  const isStatic = /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)(\?.*)?$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else — network first
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ── Message ───────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});