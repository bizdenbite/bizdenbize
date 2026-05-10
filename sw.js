// BizdenBize Service Worker
// Strategy: Cache-first for assets, Network-first for pages

const CACHE_NAME = 'bizdenbize-v1';
const OFFLINE_PAGE = '/404.html';

// Assets to pre-cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/mahallem.html',
  '/classifieds.html',
  '/events.html',
  '/business.html',
  '/abibot.html',
  '/messages.html',
  '/profile.html',
  '/login.html',
  '/404.html',
  '/manifest.json',
  '/logo.png',
];

// ── INSTALL: pre-cache core assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: smart caching strategy ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests (API, fonts, etc.)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Skip API calls — always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) return;

  // HTML pages → Network-first (fresh content), fallback to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }

  // Static assets (images, fonts, CSS, JS) → Cache-first
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // Only cache successful responses
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => caches.match(OFFLINE_PAGE))
  );
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'BizdenBize';
  const options = {
    body: data.body || 'Yeni bir bildiriminiz var.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/mahallem.html' },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
    requireInteraction: data.requireInteraction || false,
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/mahallem.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus existing window if open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

// ── BACKGROUND SYNC (messages) ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // In production: flush queued messages from IndexedDB to server
  console.log('[SW] Background sync: messages');
}
