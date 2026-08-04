// MARSAD service worker — minimal, safety-first PWA shell.
//
// Design goals (in priority order):
// 1. Never serve stale or cached data from /api/* — this is a legal decision
//    platform; correctness beats offline availability for anything dynamic.
// 2. Keep the app installable/launchable offline (shell + offline fallback)
//    without caching anything that could go stale in a way that misleads a
//    user (no cached HTML for the app shell itself — only a dedicated
//    offline page).
// 3. Cache-first for hashed static build assets (JS/CSS/fonts/icons) since
//    Vite fingerprints filenames — a cached asset is either exactly correct
//    or unreachable by a new build, never "subtly stale".
//
// Bump CACHE_VERSION on structural changes to this file's caching strategy.
// v3 — forced update Aug 2026: clears all old v1/v2 caches on all devices,
// resolves iOS standalone-mode serving stale build assets after republish.
const CACHE_VERSION = 'marsad-shell-v3';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept mutations

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin (fonts CDN, etc.)

  // Never cache API traffic — always hit the network for live/auth-sensitive data.
  if (isApiRequest(url)) return;

  // App shell navigations: network-first, offline fallback only when the
  // network is truly unreachable (never serve a stale cached index.html).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Hashed static build assets: cache-first, populate cache on first fetch.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
      }),
    );
  }
});
