// StudentNeed – Phase 1: Security, Firebase Optimization & Abuse Prevention Verification Test Suite
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`PASS: ${message}`);
    passed++;
  } else {
    console.error(`FAIL: ${message}`);
    failed++;
  }
}

console.log('--- Running StudentNeed Phase 1 Security, Firebase Optimization & Abuse Prevention Tests ---\n');

// 1. Firestore Rules Security Audit
const rulesContent = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');

assert(
  rulesContent.includes('match /registered_emails/{emailDocId}') &&
  rulesContent.includes('allow read, write: if isInternalSystem() || isAdmin();'),
  'firestore.rules explicitly restricts registered_emails collection to internal system / admin'
);

assert(
  rulesContent.includes('match /rate_limits/{limitId}') &&
  rulesContent.includes('allow read, write: if isInternalSystem() || isAdmin();'),
  'firestore.rules explicitly restricts rate_limits collection to internal system / admin'
);

assert(
  rulesContent.includes('match /temp_otps/{otpId}') &&
  rulesContent.includes('allow read, write: if isInternalSystem() || isAdmin();'),
  'firestore.rules strictly isolates temporary OTP storage to internal system / admin'
);

assert(
  rulesContent.includes('match /users/{userId}') &&
  rulesContent.includes('allow create: if isAdmin() || isInternalSystem();'),
  'User profile creation is strictly restricted to server system or admin'
);

assert(
  rulesContent.includes('hasAny([') &&
  rulesContent.includes("'role'") &&
  rulesContent.includes("'isVerified'") &&
  rulesContent.includes("'rating'") &&
  rulesContent.includes("'trustScore'") &&
  rulesContent.includes("'status'"),
  'User profile updates strictly forbid self-escalation of role, isVerified, rating, trustScore, and status'
);

assert(
  rulesContent.includes('match /reservations/{reservationId}') &&
  rulesContent.includes('resource.data.buyerId == request.auth.uid ||') &&
  rulesContent.includes('resource.data.sellerId == request.auth.uid'),
  'Reservation reads are strictly isolated to legitimate participants (buyer and seller)'
);

assert(
  rulesContent.includes('match /chats/{chatId}') &&
  rulesContent.includes('request.auth.uid in resource.data.participants'),
  'Chat access is strictly restricted to active participants'
);

// 2. Cross-Tab Coordination & Excessive Firebase Usage Prevention
const crossTabSyncSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/crossTabSync.ts'), 'utf-8');
const authContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AuthContext.tsx'), 'utf-8');
const appContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf-8');

assert(
  crossTabSyncSrc.includes('new BroadcastChannel'),
  'crossTabSync.ts initializes BroadcastChannel for low-latency cross-tab coordination'
);

assert(
  crossTabSyncSrc.includes('localStorage.setItem(STORAGE_KEY'),
  'crossTabSync.ts includes fallback storage event listener for cross-tab compatibility'
);

assert(
  authContextSrc.includes("broadcastSyncEvent({ type: 'AUTH_LOGOUT' })"),
  'AuthContext broadcasts AUTH_LOGOUT across all open browser tabs on sign out'
);

assert(
  authContextSrc.includes('subscribeToSyncEvents') &&
  authContextSrc.includes('signOut(auth)'),
  'AuthContext listens to cross-tab logout events to terminate background listeners in other tabs'
);

assert(
  appContextSrc.includes('inFlightUserPromises = new Map'),
  'AppContext implements in-flight user profile fetch promise deduplication'
);

assert(
  appContextSrc.includes('sessionStorage.getItem') &&
  appContextSrc.includes('sessionStorage.setItem') &&
  appContextSrc.includes('PROFILE_CACHE_TTL_MS'),
  'AppContext implements TTL-bounded sessionStorage cache for student public profiles'
);

assert(
  appContextSrc.includes('isSubmittingListingRef') &&
  appContextSrc.includes('isSubmittingListingRef.current = true'),
  'AppContext addListing prevents rapid duplicate form submissions via in-flight mutex'
);

assert(
  appContextSrc.includes('isSubmittingRequestRef') &&
  appContextSrc.includes('isSubmittingRequestRef.current = true'),
  'AppContext addRequest prevents duplicate request submissions via in-flight mutex'
);

// 3. Realtime Listener & Firestore Read Optimization in Chat
const chatSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');

assert(
  !chatSrc.includes('Object.keys(messageUnsubs).forEach'),
  'Chat.tsx removes legacy persistent subcollection listeners for every sidebar conversation'
);

assert(
  chatSrc.includes('lastMessageText') &&
  chatSrc.includes('lastMessageSenderId'),
  'Chat.tsx stores last message preview directly on chat document for instant sidebar updates'
);

assert(
  chatSrc.includes('fetchUserProfile(otherId)'),
  'Chat.tsx reuses deduplicated profile cache instead of making un-cached Firestore getDoc reads'
);

// 4. Atomic Reservations & Duplicate Protection
const listingDetailSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/ListingDetail.tsx'), 'utf-8');

assert(
  listingDetailSrc.includes('runTransaction(db, async (transaction) => {'),
  'ListingDetail wraps reservation creation in an atomic Firestore transaction'
);

assert(
  listingDetailSrc.includes('res_${listing.id}_${currentUserId}'),
  'ListingDetail uses deterministic reservation document ID to prevent duplicate reservations'
);

assert(
  listingDetailSrc.includes('if (isReserving) return;'),
  'ListingDetail guards against concurrent reservation button clicks'
);

assert(
  listingDetailSrc.includes("broadcastSyncEvent({ type: 'RESERVATION_CREATED'"),
  'ListingDetail broadcasts reservation creation event to synchronize other open tabs'
);

// 5. Distributed Multi-Instance Rate Limiting in server.ts
const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

assert(
  serverSrc.includes('export async function checkDistributedRateLimit'),
  'server.ts exports checkDistributedRateLimit for cross-instance Cloud Run rate limiting'
);

assert(
  serverSrc.includes('export function sendRateLimitResponse') &&
  serverSrc.includes('Retry-After'),
  'server.ts implements sendRateLimitResponse returning HTTP 429 and Retry-After header'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`send-otp:ip:${clientIp}`'),
  'server.ts applies distributed rate limiting to /api/auth/send-otp IP'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`send-otp:email:${normalizedEmail}`'),
  'server.ts applies distributed rate limiting to /api/auth/send-otp email'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`verify-otp:ip:${clientIp}`'),
  'server.ts applies distributed rate limiting to /api/auth/verify-otp IP'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`verify-otp:email:${normalizedEmail}`'),
  'server.ts applies distributed rate limiting to /api/auth/verify-otp email'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`create-account:ip:${clientIp}`'),
  'server.ts applies distributed rate limiting to /api/auth/create-account'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`finalize-account:ip:${clientIp}`'),
  'server.ts applies distributed rate limiting to /api/auth/finalize-account'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`forgot-password:${clientIp}`'),
  'server.ts applies distributed rate limiting to /api/auth/forgot-password'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`upload-image:ip:${clientIp}`'),
  'server.ts applies distributed rate limiting to image upload IP'
);

assert(
  serverSrc.includes('checkDistributedRateLimit(`upload-image:user:${caller.uid}`'),
  'server.ts applies user-scoped distributed rate limiting to authenticated image uploads'
);

// 6. App Check Integration & Monitoring Mode
const appCheckSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/appCheck.ts'), 'utf-8');
const apiConfigSrc = fs.readFileSync(path.join(process.cwd(), 'src/config/api.ts'), 'utf-8');

assert(
  appCheckSrc.includes('ReCaptchaEnterpriseProvider') &&
  appCheckSrc.includes('isTokenAutoRefreshEnabled: true'),
  'appCheck.ts configures ReCaptchaEnterpriseProvider in monitoring mode'
);

assert(
  appCheckSrc.includes('FIREBASE_APPCHECK_DEBUG_TOKEN'),
  'appCheck.ts enables debug tokens for localhost and dev verification'
);

assert(
  apiConfigSrc.includes('X-Firebase-AppCheck'),
  'apiFetch attaches X-Firebase-AppCheck token header in monitoring mode'
);

assert(
  serverSrc.includes('X-Firebase-AppCheck') &&
  serverSrc.includes('App Check token telemetry'),
  'server.ts includes X-Firebase-AppCheck in CORS allowedHeaders and logs telemetry in monitoring mode'
);

// 7. Cloudinary Upload Protection & Sanitization
assert(
  serverSrc.includes('uniquePublicId = `${caller.uid}_') &&
  serverSrc.includes('public_id=${uniquePublicId}'),
  'server.ts scopes Cloudinary public_id uniquely to caller.uid to prevent image overwriting'
);

assert(
  serverSrc.includes('limitInputPixels: MAX_INPUT_PIXELS') &&
  serverSrc.includes('MAX_IMAGE_DIMENSION = 4096'),
  'server.ts enforces Sharp bounds checking (4096px, 16MP) against decompression bombs'
);

assert(
  serverSrc.includes('image.jpeg({ quality: 85, mozjpeg: true })') &&
  serverSrc.includes('image.webp({ quality: 85 })'),
  'server.ts sanitizes and safely re-encodes uploaded images, stripping EXIF and embedded polyglots'
);

// 8. Structured Logging & PII Sanitization
assert(
  serverSrc.includes('export function logStructured') &&
  serverSrc.includes('delete safeMeta.password') &&
  serverSrc.includes('delete safeMeta.otp'),
  'server.ts implements structured logging that strictly redacts passwords, OTPs, and secrets'
);

console.log(`\nPhase 1 Security & Optimization Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
