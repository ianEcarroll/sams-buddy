// Caches the app shells only (the learner's app and the team app). Data and audio always come from the network.
const CACHE = 'buddy-shell-v6';
const SHELL = ['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/favicon-64.png', '/icons/icon-192.png', '/icons/apple-touch-icon.png', '/img/talvo-fox.webp', '/img/talvo-fox.jpg',
  '/adult/', '/adult/adult.js', '/adult/manifest.webmanifest', '/icons/team/icon.svg', '/icons/team/icon-192.png', '/icons/team/apple-touch-icon.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? caches.match(url.pathname.startsWith('/adult') ? '/adult/' : '/offline.html') : Response.error())));
});

// Practice reminders sent by the server (web push).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Buddy', {
    body: d.body || 'Time to practise with Buddy.', icon: '/icons/icon-192.png', badge: '/icons/maskable-192.png', tag: 'buddy-reminder', data: { url: d.url || '/' },
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
