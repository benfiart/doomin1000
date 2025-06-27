const CACHE_NAME = 'doomin1000-v8';
const CACHE_VERSION = 8;
const STATIC_CACHE = `doomin1000-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `doomin1000-dynamic-v${CACHE_VERSION}`;

// Essential files for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/img/Dooms.png',
  '/img/favicon.png',
  '/img/icon-192x192.png',
  '/img/icon-512x512.png'
];

// Fonts and external resources
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@100;400&display=swap'
];

// Install event - cache essential resources only
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.warn('Failed to cache some static assets:', error);
          // Cache individual files to avoid iOS 17 cache bug
          return Promise.allSettled(
            STATIC_ASSETS.map(url => cache.add(url).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
            }))
          );
        });
      }),
      caches.open(DYNAMIC_CACHE).then((cache) => {
        console.log('Caching external assets');
        return Promise.allSettled(
          EXTERNAL_ASSETS.map(url => cache.add(url).catch(err => {
            console.warn(`Failed to cache external asset ${url}:`, err);
          }))
        );
      })
    ]).then(() => {
      console.log('Service Worker installation complete');
      self.skipWaiting();
    }).catch((error) => {
      console.error('Service Worker installation failed:', error);
    })
  );
});

// Activate event - force complete cache clear
self.addEventListener('activate', (event) => {
  console.log('Service Worker v5 activating - forcing complete cache clear...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('Deleting ALL caches:', cacheNames);
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('All caches cleared, taking control');
      return self.clients.claim();
    }).then(() => {
      // Force reload all tabs
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          console.log('Sending reload message to client');
          client.postMessage({ type: 'FORCE_RELOAD' });
        });
      });
    })
  );
});

// Fetch event - iOS 17 compatible strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests
  if (request.destination === 'document') {
    // Navigation requests - cache first with network fallback
    event.respondWith(handleNavigationRequest(request));
  } else if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
    // Static assets - cache first
    event.respondWith(handleStaticAssets(request));
  } else if (url.origin === location.origin) {
    // Same origin requests - stale while revalidate
    event.respondWith(handleSameOriginRequest(request));
  } else {
    // External requests - network first with cache fallback
    event.respondWith(handleExternalRequest(request));
  }
});

// Navigation request handler
async function handleNavigationRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone()).catch(err => {
        console.warn('Failed to cache navigation request:', err);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('Navigation request failed:', error);
    const fallback = await caches.match('/index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

// Static assets handler
async function handleStaticAssets(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone()).catch(err => {
        console.warn('Failed to cache static asset:', err);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('Static asset request failed:', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Same origin request handler
async function handleSameOriginRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    // Try network first, fallback to cache
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone()).catch(err => {
          console.warn('Failed to cache same-origin request:', err);
        });
      }
      
      return networkResponse;
    } catch (networkError) {
      if (cachedResponse) {
        return cachedResponse;
      }
      throw networkError;
    }
  } catch (error) {
    console.warn('Same origin request failed:', error);
    return new Response('Request failed', { status: 503 });
  }
}

// External request handler
async function handleExternalRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone()).catch(err => {
        console.warn('Failed to cache external request:', err);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('External request failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('External resource not available offline', { status: 503 });
  }
}

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker activation complete');
    })
  );
});

// Message handler for manual cache clearing (iOS 17 fix)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Manual cache clear requested');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('doomin1000')) {
              console.log('Clearing cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch((error) => {
        console.error('Cache clear failed:', error);
        event.ports[0].postMessage({ success: false, error: error.message });
      })
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for better offline experience
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    event.waitUntil(
      // Could be used for syncing data when back online
      Promise.resolve()
    );
  }
});

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection in SW:', event.reason);
  event.preventDefault();
});