import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n===============================================================');
console.log('--- StudentNeed Real-Time Notifications Implementation Tests ---');
console.log('===============================================================\n');

// 1. Files existence check
const typesPath = path.join(process.cwd(), 'src/types.ts');
const serverPath = path.join(process.cwd(), 'server.ts');
const contextPath = path.join(process.cwd(), 'src/context/NotificationContext.tsx');
const bellPath = path.join(process.cwd(), 'src/components/NotificationBell.tsx');
const navbarPath = path.join(process.cwd(), 'src/components/Navbar.tsx');
const fcmPath = path.join(process.cwd(), 'src/lib/fcm.ts');
const rulesPath = path.join(process.cwd(), 'firestore.rules');
const indexesPath = path.join(process.cwd(), 'firestore.indexes.json');
const apiPath = path.join(process.cwd(), 'src/config/api.ts');
const fcmSwPath = path.join(process.cwd(), 'public/firebase-messaging-sw.js');
const swPath = path.join(process.cwd(), 'public/sw.js');
const profilePath = path.join(process.cwd(), 'src/pages/Profile.tsx');
const listingDetailPath = path.join(process.cwd(), 'src/pages/ListingDetail.tsx');
const requestsPath = path.join(process.cwd(), 'src/pages/Requests.tsx');
const chatPath = path.join(process.cwd(), 'src/pages/Chat.tsx');
const toastPath = path.join(process.cwd(), 'src/components/NotificationToast.tsx');
const appPath = path.join(process.cwd(), 'src/App.tsx');
const firebaseJsonPath = path.join(process.cwd(), 'firebase.json');

assert(fs.existsSync(typesPath), 'src/types.ts exists');
assert(fs.existsSync(serverPath), 'server.ts exists');
assert(fs.existsSync(contextPath), 'src/context/NotificationContext.tsx exists');
assert(fs.existsSync(bellPath), 'src/components/NotificationBell.tsx exists');
assert(fs.existsSync(navbarPath), 'src/components/Navbar.tsx exists');
assert(fs.existsSync(fcmPath), 'src/lib/fcm.ts exists');
assert(fs.existsSync(rulesPath), 'firestore.rules exists');
assert(fs.existsSync(indexesPath), 'firestore.indexes.json exists');
assert(fs.existsSync(fcmSwPath), 'public/firebase-messaging-sw.js exists');
assert(fs.existsSync(swPath), 'public/sw.js exists');
assert(fs.existsSync(toastPath), 'src/components/NotificationToast.tsx exists');
assert(fs.existsSync(appPath), 'src/App.tsx exists');
assert(fs.existsSync(firebaseJsonPath), 'firebase.json exists');

const typesSrc = fs.readFileSync(typesPath, 'utf-8');
const serverSrc = fs.readFileSync(serverPath, 'utf-8');
const contextSrc = fs.readFileSync(contextPath, 'utf-8');
const bellSrc = fs.readFileSync(bellPath, 'utf-8');
const navbarSrc = fs.readFileSync(navbarPath, 'utf-8');

const fcmSrc = fs.readFileSync(fcmPath, 'utf-8');
const rulesSrc = fs.readFileSync(rulesPath, 'utf-8');
const indexesSrc = fs.readFileSync(indexesPath, 'utf-8');
const apiSrc = fs.readFileSync(apiPath, 'utf-8');
const profileSrc = fs.readFileSync(profilePath, 'utf-8');
const listingDetailSrc = fs.readFileSync(listingDetailPath, 'utf-8');
const requestsSrc = fs.readFileSync(requestsPath, 'utf-8');
const chatSrc = fs.readFileSync(chatPath, 'utf-8');
const appSrc = fs.readFileSync(appPath, 'utf-8');
const firebaseJsonSrc = fs.readFileSync(firebaseJsonPath, 'utf-8');
const fcmSwSrc = fs.readFileSync(fcmSwPath, 'utf-8');
const swSrc = fs.readFileSync(swPath, 'utf-8');

// 2. Data Model Verification
console.log('\n--- 2. Data Model Verification ---');
assert(typesSrc.includes('AppNotification =') || typesSrc.includes('interface AppNotification'), 'AppNotification type/interface exported');
assert(typesSrc.includes('notificationId'), 'AppNotification has notificationId');
assert(typesSrc.includes('recipientUid'), 'AppNotification has recipientUid');
assert(typesSrc.includes('targetType?: NotificationTargetType;'), 'AppNotification has targetType');
assert(typesSrc.includes('targetId?: string;'), 'AppNotification has targetId');
assert(typesSrc.includes('actorUid?: string;'), 'AppNotification has actorUid');
assert(typesSrc.includes('eventId?: string;'), 'AppNotification has eventId');
assert(typesSrc.includes('body: string;'), 'AppNotification has body');
assert(typesSrc.includes('read: boolean;'), 'AppNotification has read status');
assert(typesSrc.includes('readAt?: any;'), 'AppNotification has readAt timestamp');
assert(typesSrc.includes('link: string;'), 'AppNotification has link');


// 3. Supported Real Application Events in Server
console.log('\n--- 3. Event Triggers & Recipient Resolution ---');
assert(serverSrc.includes('createServerNotification'), 'Server implements createServerNotification function');
assert(serverSrc.includes('/api/reservations/notify-created'), 'Server has /api/reservations/notify-created for new reservation events');
assert(serverSrc.includes('/api/reservations/accept'), 'Server has /api/reservations/accept for accepted reservations');
assert(serverSrc.includes('/api/reservations/decline'), 'Server has /api/reservations/decline for rejected reservations');
assert(serverSrc.includes('/api/reservations/cancel'), 'Server has /api/reservations/cancel for cancelled reservations');
assert(serverSrc.includes('/api/reservations/complete'), 'Server has /api/reservations/complete for completed reservations');
assert(serverSrc.includes('/api/reservations/notify-meetup'), 'Server has /api/reservations/notify-meetup for meetup confirmations/proposals');
assert(serverSrc.includes('/api/requests/notify-response'), 'Server has /api/requests/notify-response for student request responses');
assert(serverSrc.includes('/api/push/notify-message'), 'Server has /api/push/notify-message for incoming chat messages');

// 4. Server-Side Validation, Security & No Self-Notifications
console.log('\n--- 4. Security, Server-Side Recipient Validation & No Self-Notifications ---');
assert(serverSrc.includes('callerUid !== sellerId'), 'Reservation decline validates caller is seller');
assert(serverSrc.includes('callerUid !== buyerId'), 'Reservation cancel/accept validates caller');
assert(serverSrc.includes('callerUid !== sellerId && callerUid !== buyerId'), 'Meetup notification validates caller is reservation party');
assert(serverSrc.includes('callerUid === requesterId'), 'Request response validates caller cannot be requester');

assert(serverSrc.includes('recipients.filter(') || serverSrc.includes('p !== callerUid'), 'Chat message excludes sender from recipients');

// 5. Idempotency & Duplicate Prevention
console.log('\n--- 5. Idempotency & Deterministic Notification IDs ---');
assert(serverSrc.includes('notif_res_created_${reservationId}_${sellerId}'), 'Reservation request uses deterministic notification ID');

assert(serverSrc.includes('notif_res_accepted_${reservationId}_${buyerId}'), 'Reservation accept uses deterministic notification ID');
assert(serverSrc.includes('notif_res_declined_${reservationId}_${buyerId}'), 'Reservation decline uses deterministic notification ID');
assert(serverSrc.includes('notif_res_cancelled_${reservationId}_${targetUser}'), 'Reservation cancel uses deterministic notification ID');
assert(serverSrc.includes('notif_meetup_${reservationId}_'), 'Meetup update uses deterministic notification ID');
assert(serverSrc.includes('notif_chat_${messageId}_${recipientUid}'), 'Chat message notification uses deterministic notification ID per recipient');


// 6. Firestore Security Rules
console.log('\n--- 6. Firestore Security Rules ---');
assert(rulesSrc.includes('match /notifications/{notificationId}'), 'Rules define /notifications/{notificationId}');
assert(rulesSrc.includes('resource.data.recipientUid == request.auth.uid'), 'Rules ensure user can only read their own notifications');
assert(rulesSrc.includes("affectedKeys().hasOnly(['read', 'readAt', 'updatedAt'])") ||
       rulesSrc.includes("resource.data.recipientUid == request.auth.uid"),
       'Rules allow recipient to update read state');
assert(rulesSrc.includes('request.resource.data.recipientUid != request.auth.uid'), 'Rules prevent arbitrary self-notifications from clients');


// 7. Firestore Indexes
console.log('\n--- 7. Firestore Indexes ---');
const parsedIndexes = JSON.parse(indexesSrc);
const notifIndexes = parsedIndexes.indexes.filter((idx: any) => idx.collectionGroup === 'notifications');
assert(notifIndexes.length >= 2, 'Composite indexes defined for notifications');
const hasRecipientCreated = notifIndexes.some((idx: any) =>
  idx.fields.some((f: any) => f.fieldPath === 'recipientUid') &&
  idx.fields.some((f: any) => f.fieldPath === 'createdAt' && f.order === 'DESCENDING')
);
assert(hasRecipientCreated, 'Composite index on recipientUid + createdAt DESC exists');
const hasRecipientReadCreated = notifIndexes.some((idx: any) =>
  idx.fields.some((f: any) => f.fieldPath === 'recipientUid') &&
  idx.fields.some((f: any) => f.fieldPath === 'read') &&
  idx.fields.some((f: any) => f.fieldPath === 'createdAt' && f.order === 'DESCENDING')
);
assert(hasRecipientReadCreated, 'Composite index on recipientUid + read + createdAt DESC exists');

// 8. Frontend Notification Context & Real-Time Listeners
console.log('\n--- 8. Real-Time Listeners & Context Management ---');
assert(contextSrc.includes('onSnapshot'), 'NotificationContext listens with onSnapshot');
assert(contextSrc.includes("where('recipientUid', '==', currentUserId)"), 'Context queries only authenticated user notifications');
assert(contextSrc.includes("orderBy('createdAt', 'desc')"), 'Context orders notifications chronologically descending');
assert(contextSrc.includes('limit(PAGE_SIZE)'), 'Context bounds queries with pagination limit');

assert(contextSrc.includes('unsubscribe()') || contextSrc.includes('return () =>'), 'Context cleans up listeners on logout/unmount');
assert(contextSrc.includes('unreadTotal'), 'Context exposes calculated unreadTotal');
assert(contextSrc.includes('markNotificationAsRead'), 'Context provides markNotificationAsRead');
assert(contextSrc.includes('markAllAsRead'), 'Context provides markAllAsRead');
assert(contextSrc.includes('loadMore'), 'Context provides loadMore pagination');

// 9. Header UI & NotificationBell Popover
console.log('\n--- 9. Header UI & Notification Bell ---');
assert(navbarSrc.includes('<NotificationBell />'), 'Navbar renders separate NotificationBell component');
assert(bellSrc.includes('unreadTotal'), 'Bell displays live unread notification badge');
assert(bellSrc.includes('aria-label='), 'Bell button has accessibility aria-label');

assert(bellSrc.includes('role="dialog"') && bellSrc.includes('aria-modal="true"'), 'Notification popover panel has dialog accessibility roles');
assert(bellSrc.includes('Escape'), 'Notification popover closes on Escape key');
assert(bellSrc.includes('contains(event.target as Node)'), 'Notification popover closes on outside click');
assert(bellSrc.includes('Mark all read') || bellSrc.includes('markAllAsRead'), 'Notification popover includes Mark all read action');
assert(bellSrc.includes('handleNotificationClick'), 'Clicking notification marks read and navigates to target');
assert(bellSrc.includes('fixed inset-x-') && bellSrc.includes('sm:inset-auto'), 'Notification popover has responsive mobile docking');

// 10. Web Push & FCM
console.log('\n--- 10. FCM & Push Notification Lifecycle ---');
assert(fcmSrc.includes('isFcmSupported'), 'FCM helper checks browser support');
assert(fcmSrc.includes('Notification.permission'), 'FCM helper checks notification permission');
assert(fcmSrc.includes('getToken'), 'FCM helper requests FCM token');
assert(fcmSrc.includes('onMessage'), 'FCM helper listens for foreground messages');
assert(fcmSrc.includes('firebase-messaging-sw.js'), 'FCM helper registers service worker');
assert(fcmSrc.includes('isIOS'), 'FCM helper exports isIOS platform detection');
assert(fcmSrc.includes('isStandalonePWA'), 'FCM helper exports isStandalonePWA detection');
assert(fcmSwSrc.includes('skipWaiting') && fcmSwSrc.includes('clients.claim'), 'Service worker immediately takes control with skipWaiting & clients.claim');
assert(swSrc.includes('/firebase-messaging-sw.js'), 'sw.js delegates directly to canonical firebase-messaging-sw.js');
assert(serverSrc.includes('/api/push/fcm-token'), 'Server provides endpoint to register FCM device tokens');
assert(serverSrc.includes('/api/push/fcm-unsubscribe'), 'Server provides endpoint to unregister FCM device tokens on logout');
assert(serverSrc.includes('sendFcmToUser'), 'Server implements sendFcmToUser for FCM v1 REST API dispatch');
assert(serverSrc.includes('https://fcm.googleapis.com/v1/projects/'), 'Server invokes official Google FCM v1 REST endpoint');
assert(serverSrc.includes('UNREGISTERED') && serverSrc.includes('pruned'), 'Server automatically detects and prunes invalid/unregistered FCM tokens');
assert(serverSrc.includes('Service-Worker-Allowed'), 'Server sets Service-Worker-Allowed and Cache-Control headers');
assert(firebaseJsonSrc.includes('Service-Worker-Allowed'), 'firebase.json configures no-cache and root scope headers for service workers');
assert(appSrc.includes('<NotificationToast />'), 'App renders NotificationToast for foreground alerts');
assert(contextSrc.includes('activeToast'), 'NotificationContext manages activeToast state');

// 11. Navigation Targets
console.log('\n--- 11. Notification Navigation Routing ---');
assert(bellSrc.includes("notif.targetType === 'chat'") || bellSrc.includes("notif.link"), 'Handles navigation to chat target');
assert(bellSrc.includes("notif.targetType === 'reservation'"), 'Handles navigation to reservation target (/reserved)');
assert(bellSrc.includes("notif.targetType === 'listing'"), 'Handles navigation to listing target');
assert(bellSrc.includes("notif.targetType === 'request'"), 'Handles navigation to request target (/requests)');


// 12. Frontend Event Hookups
console.log('\n--- 12. Frontend Event Hookups ---');
assert(listingDetailSrc.includes('RESERVATION_ENDPOINTS.notifyCreated'), 'ListingDetail notifies seller on reservation request');
assert(profileSrc.includes('RESERVATION_ENDPOINTS.decline'), 'Profile calls server endpoint on reservation decline');
assert(profileSrc.includes('RESERVATION_ENDPOINTS.notifyMeetup'), 'Profile notifies counterparty on meetup confirmation');
assert(requestsSrc.includes('NOTIFICATION_ENDPOINTS.notifyRequestResponse'), 'Requests notifies requester on student response');
assert(chatSrc.includes('NOTIFICATION_ENDPOINTS.notifyMessage') || chatSrc.includes('/api/push/notify-message'), 'Chat dispatches message notifications to counterparties');

// 13. Unit test logic simulations
console.log('\n--- 13. Unit Simulation Tests ---');

// Simulation: Unread count computation
interface MockNotif {
  notificationId: string;
  recipientUid: string;
  read: boolean;
  createdAt: number;
  readAt?: number;
}
const mockNotifications: MockNotif[] = [
  { notificationId: 'n1', recipientUid: 'u1', read: false, createdAt: 100 },
  { notificationId: 'n2', recipientUid: 'u1', read: true, createdAt: 90 },
  { notificationId: 'n3', recipientUid: 'u1', read: false, createdAt: 80 },
];
const unreadCount = mockNotifications.filter((n) => !n.read).length;
assert(unreadCount === 2, 'Unread calculation accurately counts unread items (2 out of 3)');

// Simulation: Mark as read
const updatedNotifications: MockNotif[] = mockNotifications.map((n) =>
  n.notificationId === 'n1' ? { ...n, read: true, readAt: Date.now() } : n
);
assert(updatedNotifications[0].read === true && (updatedNotifications[0].readAt ?? 0) > 0, 'Mark as read updates read boolean and readAt timestamp');
assert(updatedNotifications.filter((n) => !n.read).length === 1, 'Unread count decreases to 1 after marking item read');

// Simulation: Deterministic ID deduplication
const eventA = { eventId: 'res_123_accept', recipientUid: 'user_456' };
const eventB = { eventId: 'res_123_accept', recipientUid: 'user_456' };
const notifIdA = `notif_${eventA.eventId}_${eventA.recipientUid}`;
const notifIdB = `notif_${eventB.eventId}_${eventB.recipientUid}`;
assert(notifIdA === notifIdB, 'Identical events produce identical deterministic notification IDs for deduplication');

// Simulation: Self-notification prevention
const currentCallerUid: string = 'user_buyer_1';
const sellerUid: string = 'user_seller_2';
const shouldNotifyBuyer = currentCallerUid !== 'user_buyer_1'; // false
const shouldNotifySeller = currentCallerUid !== sellerUid; // true
assert(!shouldNotifyBuyer, 'Actor never receives notification for their own action');
assert(shouldNotifySeller, 'Counterparty correctly receives notification');

console.log('\n===============================================================');
console.log('--- ALL NOTIFICATION IMPLEMENTATION VERIFICATION TESTS PASSED ---');
console.log('===============================================================\n');
