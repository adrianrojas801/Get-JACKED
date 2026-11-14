// Service worker: keeps the app's own files on the phone so Get Jacked opens with no signal.
// Your data is not cached here. index.html keeps its own copy (see "offline copy" there).
// Bump CACHE when the list of files changes.
const CACHE = 'gj-shell-v1';
const SHELL = ['./', 'config.js', 'vendor/supabase.js', 'manifest.webmanifest', 'icons/icon-192.png?v=2', 'icons/apple-touch-icon.png?v=2'];
const WAIT_MS = 3500; // on a weak signal, stop waiting for the network and open the saved copy

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first, so a new deploy shows up right away; the saved copy is the fallback.
// Only this site's own GET requests are handled. Supabase calls always go straight to the network.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(req) || (req.mode === 'navigate' ? await cache.match('./') : undefined);
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
    if (!saved) return fresh;
    fresh.catch(() => {});
    const late = new Promise(resolve => setTimeout(() => resolve(saved), WAIT_MS));
    return Promise.race([fresh.catch(() => saved), late]);
  })());
});
