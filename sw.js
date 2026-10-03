// LingScout service worker
// - Páginas, JS y CSS propios: red primero (así los deploys de Vercel se ven al momento)
//   y, si no hay conexión, se sirve la última copia guardada.
// - Librerías externas (supabase-js, chart.js, fuentes): se guardan tras el primer uso.
// - Supabase (datos y login): nunca se toca, siempre va directo a la red.
//
// Al cambiar archivos de la app no hace falta tocar nada aquí.
// Solo sube CACHE_VERSION si quieres forzar una limpieza total de la caché.

const CACHE_VERSION = 'v2';
const CACHE = `lingscout-${CACHE_VERSION}`;

const SHELL = [
  'index.html', 'app.html', 'jugadores.html', 'jugador.html', 'ficha.html',
  'partidos.html', 'partido.html', 'pizarra.html', 'calendario.html', 'revision.html',
  'css/style.css',
  'js/theme.js', 'js/supabaseConfig.js', 'js/pwa.js', 'js/i18n.js', 'js/auth.js',
  'js/dashboard.js', 'js/jugadoresList.js', 'js/jugadorForm.js', 'js/fichaJugador.js',
  'js/partidosList.js', 'js/partidoForm.js', 'js/pizarra.js', 'js/drawingTool.js',
  'js/calendario.js', 'js/revision.js', 'js/exportar.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.js'
];

const EXTERNAL_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Se guarda cada archivo por separado: si uno falla, el resto sigue.
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('lingscout-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase y cualquier otro dominio no previsto: directo a la red.
  if (url.origin !== self.location.origin && !EXTERNAL_HOSTS.includes(url.hostname)) return;

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // Sin conexión: primero la copia exacta; si no, la misma ruta ignorando ?v=...
    const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const fallback = await cache.match('app.html');
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
