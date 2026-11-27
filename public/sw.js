// Retire stale CODA app-shell caches; all requests use the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('coda-')) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
