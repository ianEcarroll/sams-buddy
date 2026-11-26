// Caches the app shells only (the learner's app and the team app). Data and audio always come from the network.
const CACHE = 'buddy-shell-v19';
const SHELL = ['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/favicon-64.png', '/icons/icon-192.png', '/icons/apple-touch-icon.png', '/img/talvo-fox.jpg',
  '/autoupdate.js', '/fonts/fonts.css', '/fonts/lexend-latin-400-normal.woff2', '/fonts/lexend-latin-600-normal.woff2', '/fonts/lexend-latin-700-normal.woff2', '/adult/', '/adult/adult.js', '/adult/manifest.webmanifest', '/icons/team/icon.svg', '/icons/team/icon-192.png', '/icons/team/apple-touch-icon.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Video is streamed in ranges (Safari asks that way): leave it to the network.
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin || e.request.headers.has('range') || url.pathname.endsWith('.mp4')) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? caches.match(url.pathname.startsWith('/adult') ? '/adult/' : '/offline.html') : Response.error())));
});

// Practice reminders sent by the server (web push).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'TALVO', {
    body: d.body || 'Time to practise with Foxy.', icon: '/icons/icon-192.png', badge: '/icons/maskable-192.png', tag: 'buddy-reminder', data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const open = cs.find((c) => new URL(c.url).origin === location.origin);
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
