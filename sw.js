const CACHE_NAME = 'lifequest-v4';

self.addEventListener('install', event => {
  console.log('[SW] Installing v3...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          console.log('[SW] Eliminazione cache:', key);
          return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase passa sempre direttamente alla rete
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);

      if (cached) {
        return cached;
      }

      return new Response(
        'Risorsa non disponibile offline',
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8'
          }
        }
      );
    })
  );
});
