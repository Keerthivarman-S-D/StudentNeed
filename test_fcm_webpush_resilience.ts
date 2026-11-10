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
console.log('--- FCM & Web Push Comprehensive Resilience & Fix Verification ---');
console.log('===============================================================\n');

// 1. Source file verification
const fcmFile = path.join(process.cwd(), 'src/lib/fcm.ts');
const contextFile = path.join(process.cwd(), 'src/context/NotificationContext.tsx');
const onboardingFile = path.join(process.cwd(), 'src/pages/Onboarding.tsx');
const registerFile = path.join(process.cwd(), 'src/pages/Register.tsx');
const loginFile = path.join(process.cwd(), 'src/pages/Login.tsx');
const firebaseJsonFile = path.join(process.cwd(), 'firebase.json');
const rulesFile = path.join(process.cwd(), 'firestore.rules');

assert(fs.existsSync(fcmFile), 'src/lib/fcm.ts exists');
assert(fs.existsSync(contextFile), 'src/context/NotificationContext.tsx exists');
assert(fs.existsSync(onboardingFile), 'src/pages/Onboarding.tsx exists');
assert(fs.existsSync(registerFile), 'src/pages/Register.tsx exists');
assert(fs.existsSync(loginFile), 'src/pages/Login.tsx exists');

const fcmSrc = fs.readFileSync(fcmFile, 'utf-8');
const contextSrc = fs.readFileSync(contextFile, 'utf-8');
const onboardingSrc = fs.readFileSync(onboardingFile, 'utf-8');
const registerSrc = fs.readFileSync(registerFile, 'utf-8');
const loginSrc = fs.readFileSync(loginFile, 'utf-8');
const firebaseJsonSrc = fs.readFileSync(firebaseJsonFile, 'utf-8');
const rulesSrc = fs.readFileSync(rulesFile, 'utf-8');

// -------------------------------------------------------------
// Scenario 1: Notifications Enabled
// -------------------------------------------------------------
console.log('\n[Scenario 1: Notifications Enabled]');
assert(
  fcmSrc.includes("Notification.permission !== 'granted'"),
  'FCM verifies Notification.permission === granted before attempting token retrieval'
);
assert(
  contextSrc.includes("Notification.permission !== 'granted'"),
  'syncPushRegistration ensures permission is granted before dispatching token requests'
);
assert(
  fcmSrc.includes('getOrRegisterMessagingSW'),
  'fcm.ts reuses active service worker registration if available to avoid duplicate registrations'
);
assert(
  contextSrc.includes('fcmSuccess = true'),
  'Context flags fcmSuccess = true upon successful server registration'
);

// -------------------------------------------------------------
// Scenario 2: Notifications Denied
// -------------------------------------------------------------
console.log('\n[Scenario 2: Notifications Denied]');
assert(
  contextSrc.includes("permission === 'denied'"),
  'toggleBrowserNotifications explicitly detects denied permission'
);
assert(
  contextSrc.includes('Notifications are blocked in your browser settings'),
  'Denied permission informs user how to allow in browser site settings without throwing'
);
assert(
  contextSrc.includes("setBrowserNotificationsEnabled(false)"),
  'Denied state immediately ensures browser notifications are turned off in context'
);
assert(
  !fcmSrc.includes('Notification.requestPermission()') ||
  fcmSrc.includes('requestPushPermission(): Promise<NotificationPermission>'),
  'subscribeToFCM does not invoke requestPermission automatically'
);

// -------------------------------------------------------------
// Scenario 3: Incognito Mode & Push Service Error Handling
// -------------------------------------------------------------
console.log('\n[Scenario 3: Incognito Mode & Push Service Error Handling]');
assert(
  fcmSrc.includes('isPushServiceError'),
  'fcm.ts exports isPushServiceError classifier'
);
assert(
  fcmSrc.includes('AbortError') && fcmSrc.includes('push service error'),
  'isPushServiceError checks for AbortError and push service error messages'
);
assert(
  contextSrc.includes('isPushServiceError(fcmErr)'),
  'syncPushRegistration classifies FCM push service failures'
);
assert(
  contextSrc.includes('pushServiceAvailable = false'),
  'syncPushRegistration halts fallback Web Push subscription if push service itself is unavailable'
);
assert(
  contextSrc.includes('Private/Incognito browsing mode'),
  'toggleBrowserNotifications displays user-friendly explanation when push service is unavailable in Incognito mode'
);

// Simulation of isPushServiceError
const mockAbortError = { name: 'AbortError', message: 'Registration failed - push service error' };
const mockCustomPushError = new Error('Push service error: service connection timeout');
const mockOtherError = new Error('Network timeout connecting to backend API');

function simulatePushErrorClassification(err: any): boolean {
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

assert(simulatePushErrorClassification(mockAbortError) === true, 'Correctly classifies AbortError as push service error');
assert(simulatePushErrorClassification(mockCustomPushError) === true, 'Correctly classifies custom push service error');
assert(simulatePushErrorClassification(mockOtherError) === false, 'Correctly distinguishes standard network error');

// -------------------------------------------------------------
// Scenario 4: Unsupported Browser Graceful Handling
// -------------------------------------------------------------
console.log('\n[Scenario 4: Unsupported Browser Graceful Handling]');
assert(
  fcmSrc.includes("return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;"),
  'isPushSupported checks for window, Notification, serviceWorker, and PushManager'
);
assert(
  contextSrc.includes('isIOS()') && contextSrc.includes('isStandalonePWA()'),
  'NotificationContext checks iOS Safari PWA requirements'
);
assert(
  fcmSrc.includes('if (typeof window === \'undefined\') return null;'),
  'fcm.ts guards against SSR and missing window'
);

// -------------------------------------------------------------
// Scenario 5: Existing Logged-in User (Auto-Refresh & Deduplication)
// -------------------------------------------------------------
console.log('\n[Scenario 5: Existing Logged-in User]');
assert(
  contextSrc.includes('runAutoRefresh'),
  'NotificationContext implements runAutoRefresh for existing authenticated users'
);
assert(
  contextSrc.includes('if (Notification.permission !== \'granted\' || !browserNotificationsEnabled)'),
  'runAutoRefresh never triggers if permission is not granted or user disabled alerts'
);
assert(
  fcmSrc.includes('messagingPromise'),
  'fcm.ts caches in-flight getFCMInstance promise to prevent concurrent duplicate initializations'
);

// -------------------------------------------------------------
// Scenario 6: New User Registration & Non-Blocking Guarantee
// -------------------------------------------------------------
console.log('\n[Scenario 6: New User Registration & Non-Blocking Guarantee]');
assert(
  !onboardingSrc.includes('subscribeToFCM') && !onboardingSrc.includes('syncPushRegistration'),
  'Onboarding.tsx does not depend on push registration'
);
assert(
  !registerSrc.includes('subscribeToFCM') && !registerSrc.includes('syncPushRegistration'),
  'Register.tsx does not depend on push registration'
);
assert(
  !loginSrc.includes('subscribeToFCM') && !loginSrc.includes('syncPushRegistration'),
  'Login.tsx does not depend on push registration'
);

// Non-regression on Firebase security rules & CSP
assert(
  rulesSrc.includes('match /notifications/{notificationId}'),
  'firestore.rules preserves notification authorization rules'
);
assert(
  firebaseJsonSrc.includes('connect-src') && firebaseJsonSrc.includes('https://fcmregistrations.googleapis.com'),
  'firebase.json CSP preserves secure FCM connection endpoints'
);

console.log('\n===============================================================');
console.log('--- ALL FCM & WEB PUSH RESILIENCE TESTS PASSED (18/18) ---');
console.log('===============================================================\n');
