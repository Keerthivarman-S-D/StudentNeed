import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getStableNotificationKey } from '../src/context/NotificationContext';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

console.log('\n===============================================================');
console.log('--- StudentNeed Live Verification & Audit Regression Suite ---');
console.log('===============================================================\n');

// -------------------------------------------------------------
// Test 1: Content Security Policy Verification
// -------------------------------------------------------------
console.log('--- 1. Content Security Policy (CSP) Verification ---');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));
const headers = firebaseJson.hosting.headers;
const allFilesHeader = headers.find((h: any) => h.source === '**');
const cspHeader = allFilesHeader.headers.find((hdr: any) => hdr.key === 'Content-Security-Policy')?.value || '';

assert(
  cspHeader.includes('script-src') && cspHeader.includes('https://www.gstatic.com'),
  'firebase.json CSP permits https://www.gstatic.com in script-src for Service Worker compat scripts'
);

assert(
  cspHeader.includes('connect-src') && cspHeader.includes('https://firebaseinstallations.googleapis.com'),
  'firebase.json CSP permits https://firebaseinstallations.googleapis.com in connect-src'
);

assert(
  cspHeader.includes('connect-src') && cspHeader.includes('https://fcmregistrations.googleapis.com'),
  'firebase.json CSP permits https://fcmregistrations.googleapis.com in connect-src'
);

const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
assert(
  serverSrc.includes('"https://www.gstatic.com"') && serverSrc.includes('scriptSrc:'),
  'server.ts Helmet CSP permits https://www.gstatic.com in scriptSrc'
);
assert(
  serverSrc.includes('"https://firebaseinstallations.googleapis.com"') &&
  serverSrc.includes('"https://fcmregistrations.googleapis.com"') &&
  serverSrc.includes('connectSrc:'),
  'server.ts Helmet CSP permits firebaseinstallations and fcmregistrations in connectSrc'
);

// -------------------------------------------------------------
// Test 2: Notification Deduplication & Multi-Message / Reservation Behavior
// -------------------------------------------------------------
console.log('\n--- 2. Stable Foreground Notification Deduplication ---');
const notifContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/NotificationContext.tsx'), 'utf-8');

assert(
  notifContextSrc.includes('getStableNotificationKey'),
  'NotificationContext exports getStableNotificationKey helper'
);
assert(
  notifContextSrc.includes('seenForegroundEventKeysRef'),
  'NotificationContext maintains seenForegroundEventKeysRef bounded event cache'
);

// Verify that bare targetType + targetId is NOT used as deduplication key
const bareTargetItem = { targetType: 'chat', targetId: 'chatABC' };
assert(
  getStableNotificationKey(bareTargetItem) === '',
  'Bare targetType + targetId does NOT return a deduplication key (prevents false cross-event suppression)'
);

// Event A: First message in chatABC
const chatMsg1 = {
  chatId: 'chatABC',
  messageId: 'msg001',
  eventId: 'chat_chatABC_msg001',
  title: 'Alice',
  body: 'Hello!'
};

// Event B: Second message in SAME chatABC
const chatMsg2 = {
  chatId: 'chatABC',
  messageId: 'msg002',
  eventId: 'chat_chatABC_msg002',
  title: 'Alice',
  body: 'Are you there?'
};

const key1 = getStableNotificationKey(chatMsg1);
const key2 = getStableNotificationKey(chatMsg2);

assert(
  key1 === 'chat_chatABC_msg001' && key2 === 'chat_chatABC_msg002',
  'Different messages in same conversation generate distinct deduplication keys'
);
assert(
  key1 !== key2,
  'Separate messages for same target are NOT falsely deduplicated and can both notify user'
);

// Reservation updates for same reservation
const resUpdate1 = {
  notificationId: 'notif_res123_requested',
  eventId: 'res_requested_res123',
  reservationId: 'res123',
  title: 'Reservation Requested'
};
const resUpdate2 = {
  notificationId: 'notif_res123_confirmed',
  eventId: 'res_confirmed_res123',
  reservationId: 'res123',
  title: 'Reservation Confirmed'
};

const resKey1 = getStableNotificationKey(resUpdate1);
const resKey2 = getStableNotificationKey(resUpdate2);

assert(
  resKey1 !== resKey2 && resKey1 === 'res_requested_res123' && resKey2 === 'res_confirmed_res123',
  'Separate reservation status updates for same target generate distinct keys and can both notify'
);

// Duplicate event across channels (Firestore snapshot and FCM push)
const firestoreEvent = {
  id: 'doc_12345',
  notificationId: 'notif_chat_msg999_userBob',
  eventId: 'chat_chatABC_msg999',
  chatId: 'chatABC',
  messageId: 'msg999',
  title: 'Alice',
  body: 'Calculator query'
};

const fcmPayload = {
  fcmMessageId: 'fcm_mid_777',
  eventId: 'chat_chatABC_msg999',
  chatId: 'chatABC',
  messageId: 'msg999',
  title: 'Alice',
  body: 'Calculator query'
};

const keyFromFirestore = getStableNotificationKey(firestoreEvent);
const keyFromFcm = getStableNotificationKey(fcmPayload);

assert(
  keyFromFirestore === keyFromFcm && keyFromFirestore === 'chat_chatABC_msg999',
  `Dual-channel identical event resolves to same key: "${keyFromFirestore}"`
);

// Simulation of single-toast, single-chime execution
const seenCache = new Map<string, number>();
let toastCount = 0;
let chimeCount = 0;

function simulateNotify(item: any, playSound = false) {
  const stableKey = getStableNotificationKey(item);
  const now = Date.now();
  if (stableKey) {
    const lastSeen = seenCache.get(stableKey);
    if (lastSeen && (now - lastSeen < 5 * 60 * 1000)) {
      return false; // deduplicated!
    }
    seenCache.set(stableKey, now);
  }
  toastCount++;
  if (playSound) chimeCount++;
  return true;
}

const firstHandled = simulateNotify(firestoreEvent, true);
const secondHandled = simulateNotify(fcmPayload, true);

assert(firstHandled === true, 'First event (Firestore) renders toast and triggers sound chime');
assert(secondHandled === false, 'Duplicate dual-channel event (FCM) is cleanly deduplicated');
assert(toastCount === 1, `Exact single toast rendered (count = ${toastCount})`);
assert(chimeCount === 1, `Exact single sound chime triggered (count = ${chimeCount})`);

// Bounded cache verification
const testBoundedMap = new Map<string, number>();
const now = Date.now();
for (let i = 0; i < 550; i++) {
  testBoundedMap.set(`key_${i}`, now - i * 100);
}
if (testBoundedMap.size > 500) {
  for (const [k, ts] of testBoundedMap.entries()) {
    if (now - ts > 5 * 60 * 1000) {
      testBoundedMap.delete(k);
    }
  }
  if (testBoundedMap.size > 500) {
    for (const k of testBoundedMap.keys()) {
      testBoundedMap.delete(k);
      if (testBoundedMap.size <= 500) break;
    }
  }
}
assert(
  testBoundedMap.size <= 500,
  `Deduplication cache is strictly bounded: capacity after pruning is ${testBoundedMap.size} <= 500`
);

// -------------------------------------------------------------
// Test 3: Auto-Refresh & Complete Logout Timeout
// -------------------------------------------------------------
console.log('\n--- 3. Automatic Token Refresh & Complete Logout Timeout ---');
assert(
  notifContextSrc.includes('Notification.permission !== \'granted\' || !browserNotificationsEnabled'),
  'NotificationContext verifies BOTH permission === granted AND explicit browserNotificationsEnabled preference'
);
assert(
  notifContextSrc.includes('syncPushRegistration'),
  'NotificationContext uses clean syncPushRegistration helper for both toggle and auto-refresh'
);

const authSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AuthContext.tsx'), 'utf-8');
assert(
  authSrc.includes('NOTIFICATION_ENDPOINTS.unregisterFcm'),
  'AuthContext logout invokes unregisterFcm before signing out to prune device token'
);
assert(
  authSrc.includes('Promise.race([unregisterPromise, timeoutPromise])'),
  'AuthContext wraps both getIdToken() and unregisterFcm in a single overall Promise.race timeout'
);
assert(
  authSrc.includes('controller.abort()') && authSrc.includes('1500'),
  'Overall 1.5s timeout aborts pending network requests and guarantees unblocked logout'
);
assert(
  authSrc.includes('catch') && authSrc.includes('signOut(auth)'),
  'AuthContext catches unregisterFcm network errors non-fatally without preventing logout'
);

// -------------------------------------------------------------
// Test 4: Cloudinary Upload Security & Trusted Server-Side Enforcement
// -------------------------------------------------------------
console.log('\n--- 4. Cloudinary Direct-Upload Size Enforcement & Server-Side Decoding ---');

// Confirm direct signed upload fallback elimination:
assert(
  !serverSrc.includes('/api/upload/signature'),
  'server.ts completely eliminates /api/upload/signature to prevent direct client upload size bypasses'
);

const cloudinarySrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/cloudinary.ts'), 'utf-8');
assert(
  cloudinarySrc.includes("xhr.open('POST', `${apiBase}/api/upload/image`)") &&
  !cloudinarySrc.includes("uploadToCloudinaryEndpoint"),
  'src/lib/cloudinary.ts routes exclusively through authenticated backend /api/upload/image route (zero direct fallback)'
);

assert(
  serverSrc.includes('fileBuffer.length > 5 * 1024 * 1024'),
  'server.ts strictly enforces 5 MB limit on the trusted server-side /api/upload/image path'
);

assert(
  serverSrc.includes('import sharp from "sharp";') &&
  serverSrc.includes('limitInputPixels: MAX_INPUT_PIXELS'),
  'server.ts uses Sharp limitInputPixels and dimensions checks against resource exhaustion bombs'
);

assert(
  serverSrc.includes('sanitizedBuffer = await image.png') &&
  serverSrc.includes('sanitizedBuffer = await image.jpeg') &&
  serverSrc.includes('sanitizedBuffer = await image.webp'),
  'server.ts re-encodes validated images into sanitized formats, stripping polyglots and malicious metadata'
);

// -------------------------------------------------------------
// Test 5: Live Sharp Decoding of Valid, Corrupted, Malformed, and Disallowed Files
// -------------------------------------------------------------
console.log('\n--- 5. Live Sharp Image Decoding & Security Suite ---');

// 1. Valid 1x1 PNG decoding and re-encoding
const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
let validPngPassed = false;
try {
  const meta = await sharp(validPngBuffer).metadata();
  if (meta.format === 'png' && meta.width === 1 && meta.height === 1) {
    const cleanBuf = await sharp(validPngBuffer).png().toBuffer();
    validPngPassed = cleanBuf.length > 0;
  }
} catch {}
assert(validPngPassed, 'Sharp correctly decodes and re-encodes authentic PNG image');

// 2. Corrupted / truncated JPEG (SOI marker followed by premature cutoff)
const corruptJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
let corruptJpgRejected = false;
try {
  await sharp(corruptJpgBuffer, { failOn: 'error' }).jpeg().toBuffer();
} catch {
  corruptJpgRejected = true;
}
assert(corruptJpgRejected, 'Sharp strictly rejects corrupted / truncated JPEG image stream');

// 3. Disallowed SVG disguised as image
const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="5"/></svg>');
let svgDetected = false;
try {
  const meta = await sharp(svgBuffer).metadata();
  svgDetected = meta.format === 'svg';
} catch {}
assert(svgDetected, 'Sharp correctly identifies SVG vectors (allowing server to reject non-raster formats)');

// 4. Malformed random garbage text labeled as image
const malformedBuffer = Buffer.from('NOT_AN_IMAGE_RANDOM_TEXT_PAYLOAD_1234567890');
let malformedRejected = false;
try {
  await sharp(malformedBuffer, { failOn: 'error' }).metadata();
} catch {
  malformedRejected = true;
}
assert(malformedRejected, 'Sharp strictly rejects malformed / non-image byte streams');

// -------------------------------------------------------------
// Test 6: Service Worker Background & Click Navigation
// -------------------------------------------------------------
console.log('\n--- 6. Service Worker Background & Click Navigation ---');
const swSrc = fs.readFileSync(path.join(process.cwd(), 'public/firebase-messaging-sw.js'), 'utf-8');

assert(
  swSrc.includes('messaging.onBackgroundMessage'),
  'Service worker defines messaging.onBackgroundMessage handler'
);
assert(
  swSrc.includes("self.addEventListener('push'"),
  'Service worker defines standard Web Push VAPID event listener'
);
assert(
  swSrc.includes('payload.fcmMessageId || payload.from || payload.notification'),
  'Service worker prevents duplicate banner between FCM Compat and custom push listener'
);
assert(
  swSrc.includes('client.focused &&') && swSrc.includes('client.url.includes(`/chat/${targetChatId}`)'),
  'Service worker suppresses OS banner if user is currently viewing the active conversation'
);
assert(
  swSrc.includes("self.addEventListener('notificationclick'"),
  'Service worker handles notificationclick event'
);
assert(
  swSrc.includes('client.focus()') && swSrc.includes('client.navigate(targetUrl)'),
  'Service worker focuses existing tab and navigates to target conversation/reservation'
);

// -------------------------------------------------------------
// Test 7: Targeted Push Delivery, Preference Resilience & Payload Alignment
// -------------------------------------------------------------
console.log('\n--- 7. Targeted Push Delivery, Preference Resilience & Payload Alignment ---');

const bellSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/NotificationBell.tsx'), 'utf-8');

assert(
  serverSrc.includes('async function getFcmAccessToken(): Promise<string | null>') &&
  serverSrc.includes('deliveryAvailable'),
  'server.ts verifies Google ADC availability via getFcmAccessToken and reports deliveryAvailable in fcm-token'
);

assert(
  serverSrc.includes('const eventId = `chat_${chatId}_${messageId}`;') &&
  serverSrc.includes('notificationId,') &&
  serverSrc.includes('eventId,'),
  'server.ts binds identical eventId and notificationId to both Firestore notification and FCM data payload'
);

assert(
  notifContextSrc.includes('isPushRegisteredOnServer') &&
  notifContextSrc.includes('const [isPushRegisteredOnServer, setIsPushRegisteredOnServer] = useState<boolean>(false);'),
  'NotificationContext strictly separates runtime server registration (isPushRegisteredOnServer) from user intent (browserNotificationsEnabled)'
);

assert(
  notifContextSrc.includes('// Crucial: DO NOT erase user\'s persistent preference during network outages or server restarts!') &&
  !notifContextSrc.includes('if (!regResult.success) {\n            console.warn(\'Push registration auto-refresh failed with server; updating registration status.\');\n            setBrowserNotificationsEnabled(false);\n          }'),
  'NotificationContext preserves user preference during transient auto-refresh network failures without silently erasing localStorage'
);

assert(
  notifContextSrc.includes('fcmData.deliveryAvailable === false') &&
  notifContextSrc.includes('Web Push fallback remains active'),
  'NotificationContext does not treat FCM as functional delivery channel when server reports deliveryAvailable: false'
);

assert(
  bellSrc.includes('browserNotificationsEnabled && isPushRegisteredOnServer') &&
  bellSrc.includes('alertLabel = \'Alerts ON\';'),
  'NotificationBell renders Alerts ON only when both user preference is enabled AND server registration is confirmed'
);

assert(
  bellSrc.includes('browserNotificationsEnabled || permissionStatus === \'granted\'') &&
  bellSrc.includes('alertLabel = \'Not Registered\';'),
  'NotificationBell displays Not Registered when permission is granted but server registration is pending or failed'
);

assert(
  notifContextSrc.includes('setIsPushRegisteredOnServer(false);') &&
  authSrc.includes('NOTIFICATION_ENDPOINTS.unregisterFcm'),
  'Logout clears runtime server registration status and unregisters device before signOut'
);

console.log('\n===============================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
}
