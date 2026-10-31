// Cross-tab coordination channel for StudentNeed
// Ensures multiple browser tabs remain synchronized (e.g., auth logout, listing invalidation)
// without duplicating Firestore listeners or sending redundant queries.

export type SyncEvent =
  | { type: 'AUTH_LOGOUT' }
  | { type: 'LISTING_CREATED'; listingId: string }
  | { type: 'LISTING_UPDATED'; listingId: string }
  | { type: 'RESERVATION_CREATED'; listingId: string }
  | { type: 'RESERVATION_STATUS_CHANGED'; reservationId: string };

const CHANNEL_NAME = 'sn_tab_sync_channel';
const STORAGE_KEY = 'sn_tab_sync_fallback';

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
}

/**
 * Broadcast an event to all other open tabs in the same browser.
 */
export function broadcastSyncEvent(event: SyncEvent): void {
  if (typeof window === 'undefined') return;

  // Primary: BroadcastChannel (modern, low-latency, cross-tab)
  if (channel) {
    try {
      channel.postMessage(event);
      return;
    } catch {
      // Fall through to storage event fallback
    }
  }

  // Fallback: localStorage storage event (supported in all browsers)
  try {
    const payload = JSON.stringify({ ...event, _ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // Ignore storage write errors (e.g. private mode quota)
  }
}

/**
 * Subscribe to sync events from other tabs. Returns an unsubscribe cleanup function.
 */
export function subscribeToSyncEvents(onEvent: (event: SyncEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (e: MessageEvent) => {
    if (e.data && typeof e.data.type === 'string') {
      onEvent(e.data as SyncEvent);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && typeof parsed.type === 'string') {
          onEvent(parsed as SyncEvent);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  };

  if (channel) {
    channel.addEventListener('message', handleMessage);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (channel) {
      channel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}
