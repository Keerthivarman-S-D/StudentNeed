import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

let messagingInstance: any = null;

export async function getFCMInstance() {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  if (!messagingInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export const isFcmSupported = isPushSupported;


export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return await Notification.requestPermission();
}

export async function subscribeToFCM(vapidPublicKey?: string): Promise<string | null> {
  try {
    if (!isPushSupported()) return null;

    const permission = await requestPushPermission();
    if (permission !== 'granted') return null;

    // Register service worker with scope /
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.warn('FCM service worker fallback to /sw.js:', swErr);
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    }

    const messaging = await getFCMInstance();
    if (!messaging) return null;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: reg,
      vapidKey: vapidPublicKey || undefined,
    });

    return token || null;
  } catch (err) {
    console.warn('FCM registration notice:', err);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (typeof window === 'undefined') return null;

  let unsub: (() => void) | null = null;
  getFCMInstance().then((messaging) => {
    if (messaging) {
      unsub = onMessage(messaging, (payload) => {
        callback(payload);
      });
    }
  }).catch(() => {});

  return () => {
    if (unsub) unsub();
  };
}
