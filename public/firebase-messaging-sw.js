// StudentNeed Firebase Cloud Messaging Service Worker
// Scope: / (https://studentneed.me)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCqWr4KWAldqh2K64jGmMAIByeZl1q9bwg",
  projectId: "kv-adk-26",
  messagingSenderId: "322826067438",
  appId: "1:322826067438:web:90ea39287998bc57a302ff"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'StudentNeed';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New campus update.',
    icon: payload.notification?.icon || payload.data?.icon || '/studentneed-monogram.png',
    badge: '/favicon.png',
    tag: payload.data?.tag || 'studentneed_fcm',
    data: {
      url: payload.data?.url || payload.data?.link || '/',
      targetType: payload.data?.targetType,
      targetId: payload.data?.targetId,
      timestamp: Date.now()
    },
    vibrate: [120, 60, 120]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Direct Web Push fallback
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    // If it's already an FCM payload, onBackgroundMessage will process it
    if (payload.fcmOptions || payload.notification) return;

    const title = payload.title || 'StudentNeed';
    const options = {
      body: payload.body || 'New campus update.',
      icon: payload.icon || '/studentneed-monogram.png',
      badge: '/favicon.png',
      tag: payload.tag || 'studentneed_push',
      data: payload.data || { url: payload.url || '/' },
      vibrate: [120, 60, 120]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Non-JSON push payload
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('StudentNeed', {
        body: text || 'New campus update.',
        icon: '/studentneed-monogram.png',
        badge: '/favicon.png'
      })
    );
  }
});

// Notification click navigation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || event.notification.data?.link || '/';

  const navigateToClient = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    });

  event.waitUntil(navigateToClient);
});
