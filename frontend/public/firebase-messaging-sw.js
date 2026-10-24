// Firebase Cloud Messaging Background Service Worker
// Enables push notifications & sound even when website or app is completely closed

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const defaultConfig = {
  apiKey: "AIzaSyDummyKeyForFCMSetupTrackmySubs",
  authDomain: "trackmysubs-notifications.firebaseapp.com",
  projectId: "trackmysubs-notifications",
  storageBucket: "trackmysubs-notifications.appspot.com",
  messagingSenderId: "109876543210",
  appId: "1:109876543210:web:abcdef123456"
};

let firebaseConfig = defaultConfig;
try {
  const urlParams = new URL(location).searchParams;
  const configParam = urlParams.get('config');
  if (configParam) {
    firebaseConfig = Object.assign({}, defaultConfig, JSON.parse(decodeURIComponent(configParam)));
  }
} catch {
  // Use defaultConfig
}

if (!firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('FCM SW Init note:', err);
  }
}

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.warn('FCM Messaging in SW note:', e);
}

if (messaging) {
  // Handle background messages received when tab/app is closed
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || '🔔 TrackmySubs: Renewal Day Alert!';
    const options = {
      body: payload.notification?.body || payload.data?.body || 'A household subscription is renewing! Check your payment method.',
      icon: payload.notification?.icon || payload.data?.icon || '/file.svg',
      badge: '/file.svg',
      sound: '/sounds/renewal-chime.wav',
      silent: false,
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      tag: 'trackmysubs-renewal-alert',
      renotify: true,
      data: {
        url: payload.data?.url || '/calendar'
      },
      actions: [
        { action: 'open', title: 'Open TrackmySubs 📅' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    return self.registration.showNotification(title, options);
  });
}

// Handle notification click when user taps notification from lock screen / desktop
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

