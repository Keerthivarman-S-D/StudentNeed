import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';

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
  toggleSound: () => void;
  toggleBrowserNotifications: () => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => void;
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

// Programmatic Web Audio API melodic 2-tone chime
// Resilient to network outages, 0 asset dependencies, strictly obeys autoplay safety
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

    // Clean up AudioContext safely
    setTimeout(() => {
      try {
        ctx.close().catch(() => {});
      } catch {}
    }, 500);
  } catch {
    // Graceful fallback if audio is disallowed or blocked by policy
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chatReads, setChatReads] = useState<Record<string, number>>({});
  const [chatUnreadCounts, setChatUnreadCounts] = useState<Record<string, number>>({});
  
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

  // Track read notification IDs in localStorage
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`sn_read_notifs_${currentUserId || 'guest'}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Deduplication tracking to ensure initial page load never replays sounds
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

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

  useEffect(() => {
    if (!currentUserId) return;
    try {
      localStorage.setItem(
        `sn_read_notifs_${currentUserId}`,
        JSON.stringify(Array.from(readNotificationIds))
      );
    } catch {}
  }, [readNotificationIds, currentUserId]);

  const toggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  const toggleBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Browser notifications are not supported by this browser.');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Web Push is not supported in this browser environment.');
      return;
    }

    // 1. If currently active, unsubscribe
    if (browserNotificationsEnabled) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const idToken = await auth.currentUser?.getIdToken();
          if (idToken) {
            await fetch('/api/push/unsubscribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            }).catch((err) => console.warn('Unsubscribe API warning:', err));
          }
          await sub.unsubscribe().catch(() => {});
        }
      } catch (err) {
        console.warn('Error unsubscribing device:', err);
      }
      setBrowserNotificationsEnabled(false);
      return;
    }

    // 2. Separate handling for permission states: denied vs default vs granted
    const permission = Notification.permission;
    if (permission === 'denied') {
      alert(
        'Notifications are blocked in your browser settings. To enable them, please allow notifications for StudentNeed in your browser site settings.'
      );
      setBrowserNotificationsEnabled(false);
      return;
    }

    let granted = permission === 'granted';
    if (!granted) {
      const requested = await Notification.requestPermission();
      if (requested === 'granted') {
        granted = true;
      } else {
        setBrowserNotificationsEnabled(false);
        return;
      }
    }

    // 3. Register service worker and subscribe to PushManager
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const vapidRes = await fetch('/api/push/vapid-public-key');
      if (!vapidRes.ok) {
        throw new Error('Push notification service is temporarily unavailable.');
      }
      const { publicKey } = await vapidRes.json();
      if (!publicKey) {
        throw new Error('VAPID public key not found.');
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (idToken && sub) {
        const subJson = sub.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ subscription: subJson }),
        });
      }

      setBrowserNotificationsEnabled(true);
    } catch (err: any) {
      console.error('Failed to enable browser push notifications:', err);
      alert('Could not enable push notifications: ' + (err.message || 'Unknown error'));
      setBrowserNotificationsEnabled(false);
    }
  };

  const triggerAlert = useCallback((title: string, message: string, link: string) => {
    if (soundEnabled) {
      playNotificationChime();
    }
    // OS-level notifications are dispatched directly via Web Push Service Worker
    // to guarantee delivery when backgrounded or closed, avoiding duplicate OS banners.
  }, [soundEnabled]);

  // Sync browser permission changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied' && browserNotificationsEnabled) {
        setBrowserNotificationsEnabled(false);
      }
    }
  }, [browserNotificationsEnabled]);

  // 1. Subscribe to User's Private Read Receipts: /users/{userId}/private/chat_reads
  useEffect(() => {
    if (!currentUserId) {
      setChatReads({});
      return;
    }

    const privateReadsDocRef = doc(db, 'users', currentUserId, 'private', 'chat_reads');
    const unsub = onSnapshot(
      privateReadsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const readsMap: Record<string, number> = {};
          Object.entries(data).forEach(([cId, val]) => {
            readsMap[cId] = toMillis(val);
          });
          setChatReads(readsMap);
        } else {
          setChatReads({});
        }
      },
      (err) => {
        console.warn('Private chat reads subscription note:', err);
      }
    );

    return () => unsub();
  }, [currentUserId]);

  // 2. Subscribe to user's active chats & recent messages
  useEffect(() => {
    if (!currentUserId) {
      setChatUnreadCounts({});
      return;
    }

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUserId),
      limit(25)
    );

    const messageUnsubscribes: Record<string, () => void> = {};
    const chatMessagesMap: Record<string, any[]> = {};

    const unsubChats = onSnapshot(
      chatsQuery,
      (chatsSnapshot) => {
        const activeChatIds = new Set(chatsSnapshot.docs.map((d) => d.id));

        // Clean up unneeded message listeners
        Object.keys(messageUnsubscribes).forEach((cId) => {
          if (!activeChatIds.has(cId)) {
            messageUnsubscribes[cId]();
            delete messageUnsubscribes[cId];
            delete chatMessagesMap[cId];
          }
        });

        // Set up listener for each chat's recent messages
        chatsSnapshot.docs.forEach((chatDoc) => {
          const cId = chatDoc.id;
          if (!messageUnsubscribes[cId]) {
            const msgsQuery = query(
              collection(db, 'chats', cId, 'messages'),
              orderBy('createdAt', 'desc'),
              limit(15)
            );

            messageUnsubscribes[cId] = onSnapshot(
              msgsQuery,
              (msgsSnap) => {
                const msgs = msgsSnap.docs.map((mDoc) => ({
                  id: mDoc.id,
                  ...mDoc.data(),
                }));
                chatMessagesMap[cId] = msgs;

                // Recompute unread counts for this chat
                recalculateUnreads();
              },
              (err) => console.warn(`Message listener notice for chat ${cId}:`, err)
            );
          }
        });
      },
      (err) => {
        console.warn('User chats subscription note:', err);
      }
    );

    const recalculateUnreads = () => {
      const newCounts: Record<string, number> = {};
      const chatNotifs: AppNotification[] = [];

      Object.entries(chatMessagesMap).forEach(([cId, msgs]) => {
        const lastRead = chatReads[cId] || 0;
        
        let unreadForChat = 0;
        let newestUnreadMsg: any = null;

        msgs.forEach((m) => {
          if (m.senderId !== currentUserId) {
            const msgMillis = toMillis(m.createdAt);
            if (msgMillis > lastRead) {
              unreadForChat++;
              if (!newestUnreadMsg) newestUnreadMsg = m;
            }
          }
        });

        newCounts[cId] = unreadForChat;

        // If there's an unread message, add to synthesized notifications
        if (unreadForChat > 0 && newestUnreadMsg) {
          const notifId = `chat_${cId}_${newestUnreadMsg.id}`;
          const isRead = readNotificationIds.has(notifId);

          chatNotifs.push({
            id: notifId,
            type: 'chat',
            title: unreadForChat > 1 ? `New Messages (${unreadForChat})` : 'New Chat Message',
            message: newestUnreadMsg.text || 'Sent an attachment',
            timestamp: new Date(toMillis(newestUnreadMsg.createdAt) || Date.now()).toISOString(),
            read: isRead,
            link: `/chat/${cId}`,
            chatId: cId,
          });

          // Check if this is a newly arrived message to trigger chime
          if (!seenEventKeysRef.current.has(notifId)) {
            seenEventKeysRef.current.add(notifId);
            if (!isInitialLoadRef.current) {
              triggerAlert('New Message', newestUnreadMsg.text || 'You received a new message', `/chat/${cId}`);
            }
          }
        }
      });

      setChatUnreadCounts(newCounts);
      setNotifications((prev) => {
        const nonChat = prev.filter((n) => n.type !== 'chat');
        return [...chatNotifs, ...nonChat].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
    };

    return () => {
      unsubChats();
      Object.values(messageUnsubscribes).forEach((fn) => fn());
    };
  }, [currentUserId, chatReads, triggerAlert, readNotificationIds]);

  // 3. Subscribe to user's reservations for trade activity alerts
  useEffect(() => {
    if (!currentUserId) return;

    const resQuery = query(
      collection(db, 'reservations'),
      where('buyerId', '==', currentUserId),
      limit(15)
    );

    const unsubRes = onSnapshot(
      resQuery,
      (snapshot) => {
        const resNotifs: AppNotification[] = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const resId = docSnap.id;
          const status = data.status;

          // Alert buyer on status change
          if (status === 'accepted' || status === 'completed') {
            const notifId = `res_${resId}_${status}`;
            const isRead = readNotificationIds.has(notifId);
            const title = status === 'accepted' ? 'Reservation Accepted! 🎉' : 'Exchange Completed! ✅';
            const message =
              status === 'accepted'
                ? 'The seller accepted your reservation. Tap to view meetup details.'
                : 'Your campus exchange was marked complete.';

            resNotifs.push({
              id: notifId,
              type: 'reservation',
              title,
              message,
              timestamp: new Date(toMillis(data.updatedAt) || Date.now()).toISOString(),
              read: isRead,
              link: data.chatId ? `/chat/${data.chatId}` : '/reserved',
              reservationId: resId,
            });

            if (!seenEventKeysRef.current.has(notifId)) {
              seenEventKeysRef.current.add(notifId);
              if (!isInitialLoadRef.current) {
                triggerAlert(title, message, data.chatId ? `/chat/${data.chatId}` : '/reserved');
              }
            }
          }
        });

        setNotifications((prev) => {
          const nonRes = prev.filter((n) => n.type !== 'reservation');
          return [...nonRes, ...resNotifs].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });

        // Initial snapshot settled
        if (isInitialLoadRef.current) {
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 1500);
        }
      },
      (err) => console.warn('Reservations notification listener notice:', err)
    );

    return () => unsubRes();
  }, [currentUserId, triggerAlert, readNotificationIds]);

  // Mark single chat conversation as read in Firestore
  const markChatAsRead = useCallback(async (chatId: string) => {
    if (!currentUserId || !chatId) return;

    try {
      // 1. Write to per-chat document: /users/{uid}/private/chat_reads_{chatId}
      const perChatDocRef = doc(db, 'users', currentUserId, 'private', `chat_reads_${chatId}`);
      await setDoc(
        perChatDocRef,
        {
          chatId,
          lastReadAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Write to user's combined map document: /users/{uid}/private/chat_reads
      const allReadsDocRef = doc(db, 'users', currentUserId, 'private', 'chat_reads');
      await setDoc(
        allReadsDocRef,
        {
          [chatId]: serverTimestamp(),
        },
        { merge: true }
      );

      // Optimistically clear unread in local state
      setChatReads((prev) => ({ ...prev, [chatId]: Date.now() }));
      setChatUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
    } catch (err) {
      console.warn('Failed to update private chat read receipt:', err);
    }
  }, [currentUserId]);

  const markNotificationAsRead = useCallback((notificationId: string) => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      next.add(notificationId);
      return next;
    });

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    // Mark all synthesized notifications as read
    const allIds = new Set(notifications.map((n) => n.id));
    setReadNotificationIds(allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    // Mark all chats as read
    try {
      const allReadsDocRef = doc(db, 'users', currentUserId, 'private', 'chat_reads');
      const payload: Record<string, any> = {};
      Object.keys(chatUnreadCounts).forEach((cId) => {
        payload[cId] = serverTimestamp();
      });
      if (Object.keys(payload).length > 0) {
        await setDoc(allReadsDocRef, payload, { merge: true });
      }
      setChatUnreadCounts({});
    } catch (err) {
      console.warn('Could not mark all chats read:', err);
    }
  }, [currentUserId, notifications, chatUnreadCounts]);

  const unreadChatCount = Object.values(chatUnreadCounts).reduce((sum, count) => sum + count, 0);
  const unreadNotifsCount = notifications.filter((n) => !n.read && n.type !== 'chat').length;
  const unreadTotal = unreadChatCount + unreadNotifsCount;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadTotal,
        chatUnreadCounts,
        soundEnabled,
        browserNotificationsEnabled,
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
