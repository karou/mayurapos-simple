const CACHE_NAME = 'mayurapos-v1';
const OFFLINE_URL = '/offline.html';

// Core assets to cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/static/js/main.chunk.js',
  '/static/css/main.chunk.css',
  OFFLINE_URL
];

// Install event: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CORE_ASSETS);
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: network-first strategy with offline fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Chrome DevTools
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If online, cache the response for future use
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // Only cache successful responses
          if (response.status === 200 && response.type === 'basic') {
            cache.put(event.request, responseToCache);
          }
        });
        return response;
      })
      .catch(() => {
        // Offline: try to match request in cache
        return caches.match(event.request)
          .then((response) => {
            // If found in cache, return it
            if (response) {
              return response;
            }
            
            // If not in cache, return offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
            
            // For other resources, return a network error
            throw new Error('No offline content available');
          })
      })
  );
});

// Handle push notifications (placeholder)
self.addEventListener('push', (event) => {
  const title = 'MayuraPOS Notification';
  const options = {
    body: event.data.text(),
    icon: '/logo192.png',
    badge: '/logo192.png'
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle message from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});