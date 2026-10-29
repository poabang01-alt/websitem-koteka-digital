/* Koteka Digital: bounded, same-origin, static-public-content PWA cache. */
'use strict';
const VERSION = 'v29-deploy-readiness-20261029';
const PREFIX = 'koteka-digital-';
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`;
const STATIC_CACHE = `${PREFIX}static-${VERSION}`;
const MEDIA_CACHE = `${PREFIX}media-${VERSION}`;
const NAV_LIMIT = 22;
const STATIC_LIMIT = 70;
const MEDIA_LIMIT = 65;
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const SHELL_URLS = [
  `${BASE}/`,
  `${BASE}/offline.html`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/assets/index-B3BNhf1J.js`,
  `${BASE}/assets/public-entry.js`,
  `${BASE}/assets/public-runtime.js`,
  `${BASE}/assets/koteka-interactions.css`,
  `${BASE}/assets/koteka-workspace-sync.js`,
  `${BASE}/assets/kd-de0747668b.css`,
  `${BASE}/assets/kd-37f189b118.js`,
  `${BASE}/assets/kd-icons-loader-20261010.js`,
  `${BASE}/assets/kd-offline-20261010.js`,
  `${BASE}/assets/koteka-audit9-public.css`,
  `${BASE}/assets/koteka-mobile-performance-20261023.css`,
  `${BASE}/assets/koteka-public-mobile-audit-20261023.css`,
  `${BASE}/assets/public-fonts.css`,
  `${BASE}/assets/koteka-audit9-public.js`,
  `${BASE}/img/koteka-app-icon-192.png`
];
const isPublicPage = (path) => path === '/' || path === '/index.html' ||
  /^\/(?:layanan|portofolio|blog|privacy-policy)\/$/.test(path) ||
  /^\/blog\/[a-z0-9-]+\/$/.test(path);
const isCacheable = (response) => response && response.ok &&
  (response.type === 'basic' || response.type === 'default');

const trimCache = async (cache, maxEntries, protectedUrls = []) => {
  const keys = await cache.keys();
  const removable = keys.filter((request) => !protectedUrls.includes(new URL(request.url).pathname));
  const excess = Math.max(0, keys.length - maxEntries);
  await Promise.all(removable.slice(0, excess).map((request) => cache.delete(request)));
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) &&
      ![SHELL_CACHE, STATIC_CACHE, MEDIA_CACHE].includes(key))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

const navigation = async (request) => {
  const path = new URL(request.url).pathname.slice(BASE.length) || '/';
  try {
    const response = await fetch(request);
    if (isPublicPage(path) && isCacheable(response)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
      await trimCache(cache, NAV_LIMIT, SHELL_URLS);
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || (await caches.match(`${BASE}/offline.html`)) || Response.error();
  }
};

const staticAsset = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const assetName = new URL(request.url).pathname.split('/').pop() || '';
  // Recognize this build's Vite IDs and hex hashes, not dates or editorial filenames.
  const suffix = assetName.match(/-([A-Za-z0-9_-]{8}|[a-f0-9]{10})\.(?:js|css)$/)?.[1];
  const generated = suffix && (suffix.length === 8 ? /[A-Z]/.test(suffix) : /[a-f]/.test(suffix));
  const patchedBuildAsset = /^(?:index-B3BNhf1J\.js|appBoot-634c31a5ba\.js|Reveal-a4c48c8478\.js|PricingSectionContainer-CyXKa1Eh\.js|kd-37f189b118\.js|kd-de0747668b\.css)$/.test(assetName);
  if (generated && !patchedBuildAsset) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
      await trimCache(cache, STATIC_LIMIT);
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || Response.error();
  }
};

const mediaAsset = async (request, event) => {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
      await trimCache(cache, MEDIA_LIMIT);
    }
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh.catch(() => Response.error());
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(`${BASE}/`)) return;
  const path = url.pathname.slice(BASE.length);
  // Never intercept API/auth requests or private data.
  if (/^\/(?:api|admin|auth|login|dashboard)(?:\/|$)/.test(path)) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
  } else if (/\.(?:js|css)$/.test(path) && path.startsWith('/assets/')) {
    event.respondWith(staticAsset(request));
  } else if (/^\/(?:assets|img|downloads)\//.test(path)) {
    event.respondWith(mediaAsset(request, event));
  }
});
