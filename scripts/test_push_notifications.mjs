import fs from 'fs';
import { spawn } from 'child_process';

console.log('========================================================================');
console.log('   StudentNeed — Web Push Notifications & Security Verification Suite');
console.log('========================================================================\n');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const { apiKey, projectId, firestoreDatabaseId } = config;
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;

const TEST_PORT = 4987;
const serverBase = `http://127.0.0.1:${TEST_PORT}`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function recordResult(id, description, expected, actual, passed, details = '') {
  totalTests++;
  if (passed) passedTests++; else failedTests++;
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${mark}] ${id}: ${description}`);
  console.log(`       Expected: ${expected}`);
  console.log(`       Actual:   ${actual}`);
  if (details) console.log(`       Details:  ${details}`);
  console.log('');
}

async function authUser(email, password) {
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const signRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const signData = await signRes.json();
  if (signRes.ok) {
    return { idToken: signData.idToken, localId: signData.localId, email };
  }
  throw new Error(`Auth failed for ${email}`);
}

function startTestServer() {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', ['dist/server.cjs'], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        NODE_ENV: 'development',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const onData = (data) => {
      output += data.toString();
      if (output.includes(`Server running on port ${TEST_PORT}`)) {
        serverProcess.stdout.removeListener('data', onData);
        resolve(serverProcess);
      }
    };

    serverProcess.stdout.on('data', onData);
    serverProcess.stderr.on('data', (d) => {
      output += d.toString();
    });

    serverProcess.on('error', (err) => reject(err));

    setTimeout(() => {
      if (!output.includes(`Server running on port ${TEST_PORT}`)) {
        reject(new Error(`Server failed to start within 10s. Output: ${output}`));
      }
    }, 10000);
  });
}

async function runSuite() {
  let serverProcess;
  try {
    console.log('[Setup] Starting test server on port ' + TEST_PORT + '...');
    serverProcess = await startTestServer();
    console.log('[Setup] Server running successfully.\n');

    console.log('[Setup] Authenticating test accounts...');
    const studentA = await authUser('student_a_test@student.annauniv.edu', 'P@ssw0rd12345!');
    const studentB = await authUser('student_b_test@student.annauniv.edu', 'P@ssw0rd12345!');
    const studentC = await authUser('student_c_test@student.annauniv.edu', 'P@ssw0rd12345!');
    const externalAttacker = await authUser('attacker_external@test.com', 'P@ssw0rd12345!');

    console.log(`Student A UID: ${studentA.localId}`);
    console.log(`Student B UID: ${studentB.localId}`);
    console.log(`Student C UID: ${studentC.localId}`);
    console.log(`Attacker UID:  ${externalAttacker.localId}\n`);

    // =========================================================================
    // SECTION 1: Service Worker & PWA Manifest Assets
    // =========================================================================
    console.log('--- 1. Service Worker & PWA Manifest Assets ---');

    const swExists = fs.existsSync('./public/sw.js');
    const swContent = swExists ? fs.readFileSync('./public/sw.js', 'utf8') : '';
    const swHasPush = swContent.includes("self.addEventListener('push'");
    const swHasClick = swContent.includes("self.addEventListener('notificationclick'");
    const swHasForegroundSuppression = swContent.includes('matchAll') && swContent.includes('isViewingExactChat');

    recordResult(
      'PUSH-01',
      'Service Worker file and push event listeners exist',
      'true',
      String(swExists && swHasPush && swHasClick),
      swExists && swHasPush && swHasClick,
      'sw.js handles push, notificationclick, and caching'
    );

    recordResult(
      'PUSH-02',
      'Service Worker suppresses OS banner when user actively views conversation',
      'true',
      String(swHasForegroundSuppression),
      swHasForegroundSuppression,
      'Matches focused window with /chat/${targetChatId}'
    );

    const manifestExists = fs.existsSync('./public/manifest.json');
    const indexHtml = fs.readFileSync('./index.html', 'utf8');
    const htmlLinksManifest = indexHtml.includes('manifest.json');

    recordResult(
      'PUSH-03',
      'PWA Manifest is registered in index.html',
      'true',
      String(manifestExists && htmlLinksManifest),
      manifestExists && htmlLinksManifest,
      'manifest.json configured for mobile standalone experience'
    );

    // =========================================================================
    // SECTION 2: VAPID Public Key Endpoint & Health Check
    // =========================================================================
    console.log('--- 2. VAPID Key Endpoint & Production Health Check ---');

    const vapidRes = await fetch(`${serverBase}/api/push/vapid-public-key`);
    const vapidData = await vapidRes.json();
    const hasValidKey = vapidRes.ok && typeof vapidData.publicKey === 'string' && vapidData.publicKey.length > 30;
    const noPrivateKeyLeak = !JSON.stringify(vapidData).includes('private');

    recordResult(
      'PUSH-04',
      'GET /api/push/vapid-public-key returns persistent public key without secret leak',
      'HTTP 200 with valid publicKey',
      `HTTP ${vapidRes.status} (key length: ${vapidData.publicKey?.length || 0})`,
      hasValidKey && noPrivateKeyLeak,
      `Public key provided: ${vapidData.publicKey?.slice(0, 16)}...`
    );

    const healthRes = await fetch(`${serverBase}/api/health`);
    const healthData = await healthRes.json();

    recordResult(
      'PUSH-05',
      'GET /api/health succeeds with environment verification',
      'status: healthy',
      `status: ${healthData.status}`,
      healthRes.ok && healthData.status === 'healthy',
      `Environment: ${healthData.environment}`
    );

    // =========================================================================
    // SECTION 3: Firestore Security Boundary for Push Subscriptions
    // =========================================================================
    console.log('--- 3. Firestore Security Boundary for Push Subscriptions ---');

    // 3.1 Student A writes to their own /users/{studentA.localId}/private/push_subscriptions
    const ownSubRes = await fetch(
      `${firestoreBase}/users/${studentA.localId}/private/push_subscriptions`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentA.idToken}`,
        },
        body: JSON.stringify({
          fields: {
            testKey: { stringValue: 'allowed' },
          },
        }),
      }
    );

    recordResult(
      'PUSH-06',
      'User can write to their own /users/{uid}/private/push_subscriptions',
      'HTTP 200 OK',
      `HTTP ${ownSubRes.status}`,
      ownSubRes.ok,
      'Rule /users/{userId}/private/{docId} allows owner write'
    );

    // 3.2 Student A attempts to write to Student B's push_subscriptions
    const tamperSubRes = await fetch(
      `${firestoreBase}/users/${studentB.localId}/private/push_subscriptions`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentA.idToken}`,
        },
        body: JSON.stringify({
          fields: {
            testKey: { stringValue: 'tampered' },
          },
        }),
      }
    );

    recordResult(
      'PUSH-07',
      'Student A CANNOT write to Student B\'s /users/{uid}/private/push_subscriptions',
      'HTTP 403 Forbidden',
      `HTTP ${tamperSubRes.status}`,
      tamperSubRes.status === 403,
      'Strictly isolated to owner by existing security rules'
    );

    // 3.3 Student A attempts to read Student B's push_subscriptions
    const readBSubRes = await fetch(
      `${firestoreBase}/users/${studentB.localId}/private/push_subscriptions`,
      {
        headers: {
          Authorization: `Bearer ${studentA.idToken}`,
        },
      }
    );

    recordResult(
      'PUSH-08',
      'Student A CANNOT read Student B\'s /users/{uid}/private/push_subscriptions',
      'HTTP 403 Forbidden',
      `HTTP ${readBSubRes.status}`,
      readBSubRes.status === 403,
      'Cross-user subscription read denied'
    );

    // 3.4 External attacker cannot access private subcollection
    const attackerSubRes = await fetch(
      `${firestoreBase}/users/${studentA.localId}/private/push_subscriptions`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${externalAttacker.idToken}`,
        },
        body: JSON.stringify({
          fields: { test: { stringValue: 'pwned' } },
        }),
      }
    );

    recordResult(
      'PUSH-09',
      'External attacker rejected from writing push subscriptions',
      'HTTP 403 Forbidden',
      `HTTP ${attackerSubRes.status}`,
      attackerSubRes.status === 403,
      'Non-student external account blocked'
    );

    // =========================================================================
    // SECTION 4: Backend /api/push/subscribe & unsubscribe Endpoints
    // =========================================================================
    console.log('--- 4. Backend /api/push/subscribe & unsubscribe Endpoints ---');

    // 4.1 Unauthenticated subscribe rejected
    const unauthSub = await fetch(`${serverBase}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: {} }),
    });

    recordResult(
      'PUSH-10',
      'POST /api/push/subscribe without token returns 401',
      'HTTP 401',
      `HTTP ${unauthSub.status}`,
      unauthSub.status === 401,
      'Authentication required'
    );

    // 4.2 Malformed subscription rejected
    const malformedSub = await fetch(`${serverBase}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({ subscription: { endpoint: 'http://insecure.com' } }),
    });

    recordResult(
      'PUSH-11',
      'POST /api/push/subscribe with invalid non-HTTPS endpoint returns 400',
      'HTTP 400',
      `HTTP ${malformedSub.status}`,
      malformedSub.status === 400,
      'Input validation enforced on push subscription schema'
    );

    // 4.3 Valid subscription from Student A (Device 1)
    const mockEndpoint1 = `https://fcm.googleapis.com/fcm/send/test-token-device-1-${Date.now()}`;
    const validSub1 = await fetch(`${serverBase}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: mockEndpoint1,
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9Ac0dfEwqZSS3iUfqvL0bO2lywUrTrIS_L8755WpYk=',
            auth: 'tBHItJI5svbpez7KI4CCXg==',
          },
        },
      }),
    });
    const sub1Data = await validSub1.json();

    recordResult(
      'PUSH-12',
      'POST /api/push/subscribe successfully registers device for authenticated student',
      'HTTP 200 with success: true',
      `HTTP ${validSub1.status} (deviceKey: ${sub1Data.deviceKey})`,
      validSub1.ok && sub1Data.success === true,
      `Hashed device key: ${sub1Data.deviceKey}`
    );

    // 4.4 Second device for Student A (Device 2 - Multi-device support)
    const mockEndpoint2 = `https://fcm.googleapis.com/fcm/send/test-token-device-2-${Date.now()}`;
    const validSub2 = await fetch(`${serverBase}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: mockEndpoint2,
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9Ac0dfEwqZSS3iUfqvL0bO2lywUrTrIS_L8755WpYk=',
            auth: 'tBHItJI5svbpez7KI4CCXg==',
          },
        },
      }),
    });
    const sub2Data = await validSub2.json();

    recordResult(
      'PUSH-13',
      'Multi-device support: multiple browsers can register without overwriting each other',
      'Unique deviceKey generated',
      `Device 1: ${sub1Data.deviceKey}, Device 2: ${sub2Data.deviceKey}`,
      validSub2.ok && sub2Data.deviceKey !== sub1Data.deviceKey,
      'Both devices safely preserved in user-scoped push subscriptions map'
    );

    // 4.5 Unsubscribe Device 1
    const unsubRes = await fetch(`${serverBase}/api/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({ endpoint: mockEndpoint1 }),
    });
    const unsubData = await unsubRes.json();

    recordResult(
      'PUSH-14',
      'POST /api/push/unsubscribe removes target device subscription cleanly',
      'HTTP 200 with removed: true',
      `HTTP ${unsubRes.status} (removed: ${unsubData.removed})`,
      unsubRes.ok && unsubData.removed === true,
      'Device 1 pruned from subscriptions'
    );

    // =========================================================================
    // SECTION 5: /api/push/notify-message Adversarial & Ownership Testing
    // =========================================================================
    console.log('--- 5. /api/push/notify-message Adversarial & Ownership Tests ---');

    // Create a real chat between Student A and Student B
    const testChatId = `chat_push_test_${Date.now()}`;
    await fetch(`${firestoreBase}/chats?documentId=${testChatId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({
        fields: {
          participants: {
            arrayValue: {
              values: [{ stringValue: studentA.localId }, { stringValue: studentB.localId }],
            },
          },
          createdAt: { timestampValue: new Date().toISOString() },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    // Create a real message authored by Student A in this chat
    const testMessageId = `msg_push_test_${Date.now()}`;
    await fetch(`${firestoreBase}/chats/${testChatId}/messages?documentId=${testMessageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({
        fields: {
          senderId: { stringValue: studentA.localId },
          text: { stringValue: 'Hi Student B! Can we meet at the campus library?' },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    // 5.1 Unauthenticated notify-message rejected
    const unauthNotify = await fetch(`${serverBase}/api/push/notify-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: testChatId, messageId: testMessageId }),
    });

    recordResult(
      'PUSH-15',
      'POST /api/push/notify-message without token returns 401',
      'HTTP 401',
      `HTTP ${unauthNotify.status}`,
      unauthNotify.status === 401,
      'Authentication enforced'
    );

    // 5.2 Missing chatId or messageId rejected
    const missingParams = await fetch(`${serverBase}/api/push/notify-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({ chatId: testChatId }),
    });

    recordResult(
      'PUSH-16',
      'POST /api/push/notify-message without messageId returns 400',
      'HTTP 400',
      `HTTP ${missingParams.status}`,
      missingParams.status === 400,
      'Both chatId and messageId required'
    );

    // 5.3 Non-participant (Student C) attempts to trigger notification
    const nonParticipantAttempt = await fetch(`${serverBase}/api/push/notify-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentC.idToken}`,
      },
      body: JSON.stringify({ chatId: testChatId, messageId: testMessageId }),
    });

    recordResult(
      'PUSH-17',
      'Non-participant (Student C) CANNOT trigger notifications for conversation A-B',
      'HTTP 403 Forbidden',
      `HTTP ${nonParticipantAttempt.status}`,
      nonParticipantAttempt.status === 403,
      'Trusted participants list enforced on server'
    );

    // 5.4 Spoofed Author: Student B attempts to trigger notification claiming to be author of A\'s message
    const spoofedAuthorAttempt = await fetch(`${serverBase}/api/push/notify-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentB.idToken}`,
      },
      body: JSON.stringify({ chatId: testChatId, messageId: testMessageId }),
    });

    recordResult(
      'PUSH-18',
      'Participant B CANNOT trigger notifications for message authored by Participant A',
      'HTTP 403 Forbidden',
      `HTTP ${spoofedAuthorAttempt.status}`,
      spoofedAuthorAttempt.status === 403,
      'Exact message.senderId === callerUid enforced on server'
    );

    // 5.5 Spoofed Message ID: Non-existent message in chat
    const nonExistentMsg = await fetch(`${serverBase}/api/push/notify-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({ chatId: testChatId, messageId: 'non_existent_msg_999' }),
    });

    recordResult(
      'PUSH-19',
      'Spoofed messageId not found in chat returns 404',
      'HTTP 404',
      `HTTP ${nonExistentMsg.status}`,
      nonExistentMsg.status === 404,
      'Message existence verified prior to dispatch'
    );

    // 5.6 Legitimate author Student A triggers notify-message for their own message
    const validNotify = await fetch(`${serverBase}/api/push/notify-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentA.idToken}`,
      },
      body: JSON.stringify({ chatId: testChatId, messageId: testMessageId }),
    });
    const validNotifyData = await validNotify.json();

    recordResult(
      'PUSH-20',
      'Legitimate sender (Student A) triggers notification targeting Student B',
      'HTTP 200 with success: true and recipientsCount: 1',
      `HTTP ${validNotify.status} (success: ${validNotifyData.success}, recipients: ${validNotifyData.recipientsCount})`,
      validNotify.ok && validNotifyData.success === true && validNotifyData.recipientsCount === 1,
      'Counterparty determined exclusively from trusted participants, excluding sender'
    );

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('========================================================================');
    console.log(`   Verification Results: ${passedTests}/${totalTests} PASS (${failedTests} FAILED)`);
    console.log('========================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } finally {
    if (serverProcess) {
      console.log('[Teardown] Stopping test server...');
      serverProcess.kill();
    }
  }
}

runSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
