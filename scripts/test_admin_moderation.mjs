import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

console.log('================================================================');
console.log('   StudentNeed Admin Moderation — Automated Security Suite      ');
console.log('================================================================\n');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const { apiKey, projectId, firestoreDatabaseId } = config;
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;

const TEST_STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL || '';
const TEST_STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD || '';
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

const missingEnv = [];
if (!TEST_STUDENT_EMAIL) missingEnv.push('TEST_STUDENT_EMAIL');
if (!TEST_STUDENT_PASSWORD) missingEnv.push('TEST_STUDENT_PASSWORD');
if (!TEST_ADMIN_EMAIL) missingEnv.push('TEST_ADMIN_EMAIL');
if (!TEST_ADMIN_PASSWORD) missingEnv.push('TEST_ADMIN_PASSWORD');

if (missingEnv.length > 0) {
  console.error(`❌ [MISSING CREDENTIALS] The following required environment variables are missing: ${missingEnv.join(', ')}`);
  console.error('All 4 test credentials must be provided via the environment with no hard-coded fallbacks:');
  console.error('  TEST_STUDENT_EMAIL=<email> TEST_STUDENT_PASSWORD=<pwd> TEST_ADMIN_EMAIL=<admin_email> TEST_ADMIN_PASSWORD=<admin_pwd> node scripts/test_admin_moderation.mjs\n');
  process.exit(1);
}

const TEST_PORT = 4991;
const apiBase = `http://127.0.0.1:${TEST_PORT}`;

async function authUser(email, password) {
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (res.ok) {
    return { idToken: data.idToken, localId: data.localId, email };
  }
  throw new Error(`Failed to authenticate ${email}: ${JSON.stringify(data)}`);
}

function startTestServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`[Setup] Starting test server on port ${port}...`);
    const serverProcess = spawn('node', ['dist/server.cjs'], {
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'development',
        ADMIN_EMAIL: TEST_ADMIN_EMAIL,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    serverProcess.stdout?.on('data', (d) => {
      stdoutData += d.toString();
    });

    serverProcess.stderr?.on('data', (d) => {
      stderrData += d.toString();
    });

    let resolved = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (res.ok) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolved = true;
          console.log(`[Setup] Server running successfully on port ${port}.\n`);
          resolve(serverProcess);
        }
      } catch {
        // Still waiting for server to start
      }
    }, 250);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!resolved) {
        serverProcess.kill();
        reject(new Error(`Server startup timed out. Stderr: ${stderrData} Stdout: ${stdoutData}`));
      }
    }, 15000);
  });
}

async function runModerationTests() {
  let serverProcess = null;

  try {
    serverProcess = await startTestServer(TEST_PORT);

    const results = [];
    function record(id, name, pass, details) {
      const status = pass ? 'PASS' : 'FAIL';
      results.push({ id, name, status, details });
      console.log(`[${status}] #${id}: ${name} -> ${details}`);
    }

    console.log('[Setup] Authenticating test accounts...');
    const student = await authUser(TEST_STUDENT_EMAIL, TEST_STUDENT_PASSWORD);
    const admin = await authUser(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    console.log(`[Setup] Normal Student: ${student.email} (${student.localId})`);
    console.log(`[Setup] Admin Account:  ${admin.email} (${admin.localId})\n`);

    // -------------------------------------------------------------------------
    // SECTION 1: Content Moderation Scanner (Tier 1: Block, Tier 2: Flag, Tier 3: Allow)
    // -------------------------------------------------------------------------
    console.log('--- Section 1: Content Moderation Scanner ---');

    const t1Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Glock Pistol with Ammunition and Bullets', description: 'Working condition handgun' }),
    });
    const t1Data = await t1Res.json();
    record('SCAN-01', 'Tier 1 Prohibited: Weapons & Ammo (Block)', t1Data.decision === 'block' && t1Data.confidence === 'high', `Decision: ${t1Data.decision}`);

    const t2Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hostel supply of weed and marijuana', description: 'Fresh stuff available' }),
    });
    const t2Data = await t2Res.json();
    record('SCAN-02', 'Tier 1 Prohibited: Controlled Substances (Block)', t2Data.decision === 'block' && t2Data.confidence === 'high', `Decision: ${t2Data.decision}`);

    const t3Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Anna Univ leaked question paper 2026', description: 'Get all semester papers in advance' }),
    });
    const t3Data = await t3Res.json();
    record('SCAN-03', 'Tier 1 Prohibited: Exam Paper Leaks (Block)', t3Data.decision === 'block', `Decision: ${t3Data.decision}`);

    const t4Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Engineering Calculator', description: 'Good condition, contact whatsapp me at 9876543210 for external payment' }),
    });
    const t4Data = await t4Res.json();
    record('SCAN-04', 'Tier 2 Suspicious: Off-platform contact (Flag)', t4Data.decision === 'flag', `Decision: ${t4Data.decision}`);

    const t5Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Engineering Physics 1st Sem Textbook', description: 'Standard textbook with past university question paper solutions' }),
    });
    const t5Data = await t5Res.json();
    record('SCAN-05', 'Tier 3 Academic Item: Textbook (Allow)', t5Data.decision === 'allow', `Decision: ${t5Data.decision}`);

    // -------------------------------------------------------------------------
    // SECTION 2: Core Admin Moderation Criteria (ADMIN-01 to ADMIN-12)
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Core Admin Moderation Test Criteria (ADMIN-01 to ADMIN-12) ---');

    // ADMIN-01: unauthenticated admin request blocked
    const a1Overview = await fetch(`${apiBase}/api/admin/overview`);
    const a1Requests = await fetch(`${apiBase}/api/admin/requests`);
    const a1Reservations = await fetch(`${apiBase}/api/admin/reservations`);
    const admin01Passed = a1Overview.status === 403 && a1Requests.status === 403 && a1Reservations.status === 403;
    record('ADMIN-01', 'Unauthenticated admin requests blocked (HTTP 403)', admin01Passed, `Overview: ${a1Overview.status}, Requests: ${a1Requests.status}, Reservations: ${a1Reservations.status}`);

    // ADMIN-02: normal student cannot access admin data
    const a2Overview = await fetch(`${apiBase}/api/admin/overview`, { headers: { Authorization: `Bearer ${student.idToken}` } });
    const a2Users = await fetch(`${apiBase}/api/admin/users`, { headers: { Authorization: `Bearer ${student.idToken}` } });
    const a2Requests = await fetch(`${apiBase}/api/admin/requests`, { headers: { Authorization: `Bearer ${student.idToken}` } });
    const a2Reservations = await fetch(`${apiBase}/api/admin/reservations`, { headers: { Authorization: `Bearer ${student.idToken}` } });
    const admin02Passed = a2Overview.status === 403 && a2Users.status === 403 && a2Requests.status === 403 && a2Reservations.status === 403;
    record('ADMIN-02', 'Normal student cannot access admin endpoints (HTTP 403)', admin02Passed, `Overview: ${a2Overview.status}, Users: ${a2Users.status}, Requests: ${a2Requests.status}, Reservations: ${a2Reservations.status}`);

    // Create a temporary test request by Student A
    const testReqId = `req_adm_test_${Date.now()}`;
    const createReqRes = await fetch(`${firestoreBase}/requests?documentId=${testReqId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
      body: JSON.stringify({
        fields: {
          id: { stringValue: testReqId },
          title: { stringValue: 'Original Student Request' },
          description: { stringValue: 'Original description needed for semester project' },
          category: { stringValue: 'Textbooks' },
          neededBy: { stringValue: 'Next week' },
          location: { stringValue: 'Main Gate' },
          status: { stringValue: 'open' },
          requesterId: { stringValue: student.localId },
          createdAt: { timestampValue: new Date().toISOString() },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    // ADMIN-03: normal student cannot edit request via admin mutation endpoint
    const a3Res = await fetch(`${apiBase}/api/admin/requests/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
      body: JSON.stringify({
        requestId: testReqId,
        title: 'Tampered Title',
        description: 'Tampered description',
        category: 'Electronics',
        neededBy: 'Tomorrow',
        location: 'Hostel',
        reason: 'Unauthorized student mutation',
      }),
    });
    record('ADMIN-03', 'Normal student cannot execute admin request edit (HTTP 403)', a3Res.status === 403, `HTTP ${a3Res.status}`);

    // Create a temporary listing by Student A
    const testListId = `list_adm_test_${Date.now()}`;
    const createListRes = await fetch(`${firestoreBase}/listings?documentId=${testListId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
      body: JSON.stringify({
        fields: {
          id: { stringValue: testListId },
          title: { stringValue: 'Calculus Textbook Edition 9' },
          description: { stringValue: 'Hardcover edition with solutions' },
          category: { stringValue: 'Textbooks' },
          type: { stringValue: 'Sale' },
          condition: { stringValue: 'Good' },
          price: { integerValue: "350" },
          location: { stringValue: 'Library' },
          sellerId: { stringValue: student.localId },
          status: { stringValue: 'available' },
          createdAt: { timestampValue: new Date().toISOString() },
          expiresAt: { timestampValue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() },
        },
      }),
    });

    // ADMIN-04: normal student cannot delete listing via admin moderation endpoint
    const a4Res = await fetch(`${apiBase}/api/admin/listings/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
      body: JSON.stringify({ listingId: testListId, action: 'remove', reason: 'Student unauthorized delete' }),
    });
    record('ADMIN-04', 'Normal student cannot delete or moderate listing (HTTP 403)', a4Res.status === 403, `HTTP ${a4Res.status}`);

    // ADMIN-05: admin can view requests
    const a5Res = await fetch(`${apiBase}/api/admin/requests`, {
      headers: { Authorization: `Bearer ${admin.idToken}` },
    });
    const a5Data = await a5Res.json();
    const admin05Passed = a5Res.ok && Array.isArray(a5Data.requests) && a5Data.requests.some((r) => r.id === testReqId);
    record('ADMIN-05', 'Admin can view all campus requests (HTTP 200 & array)', admin05Passed, `Found ${a5Data.requests?.length || 0} requests`);

    // ADMIN-06: admin can view request details
    const targetReq = a5Data.requests?.find((r) => r.id === testReqId);
    const admin06Passed = targetReq && targetReq.title && targetReq.category && targetReq.requesterId === student.localId && targetReq.location;
    record('ADMIN-06', 'Admin can view complete request details & requester info', Boolean(admin06Passed), `Title: "${targetReq?.title}", Requester: ${targetReq?.requesterName || targetReq?.requesterId}`);

    // ADMIN-07: admin can edit valid request safely
    const a7Res = await fetch(`${apiBase}/api/admin/requests/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.idToken}` },
      body: JSON.stringify({
        requestId: testReqId,
        title: 'Updated Calculus Help Request [Admin Reviewed]',
        description: 'Updated description complying with community guidelines',
        category: 'Textbooks',
        neededBy: 'Tomorrow morning',
        location: 'Central Library',
        budget: 250,
        reason: 'Campus guideline compliance standardization',
      }),
    });
    const a7Data = await a7Res.json();
    record('ADMIN-07', 'Admin can safely edit request details (HTTP 200)', a7Res.ok, `Message: ${a7Data.message}`);

    // ADMIN-08: invalid admin request edit rejected
    const a8Res = await fetch(`${apiBase}/api/admin/requests/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.idToken}` },
      body: JSON.stringify({
        requestId: testReqId,
        title: '', // Invalid empty title
        description: '',
        category: 'Textbooks',
        neededBy: 'Tomorrow',
        location: 'Central Library',
        reason: 'Missing fields',
      }),
    });
    record('ADMIN-08', 'Invalid admin request edit rejected with HTTP 400', a8Res.status === 400, `HTTP ${a8Res.status}`);

    // ADMIN-09: admin can moderate listing (hide, remove, restore)
    const a9Hide = await fetch(`${apiBase}/api/admin/listings/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.idToken}` },
      body: JSON.stringify({ listingId: testListId, action: 'hide', reason: 'Under safety review' }),
    });
    const a9Restore = await fetch(`${apiBase}/api/admin/listings/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.idToken}` },
      body: JSON.stringify({ listingId: testListId, action: 'restore', reason: 'Cleared review' }),
    });
    record('ADMIN-09', 'Admin can moderate listing: hide & restore (HTTP 200)', a9Hide.ok && a9Restore.ok, `Hide: ${a9Hide.status}, Restore: ${a9Restore.status}`);

    // ADMIN-10: unauthorized user cannot modify or read audit log
    const a10Tamper = await fetch(`${firestoreBase}/admin_audit_logs/tamper_log`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
      body: JSON.stringify({
        fields: {
          action: { stringValue: 'FORGED_AUDIT' },
        },
      }),
    });
    const a10Read = await fetch(`${firestoreBase}/admin_audit_logs`, {
      headers: { Authorization: `Bearer ${student.idToken}` },
    });
    record('ADMIN-10', 'Unauthorized user cannot modify or read audit logs (HTTP 403)', a10Tamper.status === 403 && a10Read.status === 403, `Write: ${a10Tamper.status}, Read: ${a10Read.status}`);

    // ADMIN-11: admin audit entry created after moderation action in persistent Firestore
    const a11Res = await fetch(`${apiBase}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${admin.idToken}` },
    });
    const a11Data = await a11Res.json();
    const editAuditEntry = a11Data.logs?.find((l) => l.action === 'EDIT_REQUEST' && l.targetId === testReqId);

    // Direct verification against persistent Firestore database
    const directAuditRes = await fetch(`${firestoreBase}/admin_audit_logs`, {
      headers: { Authorization: `Bearer ${admin.idToken}` },
    });
    const directAuditData = await directAuditRes.json();
    const directDoc = directAuditData.documents?.find((d) => {
      const f = d.fields || {};
      return f.action?.stringValue === 'EDIT_REQUEST' && f.targetId?.stringValue === testReqId;
    });

    const admin11Passed = Boolean(editAuditEntry) && Boolean(directDoc);
    record('ADMIN-11', 'Admin audit entry persisted in Firestore collection', admin11Passed, `API Log: ${Boolean(editAuditEntry)}, Firestore Doc: ${Boolean(directDoc)} (${directDoc?.name?.split('/').pop() || 'none'})`);

    // ADMIN-12: reservation security remains intact
    // Normal student B attempts to accept reservation A without being the seller
    const a12Tamper = await fetch(`${firestoreBase}/reservations/fake_res_tamper`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
      body: JSON.stringify({
        fields: {
          status: { stringValue: 'accepted' },
        },
      }),
    });
    record('ADMIN-12', 'Reservation transition security remains strictly intact (HTTP 403)', a12Tamper.status === 403, `HTTP ${a12Tamper.status}`);

    // Clean up test documents
    try {
      await fetch(`${firestoreBase}/requests/${testReqId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.idToken}` },
      });
      await fetch(`${firestoreBase}/listings/${testListId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.idToken}` },
      });
      if (directDoc?.name) {
        await fetch(`https://firestore.googleapis.com/v1/${directDoc.name}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${admin.idToken}` },
        });
      }
    } catch {
      // ignore cleanup errors
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('                      VERIFICATION SUMMARY                      ');
    console.log('================================================================');
    results.forEach((r) => {
      console.log(`[${r.status.padEnd(4)}] Test ${r.id.padEnd(8)}: ${r.name}`);
    });
    console.log('----------------------------------------------------------------');
    const allPassed = results.every((r) => r.status === 'PASS');
    console.log(`OVERALL RESULT: ${allPassed ? `ALL ${results.length} CHECKS PASSED` : 'SOME CHECKS FAILED'}`);
    console.log('================================================================\n');

    if (!allPassed) {
      process.exit(1);
    }
  } finally {
    if (serverProcess) {
      console.log('[Teardown] Stopping test server...');
      serverProcess.kill();
    }
  }
}

runModerationTests().catch((err) => {
  console.error('Fatal error during moderation test run:', err);
  process.exit(1);
});
