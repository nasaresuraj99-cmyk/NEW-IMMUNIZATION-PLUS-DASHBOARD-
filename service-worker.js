/**
 * Immunization Tracker PWA - Service Worker
 * IA2030 Compliant Offline-First Application
 */

const CACHE_NAME = 'immunization-tracker-v1.0.0';
const OFFLINE_CACHE = 'immunization-tracker-offline';
const DATA_CACHE = 'immunization-tracker-data';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/firebase-config.js',
    
    // Icons
    '/assets/icons/icon-72x72.png',
    '/assets/icons/icon-96x96.png',
    '/assets/icons/icon-128x128.png',
    '/assets/icons/icon-144x144.png',
    '/assets/icons/icon-152x152.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-384x384.png',
    '/assets/icons/icon-512x512.png',
    
    // Fonts
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap',
    
    // External libraries
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// Install Event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Install completed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Install failed:', error);
            })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    // Clean up old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== OFFLINE_CACHE && 
                        cacheName !== DATA_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('[Service Worker] Activation completed');
            return self.clients.claim();
        })
    );
});

// Fetch Event - Network First with Cache Fallback
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Handle API requests
    if (requestUrl.pathname.startsWith('/api/') || 
        requestUrl.hostname.includes('firebase')) {
        handleApiRequest(event);
        return;
    }
    
    // Handle static assets
    handleStaticAssetRequest(event);
});

// Handle API requests with Background Sync
function handleApiRequest(event) {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful API responses
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(DATA_CACHE)
                        .then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                }
                return response;
            })
            .catch(() => {
                // Return cached response if offline
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        
                        // Return offline placeholder for specific endpoints
                        if (event.request.url.includes('/children')) {
                            return new Response(JSON.stringify({
                                message: 'Offline mode: Data will sync when online'
                            }), {
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                        
                        throw new Error('No cached data available');
                    });
            })
    );
}

// Handle static asset requests
function handleStaticAssetRequest(event) {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if available
                if (cachedResponse) {
                    // Update cache in background
                    fetchAndCache(event.request);
                    return cachedResponse;
                }
                
                // Fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Cache the response
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/');
                        }
                        
                        // Return placeholder for other assets
                        return new Response('Offline - Please check your connection', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
}

// Background Sync for offline data
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);
    
    if (event.tag === 'sync-offline-data') {
        event.waitUntil(syncOfflineData());
    }
    
    if (event.tag === 'sync-audit-logs') {
        event.waitUntil(syncAuditLogs());
    }
});

// Sync offline data when coming online
async function syncOfflineData() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const cache = await caches.open(OFFLINE_CACHE);
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    // Data synced successfully, remove from cache
                    await cache.delete(request);
                }
            } catch (error) {
                console.error('[Service Worker] Sync failed for:', request.url, error);
            }
        }
        
        console.log('[Service Worker] Offline data sync completed');
    } catch (error) {
        console.error('[Service Worker] Sync error:', error);
    }
}

// Sync audit logs
async function syncAuditLogs() {
    // Implementation for syncing audit logs
    // This would sync locally stored logs to the server
    console.log('[Service Worker] Syncing audit logs...');
}

// Push notifications for reminders
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body || 'Immunization reminder',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        tag: data.tag || 'immunization-reminder',
        data: data.data || {},
        actions: [
            {
                action: 'view',
                title: 'View Details'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Immunization Tracker', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
        // Open the app to relevant screen
        const urlToOpen = new URL('/', self.location.origin).href;
        
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// Helper function to fetch and cache
function fetchAndCache(request) {
    return fetch(request)
        .then((response) => {
            if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(request, responseClone);
                    });
            }
            return response;
        })
        .catch(() => {
            // Silently fail for background updates
            console.log('[Service Worker] Background update failed for:', request.url);
        });
}

// Periodic sync for background updates
if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('vaccine-sync', {
        minInterval: 24 * 60 * 60 * 1000 // Once per day
    }).then(() => {
        console.log('[Service Worker] Periodic sync registered');
    }).catch((error) => {
        console.error('[Service Worker] Periodic sync registration failed:', error);
    });
}

// Message handler for communication with app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_DATA') {
        cacheData(event.data.payload);
    }
});

// Cache data for offline use
async function cacheData(payload) {
    const cache = await caches.open(DATA_CACHE);
    
    // Cache children data
    if (payload.children) {
        const url = new URL('/api/children', self.location.origin);
        const response = new Response(JSON.stringify(payload.children), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(url, response);
    }
    
    // Cache vaccine schedule
    if (payload.schedule) {
        const url = new URL('/api/schedule', self.location.origin);
        const response = new Response(JSON.stringify(payload.schedule), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(url, response);
    }
    
    console.log('[Service Worker] Data cached for offline use');
}

// Health check endpoint
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('/health')) {
        event.respondWith(
            new Response(JSON.stringify({
                status: 'healthy',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            }), {
                headers: { 'Content-Type': 'application/json' }
            })
        );
    }
});