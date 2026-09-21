// StudentNeed Production Service Worker for Web Push Notifications
// Scope: / (https://studentneed.me)

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for previous workers to stop
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Become available to all active clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'StudentNeed',
      body: event.data.text() || 'New campus update.',
    };
  }

  const title = payload.title || 'StudentNeed';
  const data = payload.data || {};
  const targetChatId = data.chatId;

  // Foreground suppression:
  // If the user already has StudentNeed open, focused, and is viewing the EXACT conversation,
  // do not produce a redundant OS-level notification banner.
  const checkActiveClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      if (targetChatId && clientList.length > 0) {
        const isViewingExactChat = clientList.some((client) => {
          return (
            client.focused &&
            client.visibilityState === 'visible' &&
            client.url.includes(`/chat/${targetChatId}`)
          );
        });

        if (isViewingExactChat) {
          // Message is already rendered live in the active conversation view.
          return;
        }
      }

      const options = {
        body: payload.body || 'You received a new campus notification.',
        icon: payload.icon || '/studentneed-monogram.png',
        badge: payload.badge || '/favicon.png',
        tag: payload.tag || (targetChatId ? `chat_${targetChatId}` : 'studentneed_notification'),
        renotify: true,
        data: {
          url: data.url || (targetChatId ? `/chat/${targetChatId}` : '/'),
          chatId: targetChatId,
          timestamp: Date.now(),
        },
        vibrate: [120, 60, 120],
      };

      return self.registration.showNotification(title, options);
    });

  event.waitUntil(checkActiveClients);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  const navigateToClient = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // 1. If a StudentNeed tab is already open, focus it and navigate to target URL
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }

      // 2. Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    });

  event.waitUntil(navigateToClient);
});
