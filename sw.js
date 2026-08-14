const SW_VERSION = 'lifequest-v3';

self.addEventListener('install', () => {
  console.log('[SW]', SW_VERSION, 'installato');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  console.log('[SW]', SW_VERSION, 'attivo — cache pulita');
});
