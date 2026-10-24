// TrackmySubs Background Service Worker
// Enables 100% free background notifications, lock-screen chimes, and PWA capabilities
// Fires even when the browser tab is closed and mobile screen is locked/off!

const SW_VERSION = 'trackmysubs-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Show native notification with sound and vibration
function displayNotification(title, options = {}) {
  const defaultOptions = {
    body: 'A subscription is due for renewal tomorrow! Check your billing details.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [300, 100, 300, 100, 300],
    sound: '/sounds/renewal-chime.wav',
    silent: false,
    requireInteraction: true,
    tag: 'trackmysubs-1day-renewal-alert',
    renotify: true,
    data: {
      url: '/calendar',
    },
    actions: [
      { action: 'open', title: 'Open Hub 📅' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  const merged = Object.assign({}, defaultOptions, options);
  return self.registration.showNotification(title, merged);
}

// Listen to push events (from Web Push servers or background sync)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : undefined };
  }

  const title = data.title || '🔔 TrackmySubs: 1-Day Prior Renewal Alert!';
  event.waitUntil(displayNotification(title, data));
});

// Handle clicking on notification from outside the browser
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/calendar';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Listen to messages from webpage: immediate or delayed background notifications
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(displayNotification(event.data.title, event.data.options));
  } else if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const delayMs = event.data.delayMs || 10000;
    setTimeout(() => {
      displayNotification(event.data.title, event.data.options);
    }, delayMs);
  }
});
