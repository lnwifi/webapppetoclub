// Service Worker para PetoClub Web
// Versión: 1.0.0

const CACHE_NAME = 'petoclub-v1';
const STATIC_CACHE = 'petoclub-static-v1';
const DYNAMIC_CACHE = 'petoclub-dynamic-v1';

// Archivos a cachear inmediatamente
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  // Agrega aquí otros assets estáticos críticos
];

// Patrones de URLs para cachear dinámicamente
const CACHE_PATTERNS = {
  images: /\.(png|jpg|jpeg|gif|svg|webp)$/i,
  fonts: /\.(woff|woff2|ttf|eot)$/i,
  api: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
  storage: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\//
};

// Estrategias de cache
const STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Configuración por tipo de recurso
const RESOURCE_CONFIG = {
  html: { strategy: STRATEGIES.NETWORK_FIRST, cache: DYNAMIC_CACHE },
  css: { strategy: STRATEGIES.CACHE_FIRST, cache: STATIC_CACHE },
  js: { strategy: STRATEGIES.CACHE_FIRST, cache: STATIC_CACHE },
  images: { strategy: STRATEGIES.CACHE_FIRST, cache: STATIC_CACHE },
  api: { strategy: STRATEGIES.NETWORK_FIRST, cache: DYNAMIC_CACHE },
  storage: { strategy: STRATEGIES.CACHE_FIRST, cache: STATIC_CACHE }
};

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Install');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Error caching static assets', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activate');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Eliminar caches antiguas
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Old caches cleaned');
        return self.clients.claim();
      })
  );
});

// Interceptar fetch requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo procesar requests HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Determinar estrategia de cache
  const config = getResourceConfig(request);
  
  if (config) {
    event.respondWith(handleRequest(request, config));
  }
});

// Determinar configuración de cache para un request
function getResourceConfig(request) {
  const url = request.url;
  
  // API requests
  if (CACHE_PATTERNS.api.test(url)) {
    return RESOURCE_CONFIG.api;
  }
  
  // Storage/Images
  if (CACHE_PATTERNS.storage.test(url) || CACHE_PATTERNS.images.test(url)) {
    return RESOURCE_CONFIG.storage;
  }
  
  // Static assets
  if (CACHE_PATTERNS.fonts.test(url)) {
    return RESOURCE_CONFIG.css;
  }
  
  // HTML pages
  if (request.headers.get('accept')?.includes('text/html')) {
    return RESOURCE_CONFIG.html;
  }
  
  // CSS/JS
  if (url.includes('.css')) {
    return RESOURCE_CONFIG.css;
  }
  
  if (url.includes('.js')) {
    return RESOURCE_CONFIG.js;
  }
  
  return null;
}

// Manejar request según estrategia
async function handleRequest(request, config) {
  const { strategy, cache: cacheName } = config;
  
  switch (strategy) {
    case STRATEGIES.CACHE_FIRST:
      return cacheFirst(request, cacheName);
    
    case STRATEGIES.NETWORK_FIRST:
      return networkFirst(request, cacheName);
    
    case STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request, cacheName);
    
    default:
      return fetch(request);
  }
}

// Estrategia Cache First
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    // Solo cachear responses exitosas
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache first error', error);
    return new Response('Offline - Content not available', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Estrategia Network First
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache', error);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline - Content not available', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Estrategia Stale While Revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Actualizar cache en background
  const networkResponsePromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  
  // Retornar cached response inmediatamente si existe
  return cachedResponse || networkResponsePromise;
}

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    
    case 'GET_CACHE_SIZE':
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      });
      break;
    
    case 'CLEAR_CACHE':
      clearCache(payload?.cacheName).then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
  }
});

// Obtener tamaño del cache
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return totalSize;
}

// Limpiar cache
async function clearCache(cacheName) {
  if (cacheName) {
    return caches.delete(cacheName);
  } else {
    const cacheNames = await caches.keys();
    return Promise.all(cacheNames.map(name => caches.delete(name)));
  }
}

// Background Sync (opcional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implementar sincronización de datos cuando se recupere la conexión
  console.log('🔄 Service Worker: Background sync');
}

// Push notifications (opcional)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const { title, body, icon, badge, tag } = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-192x192.png',
      tag,
      requireInteraction: true
    })
  );
});

console.log('✅ Service Worker: Loaded and ready');