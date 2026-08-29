/* Jelly Studio service worker — push notifications only (2026-08-28).
 *
 * No caching, no offline, no workbox. Two jobs:
 *   push              → show the notification the server sent
 *   notificationclick → focus an open /animate tab (and deep-link it) or
 *                       open a new one at the notification's url
 *
 * Payload shape (lib/vater/push.ts sendPushToUser): { title, body, url }.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Jelly Studio', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Jelly Studio';
  const options = {
    body: data.body || '',
    icon: '/animate/brand/logo-512.png',
    badge: '/animate/brand/logo-512.png',
    tag: data.tag || data.url || 'jelly',
    renotify: true,
    data: { url: data.url || '/animate' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/animate';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        try {
          const u = new URL(client.url);
          if (u.pathname.startsWith('/animate') && 'focus' in client) {
            if ('navigate' in client) {
              return client.navigate(url).then((c) => (c || client).focus());
            }
            return client.focus();
          }
        } catch {
          /* ignore malformed client urls */
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
