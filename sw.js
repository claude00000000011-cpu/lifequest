const CACHE_NAME = 'lifequest-v3';

self.addEventListener('install', event => {
  console.log('[SW] Installing v3...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        console.log('[SW] Eliminazione cache:', key);
        return caches.delete(key);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase: lascia passare direttamente, nessuna cache
  if (url.hostname.includes('supabase.co')) return;

  // Tutto il resto: network first, nessuna cache
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request)
    )
  );
});
