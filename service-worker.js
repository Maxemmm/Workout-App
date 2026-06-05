// service-worker.js — cache offline minimal
// Incrémenter CACHE_NAME à chaque déploiement pour invalider l'ancien cache.

const CACHE_NAME = 'training-v15';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
];

// Installation : pré-cache les fichiers essentiels
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch : network-first pour index.html (reçoit les mises à jour immédiatement),
//         cache-first pour les autres assets (manifest, icônes).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url = new URL(e.request.url);
  const isShell = url.pathname === '/' || url.pathname === '/index.html';

  if (isShell) {
    // Network-first : correctifs de sécurité reçus sans attendre un bump de CACHE_NAME
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request)) // fallback hors-ligne
    );
  } else {
    // Cache-first pour les assets statiques (manifest, icônes)
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
  }
});
