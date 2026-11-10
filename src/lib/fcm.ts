import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

let messagingInstance: any = null;
let messagingPromise: Promise<any> | null = null;

export async function getFCMInstance() {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;
  if (messagingPromise) return messagingPromise;

  messagingPromise = (async () => {
    try {
      const supported = await isSupported().catch(() => false);
      if (!supported) return null;

      const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      messagingInstance = getMessaging(app);
      return messagingInstance;
    } catch (err) {
      console.debug('[FCM] Messaging instance initialization skipped or unsupported:', err);
      return null;
    } finally {
      messagingPromise = null;
    }
  })();

  return messagingPromise;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export const isFcmSupported = isPushSupported;

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isPushServiceError(err: any): boolean {
  if (!err) return false;
  const name = err.name || '';
  const msg = String(err.message || err);
  return (
    name === 'AbortError' ||
    msg.includes('push service error') ||
    msg.includes('Registration failed') ||
    msg.includes('Push service error')
  );
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return await Notification.requestPermission();
}

async function getOrRegisterMessagingSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    // 1. Check if an active service worker is already registered for root scope
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing && existing.active) {
      return existing;
    }

    // 2. Register canonical service worker under root scope
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    } catch (swErr) {
      // Fallback to proxy service worker if direct script registration fails
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.debug('[FCM] Service worker registration notice:', err);
    return null;
  }
}

export async function subscribeToFCM(vapidPublicKey?: string): Promise<string | null> {
  try {
    if (!isPushSupported()) return null;

    // Push notifications are strictly optional. Never prompt for permission automatically.
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return null;
    }

    const reg = await getOrRegisterMessagingSW();
    if (!reg) return null;

    const messaging = await getFCMInstance();
    if (!messaging) return null;

    // Resolve VAPID key priority: parameter -> Vite build environment variable
    const envVapidKey =
      ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_FIREBASE_VAPID_KEY) as string)?.trim() ||
      ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_VAPID_PUBLIC_KEY) as string)?.trim();
    const effectiveVapidKey = vapidPublicKey?.trim() || envVapidKey || undefined;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: reg,
      vapidKey: effectiveVapidKey,
    });

    return token || null;
  } catch (err: any) {
    if (isPushServiceError(err)) {
      // Push service is disabled in private/incognito mode or blocked by browser/network.
      // Log as diagnostic debug info to avoid alarming console errors.
      console.debug('[FCM] Push service unavailable in current browser session (Incognito/private mode or push service disabled):', err?.message);
    } else {
      console.warn('FCM registration notice:', err);
    }
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (typeof window === 'undefined') return null;

  let isDisposed = false;
  let unsub: (() => void) | null = null;

  getFCMInstance().then((messaging) => {
    if (messaging && !isDisposed) {
      unsub = onMessage(messaging, (payload) => {
        callback(payload);
      });
    }
  }).catch(() => {});

  return () => {
    isDisposed = true;
    if (unsub) unsub();
  };
}
