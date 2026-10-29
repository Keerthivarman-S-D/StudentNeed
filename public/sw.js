// StudentNeed Service Worker Proxy
// Delegates directly to canonical /firebase-messaging-sw.js to eliminate competing service worker registrations
importScripts('/firebase-messaging-sw.js');
