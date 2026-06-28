const CACHE_NAME = 'chess-game-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// On install, pre-cache core static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch events
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip Firebase, real-time database, and auth networks
  if (
    url.origin !== self.location.origin || 
    url.pathname.startsWith('/__/') || 
    url.host.includes('firestore.googleapis.com') ||
    url.host.includes('firebaseapp.com') ||
    url.host.includes('googleapis.com')
  ) {
    return;
  }

  // Handle caching for local assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          event.request.method === 'GET'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return cached asset if offline
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
