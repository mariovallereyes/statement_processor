/**
 * Service Worker for Bank Statement Processor
 * Provides offline functionality and model caching
 */

const CACHE_NAME = 'bank-statement-processor-v1';
const MODEL_CACHE_NAME = 'bsp-models-v1';
const STATIC_CACHE_NAME = 'bsp-static-v1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico'
];

// Model files to cache
const MODEL_FILES = [
  '/models/tesseract-core.wasm.js',
  '/models/tesseract-worker.min.js',
  '/models/eng.traineddata.gz'
];

// API endpoints that can work offline
const OFFLINE_FALLBACK_PAGES = [
  '/offline.html'
];

/**
 * Install event - cache static assets and models
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Cache model files
      caches.open(MODEL_CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching model files');
        return cache.addAll(MODEL_FILES.map(url => new Request(url, { mode: 'no-cors' })));
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      // Force activation of new service worker
      return self.skipWaiting();
    }).catch((error) => {
      console.error('Service Worker: Installation failed', error);
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== CACHE_NAME && 
              cacheName !== MODEL_CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - serve cached content when offline
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method === 'GET') {
    // Handle static assets
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset))) {
      event.respondWith(handleStaticAsset(request));
    }
    // Handle model files
    else if (MODEL_FILES.some(model => url.pathname.includes(model))) {
      event.respondWith(handleModelFile(request));
    }
    // Handle API requests
    else if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleApiRequest(request));
    }
    // Handle navigation requests
    else if (request.mode === 'navigate') {
      event.respondWith(handleNavigation(request));
    }
    // Handle other requests with network-first strategy
    else {
      event.respondWith(handleOtherRequests(request));
    }
  }
});

/**
 * Handle static asset requests - cache first strategy
 */
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Static asset fetch failed', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

/**
 * Handle model file requests - cache first strategy with long-term caching
 */
async function handleModelFile(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('Service Worker: Serving model from cache', request.url);
      return cachedResponse;
    }

    console.log('Service Worker: Downloading model', request.url);
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(MODEL_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      
      // Notify main thread about model download progress
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'MODEL_DOWNLOADED',
            url: request.url,
            timestamp: Date.now()
          });
        });
      });
    }
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Model fetch failed', error);
    
    // Notify main thread about offline model unavailability
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'MODEL_UNAVAILABLE',
          url: request.url,
          error: error.message
        });
      });
    });
    
    return new Response('Model not available offline', { status: 503 });
  }
}

/**
 * Handle API requests - network first with offline fallback
 */
async function handleApiRequest(request) {
  try {
    // Try network first for API requests
    const networkResponse = await fetch(request);
    
    // Cache successful responses for offline access
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: API request failed, trying cache', request.url);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add offline indicator header
      const response = cachedResponse.clone();
      response.headers.set('X-Served-From', 'cache');
      return response;
    }
    
    // Return offline response for specific endpoints
    return handleOfflineApiRequest(request);
  }
}

/**
 * Handle offline API requests with appropriate responses
 */
function handleOfflineApiRequest(request) {
  const url = new URL(request.url);
  
  // Return appropriate offline responses based on endpoint
  if (url.pathname.includes('/classify')) {
    return new Response(JSON.stringify({
      error: 'Classification service unavailable offline',
      fallback: true,
      message: 'Using rule-based classification only'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname.includes('/extract')) {
    return new Response(JSON.stringify({
      error: 'Extraction service limited offline',
      fallback: true,
      message: 'OCR may not be available'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    error: 'Service unavailable offline',
    offline: true
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle navigation requests
 */
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Serve cached main page or offline page
    const cachedResponse = await caches.match('/');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Serve offline fallback page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
    
    return new Response('Application unavailable offline', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Handle other requests with network-first strategy
 */
async function handleOtherRequests(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Resource not available offline', { status: 503 });
  }
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_MODEL':
      cacheModel(data.url).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch((error) => {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearCache(data.cacheName).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch((error) => {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then((status) => {
        event.ports[0].postMessage({ success: true, data: status });
      }).catch((error) => {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
      break;
      
    default:
      console.log('Service Worker: Unknown message type', type);
  }
});

/**
 * Cache a specific model file
 */
async function cacheModel(url) {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const response = await fetch(url);
  if (response.ok) {
    await cache.put(url, response);
    console.log('Service Worker: Model cached', url);
  } else {
    throw new Error(`Failed to cache model: ${response.status}`);
  }
}

/**
 * Clear specific cache
 */
async function clearCache(cacheName) {
  const deleted = await caches.delete(cacheName);
  console.log('Service Worker: Cache cleared', cacheName, deleted);
  return deleted;
}

/**
 * Get cache status information
 */
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    status[cacheName] = {
      size: keys.length,
      urls: keys.map(request => request.url)
    };
  }
  
  return status;
}

/**
 * Background sync for when connection is restored
 */
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'model-update') {
    event.waitUntil(updateModels());
  }
  
  if (event.tag === 'data-sync') {
    event.waitUntil(syncOfflineData());
  }
});

/**
 * Update models when connection is restored
 */
async function updateModels() {
  try {
    console.log('Service Worker: Updating models...');
    
    for (const modelUrl of MODEL_FILES) {
      try {
        const response = await fetch(modelUrl);
        if (response.ok) {
          const cache = await caches.open(MODEL_CACHE_NAME);
          await cache.put(modelUrl, response);
          console.log('Service Worker: Model updated', modelUrl);
        }
      } catch (error) {
        console.warn('Service Worker: Failed to update model', modelUrl, error);
      }
    }
    
    // Notify main thread about model updates
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'MODELS_UPDATED',
          timestamp: Date.now()
        });
      });
    });
  } catch (error) {
    console.error('Service Worker: Model update failed', error);
  }
}

/**
 * Sync offline data when connection is restored
 */
async function syncOfflineData() {
  try {
    console.log('Service Worker: Syncing offline data...');
    
    // Notify main thread to handle data synchronization
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_OFFLINE_DATA',
          timestamp: Date.now()
        });
      });
    });
  } catch (error) {
    console.error('Service Worker: Data sync failed', error);
  }
}