// Subir este número en cada deploy importante: el service worker nuevo se instala solo y
// las pestañas abiertas avisan (ver 'Actualización de la app' en shared/ui-utils.js).
const CACHE = 'ziv-v4';

// Archivos estáticos que se pre-cachean al instalar
const SHELL = [
  '/',
  '/shared/firebase.js',
  '/shared/ui-utils.js',
  '/assets/favicon.svg',
  '/admin.js',
  '/territorios/index.html',
  '/territorios/app.js',
  '/territorios/mapa.html',
  '/asignaciones/index.html',
  '/asignaciones/app.js',
  '/vida-ministerio/index.html',
  '/vida-ministerio/app.js',
  '/vida-ministerio/programa.html',
  '/vida-ministerio/programa.js',
  '/predicacion/index.html',
  '/conferencias/index.html',
];

// Instalar: pre-cachear la app shell
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first para mismo origen (garantiza archivos frescos)
// Firebase, CDN (Leaflet, Firebase SDK, PostHog) son cross-origin → pasan directo a red
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Network first: intenta red, actualiza cache, cae en cache si está offline
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
