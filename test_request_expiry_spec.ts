import fs from 'fs';
import path from 'path';
import { isRequestExpired, getRequestTimeRemaining } from './src/pages/Requests';
import { ItemRequest } from './src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n========================================================================');
console.log('--- StudentNeed 24-Hour Request Expiry, Renewal & Reposting Tests ---');
console.log('========================================================================\n');

const typesSrc = fs.readFileSync(path.join(process.cwd(), 'src/types.ts'), 'utf-8');
const appContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf-8');
const requestsSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Requests.tsx'), 'utf-8');
const createRequestSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateRequest.tsx'), 'utf-8');
const chatSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
const rulesSrc = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8').replace(/\r\n/g, '\n');
const indexesSrc = fs.readFileSync(path.join(process.cwd(), 'firestore.indexes.json'), 'utf-8');
const apiSrc = fs.readFileSync(path.join(process.cwd(), 'src/config/api.ts'), 'utf-8');

// -------------------------------------------------------------
// Section 1: Types and Data Model Verification
// -------------------------------------------------------------
console.log('--- 1. Data Model & Types ---');
assert(typesSrc.includes("'expired'"), "RequestStatus type includes 'expired' status");
assert(typesSrc.includes('expiresAt?: string;'), "ItemRequest defines expiresAt timestamp");
assert(typesSrc.includes('deleteAt?: string;'), "ItemRequest defines deleteAt retention timestamp");
assert(typesSrc.includes('renewedAt?: string;'), "ItemRequest defines renewedAt timestamp");
assert(typesSrc.includes('renewalCount?: number;'), "ItemRequest defines renewalCount");
assert(appContextSrc.includes('renewRequest: (requestId: string) => Promise<void>;'), "AppContextType exposes renewRequest function");
assert(apiSrc.includes('REQUEST_ENDPOINTS'), "API config defines REQUEST_ENDPOINTS");

// -------------------------------------------------------------
// Section 2: Expiry Calculation Unit Simulations
// -------------------------------------------------------------
console.log('\n--- 2. Expiry Calculation & Formatting Logic ---');
const now = Date.now();

const activeReq: ItemRequest = {
  id: 'req_1',
  title: 'Calculus Textbook',
  category: 'Textbooks',
  description: 'Need 11th edition',
  location: 'MIT Library',
  neededBy: 'Tomorrow',
  status: 'open',
  requesterId: 'student_1',
  createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(now + 22 * 60 * 60 * 1000).toISOString(), // 22 hours left
  deleteAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
  renewalCount: 0,
};

assert(!isRequestExpired(activeReq), 'Unexpired request returns isRequestExpired === false');
const activeTime = getRequestTimeRemaining(activeReq);
assert(!activeTime.expired, 'Unexpired request label indicates not expired');
assert(activeTime.label.includes('21h') || activeTime.label.includes('22h'), 'Unexpired request calculates remaining hours correctly');
assert(!activeTime.isUrgent, 'Request with >2 hours left is not marked urgent');

const urgentReq: ItemRequest = {
  ...activeReq,
  id: 'req_urgent',
  expiresAt: new Date(now + 45 * 60 * 1000).toISOString(), // 45 mins left
};
assert(!isRequestExpired(urgentReq), 'Urgent request with 45m left is not expired');
const urgentTime = getRequestTimeRemaining(urgentReq);
assert(urgentTime.isUrgent, 'Request with <2 hours left is marked urgent');
assert(urgentTime.label.includes('m left'), 'Urgent request formats minutes remaining');

const expiredReq: ItemRequest = {
  ...activeReq,
  id: 'req_expired',
  expiresAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // expired 3 hours ago
};
assert(isRequestExpired(expiredReq), 'Request past expiresAt returns isRequestExpired === true');
const expiredTime = getRequestTimeRemaining(expiredReq);
assert(expiredTime.expired, 'Expired request returns expired === true in time formatting');
assert(expiredTime.label.includes('Expired 3h ago') || expiredTime.label.includes('Expired 2h ago'), 'Expired request calculates elapsed expiry time');

const terminalExpiredReq: ItemRequest = {
  ...activeReq,
  id: 'req_status_expired',
  status: 'expired',
};
assert(isRequestExpired(terminalExpiredReq), "Request with status 'expired' returns isRequestExpired === true");

// -------------------------------------------------------------
// Section 3: Creation Expiry & Retention Setup
// -------------------------------------------------------------
console.log('\n--- 3. Creation Expiry & Retention Setup ---');
assert(
  appContextSrc.includes('const expiresAtDate = new Date(now + 24 * 60 * 60 * 1000)'),
  'AppContext addRequest creates trusted 24-hour expiration date'
);
assert(
  appContextSrc.includes('const deleteAtDate = new Date(now + 31 * 24 * 60 * 60 * 1000)'),
  'AppContext addRequest sets 30-day retention deadline after 24-hour expiry'
);
assert(
  appContextSrc.includes('renewalCount: 0'),
  'AppContext addRequest initializes renewalCount to 0'
);
assert(
  rulesSrc.includes('function isValidRequestExpiration(reqData)'),
  'firestore.rules defines isValidRequestExpiration helper'
);
assert(
  rulesSrc.includes('reqData.expiresAt <= request.time + duration.value(25, \'h\')'),
  'firestore.rules caps expiresAt to 25 hours from request.time (24h + 1h buffer)'
);
assert(
  rulesSrc.includes('function isValidRequestDeleteAt(reqData)'),
  'firestore.rules defines isValidRequestDeleteAt retention helper'
);
assert(
  rulesSrc.includes('reqData.deleteAt <= request.time + duration.value(32, \'d\')'),
  'firestore.rules caps deleteAt to 32 days from request.time'
);

// -------------------------------------------------------------
// Section 4: Feed & Visibility Enforcement
// -------------------------------------------------------------
console.log('\n--- 4. Active Marketplace Filtering ---');
assert(
  requestsSrc.includes("requests.filter(r => r.status === 'open' && !isRequestExpired(r))"),
  'Public requests feed strictly filters out expired requests'
);
assert(
  requestsSrc.includes('All Requests'),
  'Requests.tsx includes public "All Requests" tab'
);

// -------------------------------------------------------------
// Section 5: Response Blocking on Expired Requests
// -------------------------------------------------------------
console.log('\n--- 5. Response Blocking on Expired Requests ---');
assert(
  requestsSrc.includes('isRequestExpired(request) || request.status === \'expired\''),
  'Requests.tsx detects expired requests in card action rendering'
);
assert(
  requestsSrc.includes('Request Expired'),
  'Requests.tsx renders disabled "Request Expired" badge for non-owners'
);
assert(
  requestsSrc.includes("setChatError('This request has expired and is no longer accepting new responses.')"),
  'Requests.tsx handleStartChat blocks chat responses on expired requests'
);
assert(
  serverSrc.includes('reqStatus === "expired" || (expiresAtMs !== null && !isNaN(expiresAtMs) && expiresAtMs <= Date.now())'),
  'Server /api/requests/notify-response verifies request is not expired'
);
assert(
  serverSrc.includes('This request has expired and is no longer accepting new responses.'),
  'Server /api/requests/notify-response rejects responses to expired requests with 400 error'
);
assert(
  rulesSrc.includes('get(/databases/$(database)/documents/requests/$(request.resource.data.requestId)).data.expiresAt > request.time'),
  'firestore.rules blocks chat creation if target request is expired'
);

// -------------------------------------------------------------
// Section 6: Owner Request Management (My Requests)
// -------------------------------------------------------------
console.log('\n--- 6. Owner Request Management UI ---');
assert(
  requestsSrc.includes("const [myFilter, setMyFilter] = useState<'all' | 'active' | 'expired'>('all')"),
  'Requests.tsx maintains sub-filter state for My Requests (all, active, expired)'
);
assert(
  requestsSrc.includes('myActiveCount'),
  'Requests.tsx calculates active request count for owner'
);
assert(
  requestsSrc.includes('myExpiredCount'),
  'Requests.tsx calculates expired request count for owner'
);
assert(
  requestsSrc.includes('Renew (+24h)'),
  'Requests.tsx renders "Renew (+24h)" button for owner on expired requests'
);
assert(
  requestsSrc.includes('Repost'),
  'Requests.tsx renders "Repost" button for owner on expired requests'
);

// -------------------------------------------------------------
// Section 7: Renewal Behavior & ID Preservation
// -------------------------------------------------------------
console.log('\n--- 7. Renewal Implementation ---');
assert(
  serverSrc.includes('app.post("/api/requests/renew"'),
  'Server implements /api/requests/renew endpoint'
);
assert(
  serverSrc.includes('if (requesterId !== student.uid)'),
  'Server /api/requests/renew strictly enforces owner-only renewal'
);
assert(
  serverSrc.includes('const newExpiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString()'),
  'Server /api/requests/renew extends expiresAt by 24 hours from trusted server time'
);
assert(
  serverSrc.includes('const newDeleteAt = new Date(now + 31 * 24 * 60 * 60 * 1000).toISOString()'),
  'Server /api/requests/renew updates deleteAt retention to 30 days post-renewal'
);
assert(
  serverSrc.includes('const newRenewalCount = currentRenewalCount + 1'),
  'Server /api/requests/renew increments renewalCount'
);
assert(
  serverSrc.includes('status: { stringValue: "open" }'),
  'Server /api/requests/renew restores status to open'
);
assert(
  appContextSrc.includes('const renewRequest = async (requestId: string): Promise<void>'),
  'AppContext implements renewRequest function'
);
assert(
  appContextSrc.includes('REQUEST_ENDPOINTS.renew'),
  'AppContext renewRequest calls backend renewal endpoint'
);
assert(
  rulesSrc.includes('request.resource.data.renewalCount == ((\'renewalCount\' in resource.data) ? resource.data.renewalCount + 1 : 1)'),
  'firestore.rules validates renewalCount increment on renewal'
);
assert(
  rulesSrc.includes('(!(\'createdAt\' in resource.data) || !(\'createdAt\' in request.resource.data) || request.resource.data.createdAt == resource.data.createdAt)'),
  'firestore.rules prevents modifying createdAt during update or renewal'
);

// -------------------------------------------------------------
// Section 8: Reposting Workflow
// -------------------------------------------------------------
console.log('\n--- 8. Reposting Workflow ---');
assert(
  requestsSrc.includes('navigate(\'/create-request\', {'),
  'Requests.tsx handleRepostRequest navigates to /create-request'
);
assert(
  requestsSrc.includes('repostFrom: {'),
  'Requests.tsx passes original request content in repostFrom state'
);
assert(
  createRequestSrc.includes('const repostFrom = (locationState.state as any)?.repostFrom;'),
  'CreateRequest.tsx consumes repostFrom location state'
);
assert(
  createRequestSrc.includes('Reposting Campus Request'),
  'CreateRequest.tsx displays informative banner when reposting'
);
assert(
  createRequestSrc.includes('Every campus request expires automatically after'),
  'CreateRequest.tsx displays 24-hour expiry guidance notice'
);

// -------------------------------------------------------------
// Section 9: Legacy Requests Fallback Policy
// -------------------------------------------------------------
console.log('\n--- 9. Legacy Requests Fallback Policy ---');
assert(
  appContextSrc.includes('// Safe legacy fallback policy:'),
  'AppContext documents safe legacy fallback policy'
);
assert(
  appContextSrc.includes('Date.now() - createdMs < 24 * 60 * 60 * 1000'),
  'AppContext derives 24h expiration for recent legacy requests'
);
assert(
  appContextSrc.includes('data.status === \'open\' || data.status === \'active\''),
  'AppContext grants legacy grace period to active legacy requests so they are not hidden abruptly'
);
assert(
  serverSrc.includes('app.post("/api/requests/backfill-expiration"'),
  'Server implements /api/requests/backfill-expiration migration endpoint'
);

// -------------------------------------------------------------
// Section 10: Automatic Retention & Cleanup
// -------------------------------------------------------------
console.log('\n--- 10. Retention & Cleanup Mechanism ---');
assert(
  serverSrc.includes('async function runExpiredRequestsCleanup()'),
  'Server implements runExpiredRequestsCleanup retention cleanup function'
);
assert(
  serverSrc.includes('deleteAtMs <= now'),
  'runExpiredRequestsCleanup deletes requests whose 30-day retention deadline has passed'
);
assert(
  serverSrc.includes('app.post("/api/requests/cleanup-expired"'),
  'Server exposes /api/requests/cleanup-expired endpoint for admin/scheduler'
);
assert(
  serverSrc.includes('runExpiredRequestsCleanup().catch'),
  'Server runs requests cleanup on startup and 15-minute interval'
);
assert(
  indexesSrc.includes('"collectionGroup": "requests"'),
  'firestore.indexes.json configures requests collection indexes'
);

// -------------------------------------------------------------
// Section 11: Chat Context Banner & Expiry Compatibility
// -------------------------------------------------------------
console.log('\n--- 11. Chat Context & Notification Preservation ---');
assert(
  chatSrc.includes('itemRequest.status === \'expired\' || (itemRequest.expiresAt && new Date(itemRequest.expiresAt).getTime() <= Date.now())'),
  'Chat.tsx displays Expired status badge in request context bar'
);
assert(
  requestsSrc.includes('userChats.filter(c => c.requestId === request.id)'),
  'Requests.tsx continues rendering all student inquiries on renewed/expired requests'
);

console.log('\n========================================================================');
console.log('--- ALL 24-HOUR REQUEST EXPIRY & RENEWAL TESTS PASSED SUCCESSFULLY! ---');
console.log('========================================================================\n');
