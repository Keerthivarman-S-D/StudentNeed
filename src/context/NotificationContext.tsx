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
import { isPushSupported, requestPushPermission, subscribeToFCM, onForegroundMessage } from '../lib/fcm';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadTotal: number;
  chatUnreadCounts: Record<string, number>;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  isLoading: boolean;
  hasMore: boolean;
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

  const toggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  const toggleBrowserNotifications = async () => {
    if (!isPushSupported()) {
      alert('Browser notifications are not supported in this browser.');
      return;
    }

    if (browserNotificationsEnabled) {
      // Unsubscribe
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          await fetch('/api/push/fcm-unsubscribe', {
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
            await fetch('/api/push/unsubscribe', {
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
    if (requested !== 'granted') {
      setBrowserNotificationsEnabled(false);
      return;
    }

    try {
      // 1. Fetch VAPID key
      let vapidPublicKey = '';
      try {
        const vapidRes = await fetch('/api/push/vapid-public-key');
        if (vapidRes.ok) {
          const vapidData = await vapidRes.json();
          vapidPublicKey = vapidData.publicKey || '';
        }
      } catch {}

      // 2. Try FCM subscription first
      const fcmToken = await subscribeToFCM(vapidPublicKey);
      const idToken = await auth.currentUser?.getIdToken();

      if (fcmToken && idToken) {
        await fetch('/api/push/fcm-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token: fcmToken }),
        }).catch(() => {});
      }

      // 3. Register standard Web Push as well
      const reg = await navigator.serviceWorker.ready;
      if (vapidPublicKey && 'pushManager' in reg) {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }
        if (idToken && sub) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ subscription: sub.toJSON() }),
          }).catch(() => {});
        }
      }

      setBrowserNotificationsEnabled(true);
    } catch (err: any) {
      console.error('Failed to enable push notifications:', err);
      alert('Could not enable push notifications: ' + (err.message || 'Unknown error'));
      setBrowserNotificationsEnabled(false);
    }
  };

  // Foreground FCM message listener
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      if (soundEnabled) {
        playNotificationChime();
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [soundEnabled]);

  // Sync browser permission changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
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

        if (newItemsDetected && soundEnabled) {
          playNotificationChime();
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
        fetch('/api/notifications/mark-all-read', {
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
        isLoading,
        hasMore,
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
