/* Al-Moudira Transfers — Service Worker
   Auto-update: network-first for the app, cache fallback when offline.
   __BUILD__ is replaced on every GitHub deploy, so each push installs a fresh worker. */
const BUILD = '__BUILD__';
const CACHE = 'amt-' + BUILD;
const FONTS = 'amt-fonts';
const CORE = ['./', './index.html', './manifest.webmanifest', './sync-config.js',
  './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png'];

self.addEventListener('install', e => {
  self.skipWaiting();                                   // activate new version immediately
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u =>
    fetch(u, { cache: 'no-store' }).then(r => r.ok && c.put(u, r)).catch(() => {})))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); }

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {           // fonts: cache, refresh in background
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(                                                          // app files: always try the latest from GitHub
    withTimeout(fetch(req, { cache: 'no-store' }), 5000)
      .then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(key, cp)); } return r; })
      .catch(async () => (await caches.match(key)) || (await caches.match('./index.html')) || Response.error())
  );
});
