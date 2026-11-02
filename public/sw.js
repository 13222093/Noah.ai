// Kill-switch service worker (W1, G-123).
// The old public app installed a Workbox PWA that cached pages and API
// responses, which can show stale flood data as if it were current.
// Any browser that still has that worker fetches this file on its next
// update check; it then deletes all caches and unregisters itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});
