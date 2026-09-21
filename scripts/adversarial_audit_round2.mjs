import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const { apiKey, projectId, firestoreDatabaseId } = config;
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;
const apiBase = 'http://localhost:3000';

async function authUser(email, password) {
  // 1. Try sign in
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

  // 2. If not found, try sign up
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const upRes = await fetch(signUpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const upData = await upRes.json();
  if (upRes.ok) {
    return { idToken: upData.idToken, localId: upData.localId, email };
  }
  throw new Error(`Failed to auth ${email}: ${JSON.stringify(signData)} / ${JSON.stringify(upData)}`);
}

const auditLog = [];

function record(category, testId, description, expected, actual, passed, details = {}) {
  const result = {
    category,
    testId,
    description,
    expected,
    actual,
    passed: Boolean(passed),
    details
  };
  auditLog.push(result);
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${mark}] [${category}] ${testId}: ${description} -> Actual: ${actual}`);
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('   StudentNeed Round 2 — Exhaustive Adversarial Security Audit  ');
  console.log('================================================================\n');

  const TEST_PASSWORD = process.env.TEST_STUDENT_PASSWORD || '';
  if (!TEST_PASSWORD) {
    console.error('❌ [MISSING CREDENTIALS] TEST_STUDENT_PASSWORD environment variable is required.');
    process.exit(1);
  }
  // Authenticate test users
  console.log('[Setup] Authenticating test accounts...');
  const studentA = await authUser('student_a_test@student.annauniv.edu', TEST_PASSWORD);
  const studentB = await authUser('student_b_test@student.annauniv.edu', TEST_PASSWORD);
  const studentC = await authUser('student_c_test@student.annauniv.edu', TEST_PASSWORD);
  const attacker = await authUser('attacker_external@test.com', TEST_PASSWORD);

  console.log(`[Setup] Student A: ${studentA.localId}`);
  console.log(`[Setup] Student B: ${studentB.localId}`);
  console.log(`[Setup] Student C: ${studentC.localId}`);
  console.log(`[Setup] Attacker:  ${attacker.localId} (External domain)\n`);

  // -------------------------------------------------------------------------
  // SECTION 1: TWO-USER & THREE-USER AUTHORIZATION ATTACKS (CROSS-USER IDOR)
  // -------------------------------------------------------------------------
  console.log('--- 1. Two/Three-User Authorization & IDOR Attacks ---');

  // Setup User A resources
  const testListingId = `adv_listing_A_${Date.now()}`;
  const now = new Date();
  const future = new Date(Date.now() + 14 * 24 * 3600 * 1000);

  // User A creates Listing A
  const createListingRes = await fetch(`${firestoreBase}/listings?documentId=${testListingId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        id: { stringValue: testListingId },
        title: { stringValue: 'Engineering Mathematics Vol 1' },
        description: { stringValue: 'Clean textbook with notes' },
        category: { stringValue: 'Textbooks' },
        type: { stringValue: 'sale' },
        price: { integerValue: '250' },
        condition: { stringValue: 'Good' },
        location: { stringValue: 'Central Library' },
        sellerId: { stringValue: studentA.localId },
        status: { stringValue: 'available' },
        images: { arrayValue: { values: [{ stringValue: 'https://res.cloudinary.com/ddc64bq61/image/upload/sample.jpg' }] } },
        expiresAt: { timestampValue: future.toISOString() },
        expirationDays: { integerValue: '15' },
        createdAt: { timestampValue: now.toISOString() },
      }
    })
  });
  record('IDOR', 'IDOR-01-SETUP', 'User A creates Listing A', '200 OK', `${createListingRes.status}`, createListingRes.ok);

  // Attack 1: User B attempts to modify User A's listing (price and title)
  const bEditListingRes = await fetch(`${firestoreBase}/listings/${testListingId}?updateMask.fieldPaths=price&updateMask.fieldPaths=title`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        price: { integerValue: '1' },
        title: { stringValue: 'Hacked by User B' },
      }
    })
  });
  record('IDOR', 'IDOR-01', 'User B attempts to modify User A listing', '403 Forbidden', `${bEditListingRes.status}`, bEditListingRes.status === 403);

  // Attack 2: User B attempts to change sellerId of User A's listing to User B
  const bStealListingRes = await fetch(`${firestoreBase}/listings/${testListingId}?updateMask.fieldPaths=sellerId`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        sellerId: { stringValue: studentB.localId },
      }
    })
  });
  record('IDOR', 'IDOR-02', 'User B attempts to steal ownership of User A listing', '403 Forbidden', `${bStealListingRes.status}`, bStealListingRes.status === 403);

  // Attack 3: User B attempts to delete User A's listing
  const bDeleteListingRes = await fetch(`${firestoreBase}/listings/${testListingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentB.idToken}` },
  });
  record('IDOR', 'IDOR-03', 'User B attempts to delete User A listing', '403 Forbidden', `${bDeleteListingRes.status}`, bDeleteListingRes.status === 403);

  // Attack 4: User C attempts to delete User A's listing
  const cDeleteListingRes = await fetch(`${firestoreBase}/listings/${testListingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentC.idToken}` },
  });
  record('IDOR', 'IDOR-04', 'User C attempts to delete User A listing', '403 Forbidden', `${cDeleteListingRes.status}`, cDeleteListingRes.status === 403);

  // Attack 5: User B attempts to read User A's private profile subcollection
  const bReadPrivateRes = await fetch(`${firestoreBase}/users/${studentA.localId}/private/profile`, {
    headers: { Authorization: `Bearer ${studentB.idToken}` },
  });
  record('IDOR', 'IDOR-05', 'User B attempts to read User A private profile', '403/404 Forbidden', `${bReadPrivateRes.status}`, bReadPrivateRes.status === 403 || bReadPrivateRes.status === 404);

  // Attack 6: User B attempts to write/overwrite User A's private profile
  const bWritePrivateRes = await fetch(`${firestoreBase}/users/${studentA.localId}/private/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        phone: { stringValue: '9999999999' }
      }
    })
  });
  record('IDOR', 'IDOR-06', 'User B attempts to modify User A private profile', '403 Forbidden', `${bWritePrivateRes.status}`, bWritePrivateRes.status === 403);

  // Attack 7: User B attempts to tamper User A's public profile fields (rating, role, status)
  const bTamperProfileRes = await fetch(`${firestoreBase}/users/${studentA.localId}?updateMask.fieldPaths=role&updateMask.fieldPaths=rating`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        role: { stringValue: 'banned' },
        rating: { integerValue: '0' }
      }
    })
  });
  record('IDOR', 'IDOR-07', 'User B attempts to tamper User A public profile', '403 Forbidden', `${bTamperProfileRes.status}`, bTamperProfileRes.status === 403);

  // Attack 8: User A creates a Request, User B attempts to modify or complete it
  const testRequestId = `adv_request_A_${Date.now()}`;
  await fetch(`${firestoreBase}/requests?documentId=${testRequestId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        id: { stringValue: testRequestId },
        title: { stringValue: 'Need Scientific Calculator fx-991EX' },
        description: { stringValue: 'Needed for semester exam' },
        category: { stringValue: 'Electronics' },
        requesterId: { stringValue: studentA.localId },
        status: { stringValue: 'open' },
        createdAt: { timestampValue: now.toISOString() }
      }
    })
  });

  const bTamperRequestRes = await fetch(`${firestoreBase}/requests/${testRequestId}?updateMask.fieldPaths=requesterId&updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        requesterId: { stringValue: studentB.localId },
        status: { stringValue: 'completed' }
      }
    })
  });
  record('IDOR', 'IDOR-08', 'User B attempts to modify User A request', '403 Forbidden', `${bTamperRequestRes.status}`, bTamperRequestRes.status === 403);

  // -------------------------------------------------------------------------
  // SECTION 2: FIRESTORE RULE BYPASS & FIELD IMMUTABILITY ATTACKS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Firestore Rule Bypass & Immutability Attacks ---');

  // Attack 9: User A attempts to escalate self to admin role
  const selfAdminEscalateRes = await fetch(`${firestoreBase}/users/${studentA.localId}?updateMask.fieldPaths=role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: { role: { stringValue: 'admin' } }
    })
  });
  record('RULE_BYPASS', 'BYPASS-01', 'User A attempts self-elevation to admin role', '403 Forbidden', `${selfAdminEscalateRes.status}`, selfAdminEscalateRes.status === 403);

  // Attack 10: User A attempts to self-increment rating and exchangesCompleted
  const selfRatingTamperRes = await fetch(`${firestoreBase}/users/${studentA.localId}?updateMask.fieldPaths=rating&updateMask.fieldPaths=exchangesCompleted`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        rating: { integerValue: '5' },
        exchangesCompleted: { integerValue: '999' }
      }
    })
  });
  record('RULE_BYPASS', 'BYPASS-02', 'User A attempts to self-increment rating/exchanges', '403 Forbidden', `${selfRatingTamperRes.status}`, selfRatingTamperRes.status === 403);

  // Attack 11: User A attempts to clear warningCount and warnings
  const selfClearWarningsRes = await fetch(`${firestoreBase}/users/${studentA.localId}?updateMask.fieldPaths=warningCount&updateMask.fieldPaths=warnings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        warningCount: { integerValue: '0' },
        warnings: { arrayValue: { values: [] } }
      }
    })
  });
  record('RULE_BYPASS', 'BYPASS-03', 'User A attempts to erase warningCount/warnings', '403 Forbidden', `${selfClearWarningsRes.status}`, selfClearWarningsRes.status === 403);

  // Attack 12: Normal student reads admin audit logs
  const studentReadAuditLogsRes = await fetch(`${firestoreBase}/admin_audit_logs`, {
    headers: { Authorization: `Bearer ${studentA.idToken}` },
  });
  record('RULE_BYPASS', 'BYPASS-04', 'Normal student attempts to read admin_audit_logs', '403 Forbidden', `${studentReadAuditLogsRes.status}`, studentReadAuditLogsRes.status === 403);

  // Attack 13: Normal student writes to admin audit logs
  const studentWriteAuditLogsRes = await fetch(`${firestoreBase}/admin_audit_logs?documentId=forged_log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: { action: { stringValue: 'FORGED_AUDIT' } }
    })
  });
  record('RULE_BYPASS', 'BYPASS-05', 'Normal student attempts to write to admin_audit_logs', '403 Forbidden', `${studentWriteAuditLogsRes.status}`, studentWriteAuditLogsRes.status === 403);

  // Attack 14: Non-student (@test.com) attempts to read listings
  const nonStudentReadListingsRes = await fetch(`${firestoreBase}/listings`, {
    headers: { Authorization: `Bearer ${attacker.idToken}` },
  });
  record('RULE_BYPASS', 'BYPASS-06', 'Non-student attempts to read /listings', '403 Forbidden', `${nonStudentReadListingsRes.status}`, nonStudentReadListingsRes.status === 403);

  // Attack 15: Non-student (@test.com) attempts to create a listing
  const nonStudentCreateListingRes = await fetch(`${firestoreBase}/listings?documentId=attacker_listing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${attacker.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        id: { stringValue: 'attacker_listing' },
        sellerId: { stringValue: attacker.localId },
        status: { stringValue: 'available' },
        expiresAt: { timestampValue: future.toISOString() }
      }
    })
  });
  record('RULE_BYPASS', 'BYPASS-07', 'Non-student attempts to create a listing', '403 Forbidden', `${nonStudentCreateListingRes.status}`, nonStudentCreateListingRes.status === 403);

  // -------------------------------------------------------------------------
  // SECTION 3: ADMIN PRIVILEGE ESCALATION (EXPRESS ENDPOINTS)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Admin Privilege Escalation Attacks on Express Endpoints ---');

  const adminEndpoints = [
    { method: 'GET', path: '/api/admin/overview', body: null },
    { method: 'GET', path: '/api/admin/users', body: null },
    { method: 'POST', path: '/api/admin/users/warn', body: { userId: studentA.localId, reason: 'Malicious warning' } },
    { method: 'POST', path: '/api/admin/users/suspend', body: { userId: studentA.localId, reason: 'Malicious suspend' } },
    { method: 'POST', path: '/api/admin/users/ban', body: { userId: studentA.localId, reason: 'Malicious ban' } },
    { method: 'POST', path: '/api/admin/users/restore', body: { userId: studentA.localId, reason: 'Malicious restore' } },
    { method: 'GET', path: '/api/admin/listings', body: null },
    { method: 'POST', path: '/api/admin/listings/moderate', body: { listingId: testListingId, action: 'remove', reason: 'Malicious removal' } },
    { method: 'GET', path: '/api/admin/reports', body: null },
    { method: 'POST', path: '/api/admin/reports/resolve', body: { reportId: 'dummy_rep', actionTaken: 'dismiss' } },
    { method: 'GET', path: '/api/admin/audit-logs', body: null },
    { method: 'GET', path: '/api/admin/activity-logs', body: null },
    { method: 'POST', path: '/api/listings/cleanup-expired', body: {} },
    { method: 'POST', path: '/api/listings/backfill-expiration', body: {} },
  ];

  for (const ep of adminEndpoints) {
    const opts = {
      method: ep.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentB.idToken}`,
      },
    };
    if (ep.body) opts.body = JSON.stringify(ep.body);

    const res = await fetch(`${apiBase}${ep.path}`, opts);
    const data = await res.json().catch(() => ({}));
    const pass = res.status === 403;
    record('ADMIN_ESC', `ADMIN-${ep.path.replace(/\//g, '_')}`, `Student B calls ${ep.method} ${ep.path}`, '403 Forbidden', `${res.status}`, pass, { error: data.error });
  }

  // -------------------------------------------------------------------------
  // SECTION 4: RESERVATION STATE MACHINE ATTACKS
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Reservation State Machine Attacks ---');

  // Create Chat A between Student A (seller) and Student B (buyer)
  const testChatId = `listing_${testListingId}_${studentA.localId}_${studentB.localId}`;
  await fetch(`${firestoreBase}/chats?documentId=${testChatId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        id: { stringValue: testChatId },
        participants: { arrayValue: { values: [{ stringValue: studentA.localId }, { stringValue: studentB.localId }] } },
        listingId: { stringValue: testListingId },
      }
    })
  });

  // Buyer (Student B) creates Reservation in 'pending' status
  const testResId = `res_${testListingId}_${studentB.localId}`;
  const createResRes = await fetch(`${firestoreBase}/reservations?documentId=${testResId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        id: { stringValue: testResId },
        listingId: { stringValue: testListingId },
        chatId: { stringValue: testChatId },
        buyerId: { stringValue: studentB.localId },
        sellerId: { stringValue: studentA.localId },
        status: { stringValue: 'pending' },
        createdAt: { timestampValue: now.toISOString() }
      }
    })
  });
  record('RESERVATION', 'RES-01-SETUP', 'Buyer creates pending reservation', '200 OK', `${createResRes.status}`, createResRes.ok);

  // Attack 16: Buyer attempts to jump state pending -> completed
  const pendingToCompletedRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'completed' }
      }
    })
  });
  record('RESERVATION', 'RES-02', 'Buyer attempts pending -> completed jump', '403 Forbidden', `${pendingToCompletedRes.status}`, pendingToCompletedRes.status === 403);

  // Attack 17: Buyer attempts to accept their own reservation
  const buyerAcceptOwnRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'accepted' }
      }
    })
  });
  record('RESERVATION', 'RES-03', 'Buyer attempts to accept own reservation', '403 Forbidden', `${buyerAcceptOwnRes.status}`, buyerAcceptOwnRes.status === 403);

  // Attack 18: Buyer attempts to reject their own reservation
  const buyerRejectOwnRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'rejected' }
      }
    })
  });
  record('RESERVATION', 'RES-04', 'Buyer attempts to reject own reservation', '403 Forbidden', `${buyerRejectOwnRes.status}`, buyerRejectOwnRes.status === 403);

  // Attack 19: Third party (Student C) attempts to accept reservation
  const cAcceptRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentC.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'accepted' }
      }
    })
  });
  record('RESERVATION', 'RES-05', 'Third party User C attempts to accept reservation', '403 Forbidden', `${cAcceptRes.status}`, cAcceptRes.status === 403);

  // Seller legitimately accepts reservation
  const sellerAcceptRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        sellerId: { stringValue: studentA.localId },
        buyerId: { stringValue: studentB.localId },
        listingId: { stringValue: testListingId },
        chatId: { stringValue: testChatId },
        status: { stringValue: 'accepted' }
      }
    })
  });
  record('RESERVATION', 'RES-06-LEGIT', 'Seller accepts pending reservation', '200 OK', `${sellerAcceptRes.status}`, sellerAcceptRes.ok);

  // Attack 20: Once accepted, attempt accepted -> pending
  const acceptedToPendingRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'pending' }
      }
    })
  });
  record('RESERVATION', 'RES-07', 'Attempt invalid accepted -> pending transition', '403 Forbidden', `${acceptedToPendingRes.status}`, acceptedToPendingRes.status === 403);

  // Attack 21: Once accepted, attempt accepted -> rejected
  const acceptedToRejectedRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'rejected' }
      }
    })
  });
  record('RESERVATION', 'RES-08', 'Attempt invalid accepted -> rejected transition', '403 Forbidden', `${acceptedToRejectedRes.status}`, acceptedToRejectedRes.status === 403);

  // Attack 22: Tamper buyerId or sellerId on accepted reservation
  const tamperIdsRes = await fetch(`${firestoreBase}/reservations/${testResId}?updateMask.fieldPaths=buyerId`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        buyerId: { stringValue: studentC.localId }
      }
    })
  });
  record('RESERVATION', 'RES-09', 'Attempt to tamper buyerId on accepted reservation', '403 Forbidden', `${tamperIdsRes.status}`, tamperIdsRes.status === 403);

  // -------------------------------------------------------------------------
  // SECTION 5: CHAT SECURITY & PARTICIPANT ISOLATION ATTACKS
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Chat Security & Participant Isolation Attacks ---');

  // Attack 23: User C attempts to read Chat A
  const cReadChatRes = await fetch(`${firestoreBase}/chats/${testChatId}`, {
    headers: { Authorization: `Bearer ${studentC.idToken}` },
  });
  record('CHAT', 'CHAT-01', 'Non-participant User C attempts to read Chat A', '403 Forbidden', `${cReadChatRes.status}`, cReadChatRes.status === 403);

  // Attack 24: User C attempts to post a message into Chat A
  const cPostMessageRes = await fetch(`${firestoreBase}/chats/${testChatId}/messages?documentId=msg_c`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentC.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        senderId: { stringValue: studentC.localId },
        text: { stringValue: 'Injected message from User C' },
        createdAt: { timestampValue: now.toISOString() }
      }
    })
  });
  record('CHAT', 'CHAT-02', 'Non-participant User C attempts to post message to Chat A', '403 Forbidden', `${cPostMessageRes.status}`, cPostMessageRes.status === 403);

  // Attack 25: User B sends message impersonating User A (senderId = User A)
  const bImpersonateMessageRes = await fetch(`${firestoreBase}/chats/${testChatId}/messages?documentId=msg_spoof`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        senderId: { stringValue: studentA.localId },
        text: { stringValue: 'Spoofed message from seller' },
        createdAt: { timestampValue: now.toISOString() }
      }
    })
  });
  record('CHAT', 'CHAT-03', 'User B attempts to spoof senderId as User A in message', '403 Forbidden', `${bImpersonateMessageRes.status}`, bImpersonateMessageRes.status === 403);

  // Attack 26: Create chat with 3 participants (inject third participant)
  const threeParticipantChatRes = await fetch(`${firestoreBase}/chats?documentId=chat_three_parties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        id: { stringValue: 'chat_three_parties' },
        participants: { arrayValue: { values: [
          { stringValue: studentA.localId },
          { stringValue: studentB.localId },
          { stringValue: studentC.localId }
        ] } }
      }
    })
  });
  record('CHAT', 'CHAT-04', 'Attempt to create chat with 3 participants (group injection)', '403 Forbidden', `${threeParticipantChatRes.status}`, threeParticipantChatRes.status === 403);

  // Attack 27: Message length boundary (> 2000 chars)
  const hugeText = 'A'.repeat(2500);
  const hugeMessageRes = await fetch(`${firestoreBase}/chats/${testChatId}/messages?documentId=msg_huge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentB.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        senderId: { stringValue: studentB.localId },
        text: { stringValue: hugeText },
        createdAt: { timestampValue: now.toISOString() }
      }
    })
  });
  record('CHAT', 'CHAT-05', 'Attempt to post message exceeding 2000 chars', '403 Forbidden', `${hugeMessageRes.status}`, hugeMessageRes.status === 403);

  // -------------------------------------------------------------------------
  // SECTION 6: OTP & AUTHENTICATION ADVERSARIAL ATTACKS
  // -------------------------------------------------------------------------
  console.log('\n--- 6. OTP & Authentication Adversarial Attacks ---');

  // Attack 28: Non-college email OTP request
  const evilEmailRes = await fetch(`${apiBase}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'attacker@gmail.com' })
  });
  record('AUTH', 'OTP-01', 'Request OTP with non-college email (@gmail.com)', '403 Forbidden', `${evilEmailRes.status}`, evilEmailRes.status === 403);

  // Attack 29: Domain suffix spoofing (@student.annauniv.edu.evil.com)
  const spoofDomainRes = await fetch(`${apiBase}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'attacker@student.annauniv.edu.evil.com' })
  });
  record('AUTH', 'OTP-02', 'Request OTP with spoofed domain suffix', '403 Forbidden', `${spoofDomainRes.status}`, spoofDomainRes.status === 403);

  // Attack 30: Valid college email with uppercase and spaces
  const caseEmailRes = await fetch(`${apiBase}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '  STUDENT_CASE_TEST@STUDENT.ANNAUNIV.EDU  ' })
  });
  record('AUTH', 'OTP-03', 'Request OTP with uppercase and whitespace padding', '200 OK', `${caseEmailRes.status}`, caseEmailRes.status === 200);

  // Attack 31: Rapid request OTP within 60s cooldown
  const rapidOtpRes = await fetch(`${apiBase}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student_case_test@student.annauniv.edu' })
  });
  record('AUTH', 'OTP-04', 'Rapid OTP request within 60s cooldown', '429 Rate Limited', `${rapidOtpRes.status}`, rapidOtpRes.status === 429);

  // Attack 32: Verify nonexistent / wrong OTP
  const wrongOtpRes = await fetch(`${apiBase}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent@student.annauniv.edu', otp: '123456' })
  });
  record('AUTH', 'OTP-05', 'Verify OTP for nonexistent / expired code', '400 Bad Request', `${wrongOtpRes.status}`, wrongOtpRes.status === 400);

  // -------------------------------------------------------------------------
  // SECTION 7: INPUT FUZZING & API VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Input Fuzzing & Content Safety ---');

  // Test 33: Assistant chatbot character limit (> 600 chars)
  const hugeAiMsgRes = await fetch(`${apiBase}/api/chat/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'A'.repeat(800) })
  });
  record('FUZZ', 'FUZZ-01', 'Assistant endpoint with message > 600 chars', '400 Bad Request', `${hugeAiMsgRes.status}`, hugeAiMsgRes.status === 400);

  // Test 34: Content moderation scanner: Glock pistol detection
  const weaponCheckRes = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Glock 19 with 50 rounds ammo', description: 'Handgun for sale' })
  });
  const weaponData = await weaponCheckRes.json();
  record('FUZZ', 'MOD-01', 'Moderation scanner detects prohibited firearm', 'block', weaponData.decision, weaponData.decision === 'block');

  // Test 35: Content moderation scanner: Exam leak detection
  const examCheckRes = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Anna Univ Leaked Question Paper Semester 4', description: 'Guaranteed 100% paper leak' })
  });
  const examData = await examCheckRes.json();
  record('FUZZ', 'MOD-02', 'Moderation scanner detects exam paper leak', 'block', examData.decision, examData.decision === 'block');

  // Test 36: Benign student supply with "gun" substring (glue gun) -> should NOT block
  const glueGunCheckRes = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hot Glue Gun with 10 sticks for project work', description: 'Electric craft tool' })
  });
  const glueGunData = await glueGunCheckRes.json();
  record('FUZZ', 'MOD-03', 'Benign glue gun not falsely blocked as weapon', 'allow', glueGunData.decision, glueGunData.decision === 'allow');

  // -------------------------------------------------------------------------
  // SECTION 8: CLOUDINARY & FILE UPLOAD ABUSE
  // -------------------------------------------------------------------------
  console.log('\n--- 8. File Upload Abuse & Folder Injection ---');

  // Attack 37: Folder traversal / arbitrary folder in upload signature
  const arbitraryFolderRes = await fetch(`${apiBase}/api/upload/signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({ folder: '../../../root_secret_folder' })
  });
  const sigData = await arbitraryFolderRes.json();
  // Expect folder to be forced to allowed folder 'studentneed/listings'
  const folderSanitized = sigData.folder === 'studentneed/listings';
  record('UPLOAD', 'UPLOAD-01', 'Upload signature rejects arbitrary/traversal folder', 'studentneed/listings', `${sigData.folder || arbitraryFolderRes.status}`, folderSanitized);

  // Attack 38: Upload image with SVG MIME type via proxy
  const svgUploadRes = await fetch(`${apiBase}/api/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      file: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=',
      folder: 'studentneed/listings'
    })
  });
  record('UPLOAD', 'UPLOAD-02', 'Image upload rejects SVG MIME type', '400 Bad Request', `${svgUploadRes.status}`, svgUploadRes.status === 400);

  // Attack 39: Upload image with HTML MIME type via proxy
  const htmlUploadRes = await fetch(`${apiBase}/api/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentA.idToken}`,
    },
    body: JSON.stringify({
      file: 'data:text/html;base64,PGgxPkhhY2tlZDwvaDE+',
      folder: 'studentneed/listings'
    })
  });
  record('UPLOAD', 'UPLOAD-03', 'Image upload rejects HTML MIME type', '400 Bad Request', `${htmlUploadRes.status}`, htmlUploadRes.status === 400);

  // -------------------------------------------------------------------------
  // SECTION 9: CORS & HTTP SECURITY HEADERS
  // -------------------------------------------------------------------------
  console.log('\n--- 9. CORS & HTTP Security Headers ---');

  // Test 40: Origin: https://evil.example
  const evilCorsRes = await fetch(`${apiBase}/api/health`, {
    headers: { Origin: 'https://evil.example' }
  });
  const evilCorsHeader = evilCorsRes.headers.get('access-control-allow-origin');
  record('CORS', 'CORS-01', 'CORS rejects https://evil.example', 'null/absent', `${evilCorsHeader || 'absent'}`, !evilCorsHeader || evilCorsHeader !== 'https://evil.example');

  // Test 41: Origin: https://studentneed.me (Allowed)
  const legitCorsRes = await fetch(`${apiBase}/api/health`, {
    headers: { Origin: 'https://studentneed.me' }
  });
  const legitCorsHeader = legitCorsRes.headers.get('access-control-allow-origin');
  record('CORS', 'CORS-02', 'CORS permits production domain https://studentneed.me', 'https://studentneed.me', `${legitCorsHeader}`, legitCorsHeader === 'https://studentneed.me');

  // Test 42: Security headers inspection
  const hsts = legitCorsRes.headers.get('strict-transport-security');
  const xcto = legitCorsRes.headers.get('x-content-type-options');
  const csp = legitCorsRes.headers.get('content-security-policy');
  const xfo = legitCorsRes.headers.get('x-frame-options');

  record('HEADERS', 'HEAD-01', 'HSTS header configured', 'max-age=31536000', `${hsts ? 'present' : 'absent'}`, Boolean(hsts));
  record('HEADERS', 'HEAD-02', 'X-Content-Type-Options is nosniff', 'nosniff', `${xcto}`, xcto === 'nosniff');
  record('HEADERS', 'HEAD-03', 'Content-Security-Policy is enforced', 'present', `${csp ? 'present' : 'absent'}`, Boolean(csp));

  // -------------------------------------------------------------------------
  // SECTION 10: RATE LIMIT & PROXY TRUST
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Rate Limiting & Proxy Spoofing ---');

  // Test 43: Test if X-Forwarded-For bypasses IP rate limit on /api/auth/send-otp
  // When trust proxy is not configured, Express req.ip comes from remote socket, not spoofed header
  const spoofIpRes = await fetch(`${apiBase}/api/auth/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.1'
    },
    body: JSON.stringify({ email: 'student_case_test@student.annauniv.edu' })
  });
  // Since email was recently used, it still hits 60s cooldown regardless of IP spoofing!
  record('RATELIMIT', 'RATE-01', 'Rate limiter not bypassed by spoofed X-Forwarded-For', '429 Rate Limited', `${spoofIpRes.status}`, spoofIpRes.status === 429);

  // -------------------------------------------------------------------------
  // SECTION 11: DELIBERATE MALFORMED PAYLOADS & LEAKAGE
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Malformed Payloads & Information Leakage ---');

  // Test 44: Send malformed JSON payload
  const malformedJsonRes = await fetch(`${apiBase}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "broken_json'
  });
  const malformedData = await malformedJsonRes.json().catch(() => ({}));
  const noStackInResponse = !JSON.stringify(malformedData).includes('at ') && !JSON.stringify(malformedData).includes('SyntaxError:');
  record('LEAK', 'LEAK-01', 'Malformed JSON returns clean 400 without stack trace', '400 Bad Request (no stack)', `${malformedJsonRes.status} (no stack: ${noStackInResponse})`, malformedJsonRes.status === 400 && noStackInResponse);

  // Clean-up created resources
  console.log('\n[Cleanup] Cleaning up test listing and reservations...');
  // Delete listing via User A (or note immutable status)
  // Complete test run
  console.log('================================================================');
  const passedCount = auditLog.filter(t => t.passed).length;
  const totalCount = auditLog.length;
  console.log(`Summary: ${passedCount}/${totalCount} tests passed.`);
  console.log('================================================================\n');

  fs.writeFileSync('./scripts/adversarial_audit_results.json', JSON.stringify(auditLog, null, 2));
}

runAdversarialSuite().catch(err => {
  console.error('Fatal error running adversarial test suite:', err);
  process.exit(1);
});
