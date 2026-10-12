// Offline cache for Wordsy. Bump CACHE whenever any listed file changes
// (for example after adding words), so phones pick up the new version.
const CACHE = 'wordsy-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './fonts/fonts.css',
  './fonts/ibm-plex-mono-normal-latin-ext.woff2',
  './fonts/ibm-plex-mono-normal-latin.woff2',
  './fonts/ibm-plex-sans-normal-latin-ext.woff2',
  './fonts/ibm-plex-sans-normal-latin.woff2',
  './fonts/newsreader-italic-latin-ext.woff2',
  './fonts/newsreader-italic-latin.woff2',
  './fonts/newsreader-normal-latin-ext.woff2',
  './fonts/newsreader-normal-latin.woff2',
  './js/app.js',
  './js/engine.js',
  './js/store.js',
  './js/fit.js',
  './data/words.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache first, network as fallback. ignoreSearch so '?now=' test URLs still hit the cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
