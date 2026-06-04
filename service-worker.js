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

// Fetch : cache-first, réseau en fallback
self.addEventListener('fetch', (e) => {
  // Ignorer les requêtes non-GET et les URLs externes
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // Mettre en cache la réponse fraîche
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
