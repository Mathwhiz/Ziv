// Subir este número en cada deploy importante: el service worker nuevo se instala solo y
// las pestañas abiertas avisan (ver 'Actualización de la app' en shared/ui-utils.js).
const CACHE = 'ziv-v27';

// Lo que se guarda en el celular al instalar: las páginas y el código de cada módulo, para que con mala
// señal (o sin) el módulo abra igual con la última versión que se vio. El panel de admin no va: casi nadie
// lo usa. Si un archivo falta, se saltea (no frena la instalación).
const SHELL = [
  '/',
  '/manifest.json',
  '/assets/favicon.svg',
  '/shared/firebase.js',
  '/shared/auth.js',
  '/shared/auth-config.js',
  '/shared/actividad.js',
  '/shared/tutorial.js',
  '/territorios/index.html',
  '/territorios/app.js',
  '/territorios/mapa.html',
  '/asignaciones/index.html',
  '/asignaciones/app.js',
  '/asignaciones/programa.html',
  '/asignaciones/programa.js',
  '/vida-ministerio/index.html',
  '/vida-ministerio/app.js',
  '/vida-ministerio/programa.html',
  '/vida-ministerio/programa.js',
  '/predicacion/index.html',
  '/predicacion/app.js',
  '/conferencias/index.html',
  '/conferencias/app.js',
  '/edificios/index.html',
  '/edificios/app.js',
  '/hermanos/index.html',
  '/hermanos/app.js',
  '/telefonica/index.html',
];

// Archivos que nunca cambian bajo la misma dirección: los propios con ?v= (estilos, ui-utils: al cambiarlos
// se sube la versión, o sea que la dirección es otra) y las librerías de CDN con versión fija. Esos se toman
// del celular sin preguntar al servidor; el resto se sigue pidiendo a la red primero.
const CDN_FIJOS = [
  'https://www.gstatic.com/firebasejs/',
  'https://unpkg.com/leaflet@',
  'https://cdnjs.cloudflare.com/ajax/libs/',
];
function esFijo(url) {
  if (url.origin === location.origin) return url.searchParams.has('v');
  return CDN_FIJOS.some(p => url.href.startsWith(p));
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

// Activar: limpiar caches viejos (con ellos se van también las versiones viejas de los ?v=)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Fijos: del celular; si no está, de la red y se guarda
  if (esFijo(url)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(response => {
        // opaque = script de otro dominio cargado sin CORS: no se puede ver el estado, pero sirve igual
        if (response.ok || response.type === 'opaque') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }))
    );
    return;
  }

  // Firestore, Auth, PostHog y el resto de otros dominios: directo a la red
  if (url.origin !== location.origin) return;

  // Mismo dominio sin versión (páginas, app.js): red primero, revalidando; sin red, la copia guardada.
  // Una página con parámetros (?congre=…) se busca sin ellos, y si no hay copia de esa página, la portada.
  const esPagina = e.request.mode === 'navigate';
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: esPagina })
        .then(r => r || (esPagina ? caches.match('/') : undefined))
        .then(r => r || Response.error()))
  );
});
