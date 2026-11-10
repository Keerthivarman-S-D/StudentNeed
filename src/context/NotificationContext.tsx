import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  updateDoc,
  writeBatch,
  setDoc,
  serverTimestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';
import {
  isPushSupported,
  isIOS,
  isStandalonePWA,
  requestPushPermission,
  subscribeToFCM,
  onForegroundMessage,
  isPushServiceError,
} from '../lib/fcm';
import { NOTIFICATION_ENDPOINTS } from '../config/api';

export interface ToastNotification {
  id: string;
  title: string;
  body: string;
  link?: string;
  targetType?: string;
  targetId?: string;
  eventId?: string;
  chatId?: string;
  messageId?: string;
  notificationId?: string;
  requestId?: string;
  reservationId?: string;
  fcmMessageId?: string;
}

export function getStableNotificationKey(item: any): string {
  if (!item) return '';

  // 1. Explicit stable event ID (e.g. chat_chat123_msg456, res_created_res123)
  if (item.eventId && typeof item.eventId === 'string') {
    return item.eventId.trim();
  }
  if (item.data?.eventId && typeof item.data.eventId === 'string') {
    return item.data.eventId.trim();
  }

  // 2. Chat message key: chatId + messageId (uniquely identifies a specific chat message)
  const chatId = item.chatId || item.metadata?.chatId || item.data?.chatId;
  const messageId = item.messageId || item.metadata?.messageId || item.data?.messageId;
  if (chatId && messageId) {
    return `chat_${chatId}_${messageId}`;
  }

  // 3. Deterministic notification document ID (e.g. notif_chat_msg456_user789, notif_res_created_res123_seller456)
  if (item.notificationId && typeof item.notificationId === 'string') {
    return item.notificationId.trim();
  }
  if (item.data?.notificationId && typeof item.data.notificationId === 'string') {
    return item.data.notificationId.trim();
  }

  // 4. Firestore document ID (when distinct and not a synthetic client prefix like fcm_12345)
  if (item.id && typeof item.id === 'string' && !item.id.startsWith('fcm_')) {
    return item.id.trim();
  }

  // 5. Unique FCM Message ID
  if (item.fcmMessageId && typeof item.fcmMessageId === 'string') {
    return item.fcmMessageId.trim();
  }

  // NOTE: Do not fall back to bare targetType + targetId as a deduplication key!
  // Doing so would incorrectly suppress subsequent distinct messages or reservation updates for the same conversation.
  return '';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array | null {
  if (!base64String || typeof base64String !== 'string') return null;
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch {
    return null;
  }
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadTotal: number;
  chatUnreadCounts: Record<string, number>;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  isPushRegisteredOnServer: boolean;
  permissionStatus: NotificationPermission | 'unsupported';
  isLoading: boolean;
  hasMore: boolean;
  activeToast: ToastNotification | null;
  dismissToast: () => void;
  showToast: (toast: ToastNotification) => void;
  loadMore: () => Promise<void>;
  toggleSound: () => void;
  toggleBrowserNotifications: () => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function toMillis(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val.seconds !== undefined) return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

function toIsoString(val: any): string {
  const ms = toMillis(val);
  return ms > 0 ? new Date(ms).toISOString() : new Date().toISOString();
}

// Programmatic Web Audio API melodic 2-tone chime
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Tone 2: 880.00 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.07);
    gain2.gain.setValueAtTime(0, now + 0.07);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.28);

    setTimeout(() => {
      try {
        ctx.close().catch(() => {});
      } catch {}
    }, 500);
  } catch {}
}

const PAGE_SIZE = 20;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [chatUnreadCounts, setChatUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

  // User sound & browser notification preferences
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sn_notification_sound');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sn_browser_notifications') === 'true';
    } catch {
      return false;
    }
  });

  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Live status of device registration on the backend (separated from persistent user intent)
  const [isPushRegisteredOnServer, setIsPushRegisteredOnServer] = useState<boolean>(false);

  // Sync preference changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sn_notification_sound', String(soundEnabled));
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('sn_browser_notifications', String(browserNotificationsEnabled));
    } catch {}
  }, [browserNotificationsEnabled]);

  const [activeToast, setActiveToast] = useState<ToastNotification | null>(null);
  const toastTimerRef = useRef<any>(null);
  // Bounded map storing eventKey => timestamp (max 500 entries, 5-minute deduplication window)
  const seenForegroundEventKeysRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  const showToast = useCallback((toast: ToastNotification, playSound = false) => {
    const stableKey = getStableNotificationKey(toast);
    const now = Date.now();

    if (stableKey) {
      const lastSeen = seenForegroundEventKeysRef.current.get(stableKey);
      if (lastSeen && (now - lastSeen < 5 * 60 * 1000)) {
        // Event already notified to user in foreground (either via Firestore listener or FCM onMessage)
        return;
      }

      // Record event in bounded cache
      seenForegroundEventKeysRef.current.set(stableKey, now);

      // Keep cache strictly bounded: purge expired entries or oldest if size > 500
      if (seenForegroundEventKeysRef.current.size > 500) {
        for (const [key, ts] of seenForegroundEventKeysRef.current.entries()) {
          if (now - ts > 5 * 60 * 1000) {
            seenForegroundEventKeysRef.current.delete(key);
          }
        }
        if (seenForegroundEventKeysRef.current.size > 500) {
          for (const key of seenForegroundEventKeysRef.current.keys()) {
            seenForegroundEventKeysRef.current.delete(key);
            if (seenForegroundEventKeysRef.current.size <= 500) break;
          }
        }
      }
    }

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setActiveToast(toast);
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
      toastTimerRef.current = null;
    }, 6000);

    if (playSound && soundEnabled) {
      playNotificationChime();
    }
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  // Helper to sync and register FCM and Web Push tokens independently with backend
  const syncPushRegistration = useCallback(async (vapidKeyParam?: string): Promise<{
    fcmToken: string | null;
    fcmSuccess: boolean;
    webPushSuccess: boolean;
    success: boolean;
    pushServiceAvailable: boolean;
  }> => {
    let fcmToken: string | null = null;
    let fcmSuccess = false;
    let webPushSuccess = false;
    let pushServiceAvailable = true;

    if (!isPushSupported() || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return { fcmToken: null, fcmSuccess: false, webPushSuccess: false, success: false, pushServiceAvailable: false };
    }

    try {
      // 1. Resolve VAPID key
      let vapidPublicKey =
        vapidKeyParam?.trim() ||
        ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_FIREBASE_VAPID_KEY) as string)?.trim() ||
        ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_VAPID_PUBLIC_KEY) as string)?.trim() ||
        '';

      if (!vapidPublicKey) {
        try {
          const vapidRes = await fetch(NOTIFICATION_ENDPOINTS.vapidPublicKey);
          if (vapidRes.ok) {
            const vapidData = await vapidRes.json();
            vapidPublicKey = vapidData.publicKey || '';
          }
        } catch (vErr) {
          console.debug('VAPID public key fetch notice:', vErr);
        }
      }

      const idToken = await auth.currentUser?.getIdToken();

      // 2. Try FCM token registration independently and check actual HTTP status
      try {
        fcmToken = await subscribeToFCM(vapidPublicKey);
        if (fcmToken && idToken) {
          const fcmRes = await fetch(NOTIFICATION_ENDPOINTS.registerFcm, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ token: fcmToken }),
          }).catch((err) => {
            console.warn('FCM token register network warning:', err);
            return null;
          });

          if (fcmRes && fcmRes.ok) {
            const fcmData = await fcmRes.json().catch(() => ({}));
            // Only count FCM as successful delivery channel if backend confirms delivery credentials (Google ADC) exist
            if (fcmData.deliveryAvailable === false) {
              console.debug('FCM token registered; Web Push fallback remains active if configured.');
              fcmSuccess = false;
            } else {
              fcmSuccess = true;
            }
          } else {
            console.warn(`FCM token registration rejected by server: HTTP ${fcmRes?.status ?? 'error'}`);
          }
        }
      } catch (fcmErr: any) {
        if (isPushServiceError(fcmErr)) {
          pushServiceAvailable = false;
          console.debug('[Push] Browser push service unavailable in current session:', fcmErr?.message);
        } else {
          console.warn('FCM registration notice (non-fatal, Web Push fallback remains active):', fcmErr);
        }
      }

      // 3. Register standard Web Push VAPID subscription ONLY IF:
      // - FCM was not already successfully registered on the server (avoids redundant/competing push subscriptions)
      // - Push service is actually available (avoids duplicate AbortError when push service is blocked or Incognito)
      // - A valid VAPID public key exists
      if (!fcmSuccess && pushServiceAvailable && vapidPublicKey) {
        try {
          const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
          if (appServerKey && 'serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if ('pushManager' in reg) {
              let sub = await reg.pushManager.getSubscription();
              if (!sub) {
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: appServerKey,
                });
              }
              if (idToken && sub) {
                const subRes = await fetch(NOTIFICATION_ENDPOINTS.subscribe, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({ subscription: sub.toJSON() }),
                }).catch(() => null);

                if (subRes && subRes.ok) {
                  webPushSuccess = true;
                } else {
                  console.warn(`Web Push registration rejected by server: HTTP ${subRes?.status ?? 'error'}`);
                }
              }
            }
          }
        } catch (webPushErr: any) {
          if (isPushServiceError(webPushErr)) {
            pushServiceAvailable = false;
            console.debug('[Push] Web Push subscription notice: push service unavailable in this environment.');
          } else {
            console.warn('Web Push subscription notice:', webPushErr);
          }
        }
      }
    } catch (err) {
      console.debug('Push sync notice:', err);
    }

    const success = fcmSuccess || webPushSuccess;
    return { fcmToken, fcmSuccess, webPushSuccess, success, pushServiceAvailable };
  }, []);

  const toggleBrowserNotifications = async () => {
    if (!isPushSupported()) {
      if (isIOS()) {
        alert(
          'Push notifications on iOS Safari require iOS 16.4+ and adding StudentNeed to your Home Screen.\n\nTo enable:\n1. Tap the Share button in Safari (bottom navigation bar)\n2. Select "Add to Home Screen"\n3. Open StudentNeed from your Home Screen to enable alerts.'
        );
      } else {
        alert('Browser push notifications are not supported in this browser or environment.');
      }
      return;
    }

    if (isIOS() && !isStandalonePWA()) {
      alert(
        'To receive notifications on iOS:\n1. Tap the Share button in Safari (bottom toolbar)\n2. Tap "Add to Home Screen"\n3. Open StudentNeed from your Home Screen to enable notifications.'
      );
      return;
    }

    if (browserNotificationsEnabled) {
      // Unsubscribe
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          await fetch(NOTIFICATION_ENDPOINTS.unregisterFcm, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          }).catch(() => {});
        }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          if (idToken) {
            await fetch(NOTIFICATION_ENDPOINTS.unsubscribe, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            }).catch(() => {});
          }
          await sub.unsubscribe().catch(() => {});
        }
      } catch (err) {
        console.warn('Unsubscribe device notice:', err);
      }
      setIsPushRegisteredOnServer(false);
      setBrowserNotificationsEnabled(false);
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      alert(
        'Notifications are blocked in your browser settings. To enable them, please allow notifications for StudentNeed in your browser site settings.'
      );
      setBrowserNotificationsEnabled(false);
      return;
    }

    const requested = await requestPushPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    if (requested !== 'granted') {
      setBrowserNotificationsEnabled(false);
      return;
    }

    try {
      const regResult = await syncPushRegistration();
      setIsPushRegisteredOnServer(regResult.success);
      if (!regResult.success) {
        // Distinguish browser permission from successful server registration
        setBrowserNotificationsEnabled(false);
        if (!regResult.pushServiceAvailable) {
          alert(
            'Notification permission was granted, but your browser push service is unavailable (for example, in Private/Incognito browsing mode or due to browser/network restrictions). In-app alerts will continue to work while StudentNeed is open.'
          );
        } else {
          alert(
            'Notification permission was granted by your browser, but registration with the push notification server could not be completed. Please check your connection or server status and try again.'
          );
        }
        return;
      }
      setBrowserNotificationsEnabled(true);
    } catch (err: any) {
      console.error('Failed to enable push notifications:', err);
      setIsPushRegisteredOnServer(false);
      alert('Could not enable push notifications: ' + (err.message || 'Unknown error'));
      setBrowserNotificationsEnabled(false);
    }
  };

  // Automatically refresh tokens only when permission is granted AND browser notifications are enabled
  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined' || !isPushSupported()) {
      setIsPushRegisteredOnServer(false);
      return;
    }
    if (Notification.permission !== 'granted' || !browserNotificationsEnabled) {
      setIsPushRegisteredOnServer(false);
      return;
    }

    let isMounted = true;
    const runAutoRefresh = async () => {
      try {
        const regResult = await syncPushRegistration();
        if (isMounted) {
          setIsPushRegisteredOnServer(regResult.success);
          if (!regResult.success) {
            console.debug('Push registration auto-refresh notice: backend registration unconfirmed; preserving user preference.');
            // Crucial: DO NOT erase user's persistent preference during network outages or server restarts!
          }
        }
      } catch (e) {
        if (isMounted) {
          setIsPushRegisteredOnServer(false);
          console.debug('Auto-refresh push token notice:', e);
        }
      }
    };

    runAutoRefresh();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, browserNotificationsEnabled, syncPushRegistration]);

  // Foreground FCM message listener
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || 'New Notification';
      const body = payload?.notification?.body || payload?.data?.body || '';
      const link = payload?.data?.url || payload?.fcmOptions?.link;
      const targetType = payload?.data?.chatId ? 'chat' : payload?.data?.reservationId ? 'reservation' : undefined;
      const targetId = payload?.data?.chatId || payload?.data?.reservationId;
      const eventId = payload?.data?.eventId;
      const chatId = payload?.data?.chatId;
      const messageId = payload?.data?.messageId;
      const notificationId = payload?.data?.notificationId;
      const fcmMessageId = payload?.fcmMessageId || payload?.messageId;

      showToast({
        id: `fcm_${fcmMessageId || Date.now()}`,
        title,
        body,
        link,
        targetType,
        targetId,
        eventId,
        chatId,
        messageId,
        notificationId,
        fcmMessageId,
      }, true);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [showToast]);

  // Sync browser permission changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
      if (Notification.permission === 'denied' && browserNotificationsEnabled) {
        setBrowserNotificationsEnabled(false);
      }
    }
  }, [browserNotificationsEnabled]);

  // --- Real-Time Firestore Notifications Listener ---
  useEffect(() => {
    if (!currentUserId) {
      setNotifications([]);
      setUnreadTotal(0);
      setChatUnreadCounts({});
      setIsLoading(false);
      setHasMore(false);
      lastDocRef.current = null;
      seenIdsRef.current = new Set();
      isInitialLoadRef.current = true;
      setIsPushRegisteredOnServer(false);
      return;
    }

    setIsLoading(true);

    const notifsQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', currentUserId),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      notifsQuery,
      (snapshot) => {
        const items: AppNotification[] = [];
        let newItemsDetected = false;

        snapshot.docs.forEach((d) => {
          const data = d.data();
          const notifId = d.id;

          const item: AppNotification = {
            id: notifId,
            notificationId: notifId,
            recipientUid: data.recipientUid,
            type: data.type || 'system',
            title: data.title || 'Notification',
            body: data.body || data.message || '',
            message: data.body || data.message || '',
            createdAt: data.createdAt,
            timestamp: toIsoString(data.createdAt),
            read: Boolean(data.read),
            readAt: data.readAt,
            targetType: data.targetType,
            targetId: data.targetId,
            actorUid: data.actorUid,
            actorName: data.actorName,
            eventId: data.eventId,
            link: data.link || (data.targetType === 'chat' ? `/chat/${data.targetId}` : '/'),
            chatId: data.chatId || (data.targetType === 'chat' ? data.targetId : undefined),
            reservationId: data.reservationId || (data.targetType === 'reservation' ? data.targetId : undefined),
            listingId: data.listingId || (data.targetType === 'listing' ? data.targetId : undefined),
            requestId: data.requestId || (data.targetType === 'request' ? data.targetId : undefined),
          };

          items.push(item);

          if (!seenIdsRef.current.has(notifId)) {
            seenIdsRef.current.add(notifId);
            if (!isInitialLoadRef.current && !item.read) {
              newItemsDetected = true;
            }
          }
        });

        // Store last document for pagination
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
          setHasMore(snapshot.docs.length === PAGE_SIZE);
        } else {
          lastDocRef.current = null;
          setHasMore(false);
        }

        setNotifications(items);

        // Derive unread counts
        const unreadCount = items.filter((n) => !n.read).length;
        setUnreadTotal(unreadCount);

        const chatCounts: Record<string, number> = {};
        items.forEach((n) => {
          if (!n.read && n.type === 'chat' && n.targetId) {
            chatCounts[n.targetId] = (chatCounts[n.targetId] || 0) + 1;
          }
        });
        setChatUnreadCounts(chatCounts);

        if (newItemsDetected) {
          const newest = items.find((n) => !n.read);
          if (newest) {
            showToast({
              id: newest.id,
              notificationId: newest.notificationId,
              title: newest.title,
              body: newest.body || newest.message,
              link: newest.link,
              targetType: newest.targetType,
              targetId: newest.targetId,
              eventId: newest.eventId,
              chatId: newest.chatId,
              requestId: newest.requestId,
              reservationId: newest.reservationId,
            }, true);
          }
        }

        isInitialLoadRef.current = false;
        setIsLoading(false);
      },
      (err) => {
        console.warn('Notifications real-time listener notice:', err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUserId, soundEnabled]);

  // Pagination: fetch next batch
  const loadMore = useCallback(async () => {
    if (!currentUserId || !lastDocRef.current || !hasMore) return;

    try {
      const nextQuery = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', currentUserId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE)
      );

      const snap = await getDocs(nextQuery);
      if (snap.empty) {
        setHasMore(false);
        return;
      }

      const additional: AppNotification[] = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        const notifId = d.id;
        seenIdsRef.current.add(notifId);

        additional.push({
          id: notifId,
          notificationId: notifId,
          recipientUid: data.recipientUid,
          type: data.type || 'system',
          title: data.title || 'Notification',
          body: data.body || data.message || '',
          message: data.body || data.message || '',
          createdAt: data.createdAt,
          timestamp: toIsoString(data.createdAt),
          read: Boolean(data.read),
          readAt: data.readAt,
          targetType: data.targetType,
          targetId: data.targetId,
          actorUid: data.actorUid,
          actorName: data.actorName,
          eventId: data.eventId,
          link: data.link || (data.targetType === 'chat' ? `/chat/${data.targetId}` : '/'),
          chatId: data.chatId || (data.targetType === 'chat' ? data.targetId : undefined),
          reservationId: data.reservationId || (data.targetType === 'reservation' ? data.targetId : undefined),
          listingId: data.listingId || (data.targetType === 'listing' ? data.targetId : undefined),
          requestId: data.requestId || (data.targetType === 'request' ? data.targetId : undefined),
        });
      });

      lastDocRef.current = snap.docs[snap.docs.length - 1];
      setHasMore(snap.docs.length === PAGE_SIZE);

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        additional.forEach((item) => {
          if (!existingIds.has(item.id)) {
            merged.push(item);
          }
        });
        return merged;
      });
    } catch (err) {
      console.warn('Pagination loadMore notice:', err);
    }
  }, [currentUserId, hasMore]);

  // Mark single notification as read
  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadTotal((prev) => Math.max(0, prev - 1));

      try {
        await updateDoc(doc(db, 'notifications', notificationId), {
          read: true,
          readAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Failed to update notification read status in Firestore:', err);
      }
    },
    []
  );

  // Mark all unread notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    const unreadItems = notifications.filter((n) => !n.read);
    if (unreadItems.length === 0) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadTotal(0);
    setChatUnreadCounts({});

    try {
      const batch = writeBatch(db);
      unreadItems.forEach((n) => {
        const docRef = doc(db, 'notifications', n.id);
        batch.update(docRef, { read: true, readAt: serverTimestamp() });
      });
      await batch.commit();

      // Trigger backend mark-all-read for any documents beyond the loaded batch
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        fetch(NOTIFICATION_ENDPOINTS.markAllRead, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Failed to mark all notifications as read in Firestore:', err);
    }
  }, [currentUserId, notifications]);

  // Mark all chat notifications for a given chatId as read
  const markChatAsRead = useCallback(
    async (chatId: string) => {
      if (!currentUserId || !chatId) return;

      const chatNotifs = notifications.filter(
        (n) => !n.read && (n.chatId === chatId || n.targetId === chatId)
      );

      setChatUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));

      if (chatNotifs.length > 0) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.chatId === chatId || n.targetId === chatId ? { ...n, read: true } : n
          )
        );
        setUnreadTotal((prev) => Math.max(0, prev - chatNotifs.length));

        try {
          const batch = writeBatch(db);
          chatNotifs.forEach((n) => {
            batch.update(doc(db, 'notifications', n.id), {
              read: true,
              readAt: serverTimestamp(),
            });
          });
          await batch.commit();
        } catch (err) {
          console.warn('Failed to mark chat notifications as read:', err);
        }
      }

      // Backward compatibility: update private chat_reads doc
      try {
        const privateReadsDocRef = doc(db, 'users', currentUserId, 'private', 'chat_reads');
        await setDoc(
          privateReadsDocRef,
          { [chatId]: serverTimestamp() },
          { merge: true }
        );
      } catch {}
    },
    [currentUserId, notifications]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadTotal,
        chatUnreadCounts,
        soundEnabled,
        browserNotificationsEnabled,
        isPushRegisteredOnServer,
        permissionStatus,
        isLoading,
        hasMore,
        activeToast,
        dismissToast,
        showToast,
        loadMore,
        toggleSound,
        toggleBrowserNotifications,
        markChatAsRead,
        markNotificationAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
