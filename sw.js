/* سينماتيك حمد — service worker */
const V = 'cin-v1';
const SHELL = ['./', 'index.html', 'css/app.css?v=1', 'lib/xlsx.full.min.js', 'js/parser.js?v=1', 'js/store.js?v=1', 'js/meta.js?v=1',
  'js/app.js?v=1', 'js/details.js?v=1', 'js/tools.js?v=1', 'js/game.js?v=1', 'manifest.json', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'cin-img').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // posters & photos: cache-first so they work offline
  if (u.hostname === 'image.tmdb.org' || u.hostname.endsWith('media-amazon.com')) {
    e.respondWith(caches.open('cin-img').then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      try { const r = await fetch(u.href, { mode: 'cors' }); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch (err) { try { return await fetch(e.request); } catch (e2) { return Response.error(); } }
    }));
    return;
  }
  if (u.origin === location.origin) {
    // app files: network first (so updates arrive), fall back to cache offline
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
  }
});
