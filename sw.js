// Service worker mínimo: no cachea nada especial, solo hace
// que Chrome/Android consideren la web como instalable (PWA).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
