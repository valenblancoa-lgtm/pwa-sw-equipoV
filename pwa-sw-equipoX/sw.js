const VERSION = 'v2';
const CACHE_ESTATICO = `estatico-${VERSION}`;
const CACHE_DATOS = `datos-${VERSION}`;
// Reto A: caché para recursos dinámicos (no precacheados), con límite de entradas
const CACHE_DINAMICO = `dinamico-${VERSION}`;
const MAX_ENTRADAS = 10;

const PRECACHE = [
  './', './index.html', './styles.css', './app.js',
  './offline.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  console.log('[SW] install', VERSION);
  event.waitUntil(
    caches.open(CACHE_ESTATICO).then(c => c.addAll(PRECACHE))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] activate', VERSION);
  const vigentes = [CACHE_ESTATICO, CACHE_DATOS, CACHE_DINAMICO];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !vigentes.includes(k))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
  } else if (url.pathname.endsWith('/data/tareas.json')) {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

// Reto A: deja la caché con un máximo de `max` entradas, borrando las más antiguas.
// cache.keys() devuelve las peticiones en orden de inserción, así que las primeras
// son las más viejas.
async function limitarCache(nombre, max) {
  const cache = await caches.open(nombre);
  const keys = await cache.keys();
  if (keys.length > max) {
    const sobrantes = keys.slice(0, keys.length - max);
    await Promise.all(sobrantes.map(k => cache.delete(k)));
    console.log(`[SW] limitarCache: ${nombre} recortada de ${keys.length} a ${max}`);
  }
}

// Estrategia 1: cache-first (recursos estáticos)
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const resp = await fetch(req);
  if (resp.ok) {
    const cache = await caches.open(CACHE_DINAMICO);
    await cache.put(req, resp.clone());
    await limitarCache(CACHE_DINAMICO, MAX_ENTRADAS);
  }
  return resp;
}

// Estrategia 2: network-first con respaldo offline (navegación)
async function networkFirst(req) {
  try {
    const resp = await fetch(req, { cache: 'no-cache' });
    if (resp.ok) {
      const cache = await caches.open(CACHE_ESTATICO);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (e) {
    return (await caches.match(req)) ||
           (await caches.match('./offline.html'));
  }
}

// Estrategia 3: stale-while-revalidate (datos)
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_DATOS);
  const cached = await cache.match(req);
  const red = fetch(req, { cache: 'no-cache' })
    .then(async resp => {
      if (resp.ok) {
        await cache.put(req, resp.clone());
        await limitarCache(CACHE_DATOS, MAX_ENTRADAS);
      }
      return resp;
    })
    .catch(() => cached);
  return cached || red;
}
