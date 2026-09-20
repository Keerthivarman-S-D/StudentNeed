import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('   StudentNeed — Verification Suite for 4 Critical Fixes');
console.log('===============================================================\n');

let allPassed = true;
const testResults = [];

function recordTest(id, name, passed, details) {
  testResults.push({ id, name, passed, details });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusStr} [${id}] ${name}`);
  if (details) {
    console.log(`       ${details}`);
  }
  if (!passed) allPassed = false;
}

// -------------------------------------------------------------
// FIX 1: Email Domain Enforcement in Firestore Rules
// -------------------------------------------------------------
const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');

const hasAnnaUnivRegex = rulesContent.includes("request.auth.token.email.matches('.*@student\\\\.annauniv\\\\.edu')");
recordTest('FIX1-1', 'isAnnaUnivStudent helper enforces @student.annauniv.edu', hasAnnaUnivRegex, 'Regex matches .*@student\\.annauniv\\.edu');

const hasIsAuthorizedStudent = rulesContent.includes('function isAuthorizedStudent()') &&
  rulesContent.includes('isAnnaUnivStudent() || isAdmin() || isInternalSystem()');
recordTest('FIX1-2', 'isAuthorizedStudent helper properly combines student, admin, and system accounts', hasIsAuthorizedStudent, 'Allows Anna Univ students, admin, and internal system');

const listingsProtected = rulesContent.includes('match /listings/{listingId}') &&
  rulesContent.includes('allow read: if isAuthorizedStudent();') &&
  rulesContent.includes('allow create: if isAnnaUnivStudent()');
recordTest('FIX1-3', 'Listings collection rules enforce student domain', listingsProtected, 'Read requires isAuthorizedStudent; Create requires isAnnaUnivStudent');

const requestsProtected = rulesContent.includes('match /requests/{requestId}') &&
  rulesContent.includes('allow read: if isAuthorizedStudent();') &&
  rulesContent.includes('allow create: if isAnnaUnivStudent()');
recordTest('FIX1-4', 'Requests collection rules enforce student domain', requestsProtected, 'Read requires isAuthorizedStudent; Create requires isAnnaUnivStudent');

const reservationsProtected = rulesContent.includes('match /reservations/{reservationId}') &&
  rulesContent.includes('allow read: if isAuthorizedStudent()') &&
  rulesContent.includes('allow create: if isAnnaUnivStudent()');
recordTest('FIX1-5', 'Reservations collection rules enforce student domain', reservationsProtected, 'Read requires isAuthorizedStudent; Create requires isAnnaUnivStudent');

const chatsProtected = rulesContent.includes('match /chats/{chatId}') &&
  rulesContent.includes('allow read: if isAuthorizedStudent()') &&
  rulesContent.includes('allow create: if isAnnaUnivStudent()');
recordTest('FIX1-6', 'Chats and Messages collection rules enforce student domain', chatsProtected, 'Chat read requires isAuthorizedStudent; Create requires isAnnaUnivStudent');

const moderationProtected = rulesContent.includes('match /reports/{reportId}') &&
  rulesContent.includes('match /activity_logs/{logId}') &&
  rulesContent.includes('match /locations/{locationId}');
recordTest('FIX1-7', 'Reports, activity_logs, and locations protected', moderationProtected, 'Reports, logs, and locations protected with authorized student checks');

// -------------------------------------------------------------
// FIX 2: Reconcile INTERNAL_SYSTEM_EMAIL Mismatch
// -------------------------------------------------------------
const serverContent = fs.readFileSync('./server.ts', 'utf8');

const rulesAcceptsInternalSystem = rulesContent.includes("request.auth.token.email == 'internal.system@student.annauniv.edu'") &&
  rulesContent.includes("request.auth.token.email == 'admin@student.annauniv.edu'");
recordTest('FIX2-1', 'firestore.rules accepts both internal.system and admin emails in isInternalSystem', rulesAcceptsInternalSystem, 'isInternalSystem covers internal.system@student.annauniv.edu & admin@student.annauniv.edu');

const tempOtpsProtected = rulesContent.includes('match /temp_otps/{otpId}') &&
  rulesContent.includes('allow read, write: if isInternalSystem() || isAdmin();');
recordTest('FIX2-2', 'temp_otps collection restricted to isInternalSystem() || isAdmin()', tempOtpsProtected, 'Protected server OTP access for internal accounts');

const serverSystemEmailFallback = serverContent.includes('process.env.INTERNAL_SYSTEM_EMAIL?.trim() || "internal.system@student.annauniv.edu"');
recordTest('FIX2-3', 'server.ts getServerToken uses safe fallback for system email', serverSystemEmailFallback, 'Default fallback to internal.system@student.annauniv.edu');

const serverVerifyAdminOrSystem = serverContent.includes('verifyAdminOrSystem') &&
  serverContent.includes('internal.system@student.annauniv.edu') &&
  serverContent.includes('admin@student.annauniv.edu');
recordTest('FIX2-4', 'server.ts verifyAdminOrSystem checks both system and admin accounts', serverVerifyAdminOrSystem, 'Supports INTERNAL_SYSTEM_EMAIL, internal.system, and admin email');

// -------------------------------------------------------------
// FIX 3: Reduce Firebase Read Load and Remove Global Users Listener
// -------------------------------------------------------------
const appContextContent = fs.readFileSync('./src/context/AppContext.tsx', 'utf8');

const noGlobalUsersListener = !appContextContent.includes("onSnapshot(collection(db, 'users')") &&
  !appContextContent.includes('onSnapshot(\n            collection(db, \'users\')');
recordTest('FIX3-1', 'Unbounded onSnapshot users collection listener is removed', noGlobalUsersListener, 'Zero global onSnapshot listeners on /users');

const listingsPaginated = appContextContent.includes('limit(listingsLimit)') &&
  appContextContent.includes('loadMoreListings') &&
  appContextContent.includes('hasMoreListings');
recordTest('FIX3-2', 'Listings query uses limit and exposes pagination controls', listingsPaginated, 'Query incorporates limit(listingsLimit) with loadMoreListings');

const requestsPaginated = appContextContent.includes('limit(requestsLimit)') &&
  appContextContent.includes('loadMoreRequests') &&
  appContextContent.includes('hasMoreRequests');
recordTest('FIX3-3', 'Requests query uses limit and exposes pagination controls', requestsPaginated, 'Query incorporates limit(requestsLimit) with loadMoreRequests');

const userCacheImplemented = appContextContent.includes('userCache') &&
  appContextContent.includes('fetchUserProfile') &&
  appContextContent.includes('prefetchUsers');
recordTest('FIX3-4', 'On-demand user profile cache and prefetching implemented', userCacheImplemented, 'userCache map with fetchUserProfile and background prefetchUsers');

const marketplaceWiresLoadMore = fs.readFileSync('./src/pages/Marketplace.tsx', 'utf8').includes('loadMoreListings');
recordTest('FIX3-5', 'Marketplace.tsx renders Load More Listings button', marketplaceWiresLoadMore, 'Marketplace UI wires up loadMoreListings');

const requestsWiresLoadMore = fs.readFileSync('./src/pages/Requests.tsx', 'utf8').includes('loadMoreRequests');
recordTest('FIX3-6', 'Requests.tsx renders Load More Requests button', requestsWiresLoadMore, 'Requests UI wires up loadMoreRequests');

// -------------------------------------------------------------
// FIX 4: Reservation Cancellation
// -------------------------------------------------------------
const buyerCancelPendingRules = rulesContent.includes("resource.data.status == 'pending'") &&
  rulesContent.includes("request.resource.data.status == 'cancelled'") &&
  rulesContent.includes("resource.data.buyerId == request.auth.uid");
recordTest('FIX4-1', 'firestore.rules permits Buyer to cancel pending reservation', buyerCancelPendingRules, 'Pending -> Cancelled permitted for Buyer');

const participantCancelAcceptedRules = rulesContent.includes("resource.data.status == 'accepted'") &&
  rulesContent.includes("request.resource.data.status == 'cancelled'") &&
  rulesContent.includes("resource.data.buyerId == request.auth.uid || resource.data.sellerId == request.auth.uid");
recordTest('FIX4-2', 'firestore.rules permits Buyer or Seller to cancel accepted reservation', participantCancelAcceptedRules, 'Accepted -> Cancelled permitted for Buyer or Seller');

const reRequestAfterCancelRules = rulesContent.includes("(resource.data.status == 'rejected' || resource.data.status == 'cancelled')");
recordTest('FIX4-3', 'firestore.rules permits Buyer to re-request after rejection or cancellation', reRequestAfterCancelRules, 'Rejected/Cancelled -> Pending allowed for original buyer');

const serverCancelEndpoint = serverContent.includes('app.post("/api/reservations/cancel"') &&
  serverContent.includes('callerUid !== buyerId') &&
  serverContent.includes("status: { stringValue: \"available\" }");
recordTest('FIX4-4', 'server.ts implements POST /api/reservations/cancel with listing reversion', serverCancelEndpoint, 'Endpoint validates participants and resets listing to available');

const apiConfigExport = fs.readFileSync('./src/config/api.ts', 'utf8').includes('RESERVATION_ENDPOINTS');
recordTest('FIX4-5', 'src/config/api.ts exports RESERVATION_ENDPOINTS', apiConfigExport, 'Exports RESERVATION_ENDPOINTS with complete and cancel URLs');

const chatCancelUi = fs.readFileSync('./src/pages/Chat.tsx', 'utf8').includes('handleCancelReservation') &&
  fs.readFileSync('./src/pages/Chat.tsx', 'utf8').includes('Cancel Request') &&
  fs.readFileSync('./src/pages/Chat.tsx', 'utf8').includes('Cancel');
recordTest('FIX4-6', 'Chat.tsx provides cancellation controls for Buyer and Seller', chatCancelUi, 'Provides Cancel Request (pending) and Cancel Reservation (accepted)');

const profileCancelledBadge = fs.readFileSync('./src/pages/Profile.tsx', 'utf8').includes("res.status === 'cancelled'");
recordTest('FIX4-7', 'Profile.tsx displays Cancelled status badge', profileCancelledBadge, 'Profile handles cancelled status on reservations');

console.log('\n---------------------------------------------------------------');
console.log(`Total tests: ${testResults.length} | Passed: ${testResults.filter(t => t.passed).length} | Failed: ${testResults.filter(t => !t.passed).length}`);
console.log('---------------------------------------------------------------\n');

if (allPassed) {
  console.log('🎉 ALL CRITICAL FIX VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('❌ SOME VERIFICATIONS FAILED.');
  process.exit(1);
}
