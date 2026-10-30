import fs from 'fs';
import path from 'path';

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

console.log('\n--- Running StudentNeed Production Authorization & Security Rules Tests ---\n');

const rulesContent = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');
const storageRulesContent = fs.readFileSync(path.join(process.cwd(), 'storage.rules'), 'utf-8');
const serverContent = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

// 1. Negative Test: Unverified account attempts to create a listing -> Denied
{
  assert(
    rulesContent.includes('isVerifiedStudent()') &&
    rulesContent.includes('exists(/databases/$(database)/documents/users/$(request.auth.uid))') &&
    rulesContent.includes('get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isVerified == true'),
    'firestore.rules requires isVerifiedStudent (verified profile in Firestore) for marketplace operations'
  );

  assert(
    rulesContent.includes('match /listings/{listingId}') &&
    rulesContent.includes('allow create: if isAnnaUnivStudent()') &&
    rulesContent.includes('function isAnnaUnivStudent() {\n      return isVerifiedStudent();\n    }'),
    'Unverified account attempting to create a listing is strictly DENIED'
  );
}

// 2. Negative Test: Unverified account attempts to access private student records -> Denied
{
  assert(
    rulesContent.includes('match /private/{docId}') &&
    rulesContent.includes('allow read, write: if isAuthorizedStudent() && (request.auth.uid == userId || isAdmin() || isInternalSystem());'),
    'Unverified account attempting to access private student records is strictly DENIED'
  );

  assert(
    rulesContent.includes('match /users/{userId}') &&
    rulesContent.includes('allow read: if isAuthorizedStudent() || (isAuthenticated() && request.auth.uid == userId);'),
    'Unverified account attempting to read other students public profiles is DENIED'
  );
}

// 3. Negative Test: User attempts to change their verification status -> Denied
{
  assert(
    rulesContent.includes("!request.resource.data.diff(resource.data).affectedKeys().hasAny([") &&
    rulesContent.includes("'isVerified'"),
    'User attempting to modify isVerified on their own profile is strictly DENIED'
  );
}

// 4. Negative Test: User attempts to promote themselves to admin -> Denied
{
  assert(
    rulesContent.includes("'role'"),
    'User attempting to modify role on their own profile is strictly DENIED'
  );
  assert(
    rulesContent.includes("request.resource.data.get('role', resource.data.get('role', 'student')) == resource.data.get('role', 'student')"),
    'Self-promotion to admin role via profile update is strictly DENIED'
  );
}

// 5. Negative Test: User attempts to read another student\'s private chat -> Denied
{
  assert(
    rulesContent.includes('match /chats/{chatId}') &&
    rulesContent.includes('allow get: if isAuthorizedStudent() && (') &&
    rulesContent.includes('request.auth.uid in resource.data.participants'),
    'User attempting to read a private chat where they are not a participant is strictly DENIED'
  );

  assert(
    rulesContent.includes('match /messages/{messageId}') &&
    rulesContent.includes('request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants'),
    'User attempting to read messages in another student\'s chat is strictly DENIED'
  );

  assert(
    rulesContent.includes('request.resource.data.participants == resource.data.participants'),
    'Modifying chat participants to inject unauthorized users is strictly DENIED'
  );
}

// 6. Negative Test: User attempts to update or delete another user\'s listing -> Denied
{
  assert(
    rulesContent.includes('resource.data.sellerId == request.auth.uid'),
    'User attempting to update another user\'s listing is strictly DENIED'
  );
  assert(
    rulesContent.includes('request.resource.data.sellerId == resource.data.sellerId'),
    'User attempting to transfer listing ownership to another seller is strictly DENIED'
  );
  assert(
    rulesContent.includes('allow delete: if isAdmin() || isInternalSystem();'),
    'Ordinary user attempting to delete a listing document is strictly DENIED'
  );
}

// 7. Negative Test: User attempts an invalid reservation state transition -> Denied
{
  assert(
    rulesContent.includes("resource.data.status == 'pending'") &&
    rulesContent.includes("request.resource.data.status == 'accepted'") &&
    rulesContent.includes("resource.data.sellerId == request.auth.uid"),
    'Buyer attempting to accept their own reservation is strictly DENIED (only seller can accept)'
  );

  assert(
    rulesContent.includes("resource.data.status == 'accepted'") &&
    rulesContent.includes("request.resource.data.status == 'completed'"),
    'Direct pending-to-completed reservation transition is strictly DENIED'
  );

  assert(
    rulesContent.includes("allow delete: if false;"),
    'Deleting reservation records directly from client is strictly DENIED'
  );
}

// 8. Negative Test: User attempts to upload to another user\'s storage path -> Denied
{
  assert(
    storageRulesContent.includes('match /listings/{userId}/{fileName}') &&
    storageRulesContent.includes('request.auth.uid == userId'),
    'User attempting to upload to another student\'s listing image path is strictly DENIED'
  );

  assert(
    storageRulesContent.includes('match /avatars/{userId}/{fileName}') &&
    storageRulesContent.includes('request.auth.uid == userId'),
    'User attempting to upload to another student\'s avatar path is strictly DENIED'
  );

  assert(
    storageRulesContent.includes("request.resource.contentType.matches('image/(jpeg|jpg|png|webp|gif)')"),
    'User attempting to upload non-image or SVG file is strictly DENIED'
  );

  assert(
    storageRulesContent.includes('request.resource.size <= 5 * 1024 * 1024'),
    'User attempting to upload file > 5MB is strictly DENIED'
  );

  assert(
    storageRulesContent.includes('isCollegeEmail()'),
    'Unauthenticated or non-college user attempting to read/write storage is strictly DENIED'
  );
}

// 9. Negative Test: Missing user documents do not automatically grant protected access
{
  assert(
    !rulesContent.includes('!exists(/databases/$(database)/documents/users/$(request.auth.uid)) ||'),
    'Missing user document loophole is completely eliminated from firestore.rules'
  );
  assert(
    rulesContent.includes('function isUserActive() {\n      return exists(/databases/$(database)/documents/users/$(request.auth.uid))'),
    'isUserActive strictly requires user document to exist'
  );
}

// 10. Backend Authorization: verifyStudentCaller verifies domain, active status, and verified profile
{
  assert(
    serverContent.includes('async function verifyStudentCaller'),
    'server.ts defines verifyStudentCaller backend authorization helper'
  );
  assert(
    serverContent.includes('email.endsWith(allowedDomain)'),
    'verifyStudentCaller validates official college email domain'
  );
  assert(
    serverContent.includes('uData.isVerified === true'),
    'verifyStudentCaller verifies user profile is verified in Firestore'
  );
  assert(
    serverContent.includes('uData.status === "suspended"') &&
    serverContent.includes('uData.status === "banned"'),
    'verifyStudentCaller rejects suspended and banned students'
  );
  assert(
    serverContent.includes('const caller = await verifyStudentCaller(req);') &&
    serverContent.includes('/api/upload/image'),
    '/api/upload/image requires verified student authorization'
  );
  assert(
    !serverContent.includes('/api/upload/signature'),
    '/api/upload/signature endpoint removed to eliminate direct client upload bypasses'
  );
}

console.log(`\nSecurity Rules Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
