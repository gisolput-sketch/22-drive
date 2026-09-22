const CACHE = '22-drive-push-v6';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {body: event.data ? event.data.text() : ""};
  }

  const title = data.title || "🚨 Nova viagem — 22 DRIVE";
  const options = {
    body: data.body || "Há uma nova solicitação de viagem.",
    icon: data.icon || "./icon-192.svg",
    badge: data.badge || "./icon-192.svg",
    tag: data.tag || ("22drive-new-ride-" + Date.now()),
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300,120,300,120,700],
    timestamp: Date.now(),
    data: {url: data.url || "./motorista.html"}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "./motorista.html",
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({type:"window", includeUncontrolled:true}).then(list => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
