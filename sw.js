/**
 * sw.js — LifeQuest Service Worker
 * Strategia: Cache-First per asset statici, Network-First per API.
 */

const CACHE_NAME = 'lifequest-v1';
const RUNTIME_CACHE = 'lifequest-runtime-v1';

// Asset da precachare all'installazione
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './css/animations.css',
  './js/main.js',
  './js/config.js',
  './js/utils.js',
  './js/db.js',
  './js/api.js',
  './js/auth.js',
  './js/audio.js',
  './js/xp.js',
  './js/trophies.js',
  './js/modals.js',
  './js/screens/home.js',
  './js/screens/quest.js',
  './js/screens/study.js',
  './js/screens/routine.js',
  './js/screens/pvp.js',
  './js/screens/books.js',
  './js/screens/libri.js',
  './js/screens/social.js',
  './js/screens/stats.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/audio/tap.mp3',
  './assets/audio/xp.mp3',
  './assets/audio/levelup.mp3',
  './assets/audio/error.mp3',
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching assets...');
        return cache.addAll(PRECACHE_ASSETS).catch(err => {
          console.warn('[SW] Alcuni asset non cachati:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => {
            console.log('[SW] Eliminazione vecchia cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Network-First per Supabase API (Fase 2)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network-First per Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Cache-First per tutti gli asset statici locali
  event.respondWith(cacheFirst(request));
});

// ─── Strategie ───────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline — risorsa non disponibile.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request) || new Response('', { status: 204 });
  }
}

// ─── Background Sync (Fase 2 — Supabase) ─────────────────────────────────────

self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

// ─── Push Notifications (Fase 3) ─────────────────────────────────────────────

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const { title = 'LifeQuest', body = 'Nuova notifica!', icon = './assets/icons/icon-192.png', url = './' } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: './assets/icons/icon-192.png',
      data: { url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || './')
  );
});
