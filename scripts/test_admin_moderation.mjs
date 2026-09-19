import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const { apiKey, projectId, firestoreDatabaseId } = config;
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;
const apiBase = 'http://localhost:3000';

const TEST_STUDENT_EMAIL = process.env.TEST_STUDENT_EMAIL || 'student_a_test@student.annauniv.edu';
const TEST_PASSWORD = process.env.TEST_STUDENT_PASSWORD || '';
const TEST_ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || '';

if (!TEST_PASSWORD) {
  console.error('Please set TEST_STUDENT_PASSWORD before running this test.');
  process.exit(1);
}

async function getStudentToken(email, password) {
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to sign in ${email}: ${JSON.stringify(data)}`);
  }
  return { idToken: data.idToken, localId: data.localId, email };
}

async function runModerationTests() {
  console.log('================================================================');
  console.log('   StudentNeed Admin Moderation v1 - Automated Verification     ');
  console.log('================================================================\n');

  const results = [];
  function record(id, name, pass, details) {
    const status = pass ? 'PASS' : 'FAIL';
    results.push({ id, name, status, details });
    console.log(`[${status}] #${id}: ${name} -> ${details}`);
  }

  // 1. Authenticate test student
  console.log('[Setup] Authenticating test student...');
  const student = await getStudentToken(TEST_STUDENT_EMAIL, TEST_PASSWORD);
  console.log(`[Setup] Student authenticated: ${student.email} (${student.localId})\n`);

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Content Moderation Scanner (Tier 1: Block, Tier 2: Flag, Tier 3: Allow)
  // -------------------------------------------------------------------------
  console.log('--- Section 1: Content Moderation Scanner ---');

  // Test 1: Tier 1 - Weapon / firearm detection -> Block
  const t1Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Glock Pistol with Ammunition and Bullets', description: 'Working condition handgun' }),
  });
  const t1Data = await t1Res.json();
  record(1, 'Tier 1 Prohibited Content: Weapons & Ammo (Block)', t1Data.decision === 'block' && t1Data.confidence === 'high', `Decision: ${t1Data.decision}, Category: ${t1Data.category}`);

  // Test 2: Tier 1 - Illegal drugs detection -> Block
  const t2Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hostel supply of weed and marijuana', description: 'Fresh stuff available' }),
  });
  const t2Data = await t2Res.json();
  record(2, 'Tier 1 Prohibited Content: Controlled Substances (Block)', t2Data.decision === 'block' && t2Data.confidence === 'high', `Decision: ${t2Data.decision}, Category: ${t2Data.category}`);

  // Test 3: Tier 1 - Exam leaks & academic fraud -> Block
  const t3Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Anna Univ leaked question paper 2026', description: 'Get all semester papers in advance' }),
  });
  const t3Data = await t3Res.json();
  record(3, 'Tier 1 Prohibited Content: Exam Paper Leaks (Block)', t3Data.decision === 'block', `Decision: ${t3Data.decision}, Category: ${t3Data.category}`);

  // Test 4: Tier 1 - Financial scam / pyramid scheme -> Block
  const t4Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Double your money in 24 hours pyramid scheme', description: 'Crypto investment guaranteed' }),
  });
  const t4Data = await t4Res.json();
  record(4, 'Tier 1 Prohibited Content: Financial Scams (Block)', t4Data.decision === 'block', `Decision: ${t4Data.decision}, Category: ${t4Data.category}`);

  // Test 5: Tier 2 - Off-platform contact / suspicious communication -> Flag
  const t5Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Engineering Calculator', description: 'Good condition, contact whatsapp me at 9876543210 for external payment' }),
  });
  const t5Data = await t5Res.json();
  record(5, 'Tier 2 Suspicious Activity: Off-platform contact (Flag)', t5Data.decision === 'flag' && t5Data.confidence === 'medium', `Decision: ${t5Data.decision}, Category: ${t5Data.category}`);

  // Test 6: Tier 3 - Normal academic marketplace item -> Allow
  const t6Res = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Engineering Physics 1st Sem Textbook', description: 'Standard textbook with past university question paper solutions' }),
  });
  const t6Data = await t6Res.json();
  record(6, 'Tier 3 Normal Campus Item: Textbook & Exam prep (Allow)', t6Data.decision === 'allow', `Decision: ${t6Data.decision}`);

  // Test 7: False positive prevention on benign campus items (water gun toy, hot glue gun, chemistry lab coat)
  const t7Res1 = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hot glue gun for architecture model making', description: 'Comes with 10 glue sticks' }),
  });
  const t7Data1 = await t7Res1.json();
  const t7Res2 = await fetch(`${apiBase}/api/moderation/check-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'White Chemistry Lab Coat Size L', description: 'Used for one semester in chemistry lab' }),
  });
  const t7Data2 = await t7Res2.json();
  record(7, 'False Positive Resistance: Benign tools (Hot glue gun, Lab coat)', t7Data1.decision === 'allow' && t7Data2.decision === 'allow', `Glue gun: ${t7Data1.decision}, Lab coat: ${t7Data2.decision}`);

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Admin Endpoints Server-Side Authorization
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: Admin Server-Side Authorization ---');

  // Test 8: Unauthenticated access to /api/admin/overview -> 403 Forbidden
  const t8Res = await fetch(`${apiBase}/api/admin/overview`);
  record(8, 'Unauthenticated access to /api/admin/overview blocked (403)', t8Res.status === 403, `HTTP ${t8Res.status}`);

  // Test 9: Authenticated normal student access to /api/admin/overview -> 403 Forbidden
  const t9Res = await fetch(`${apiBase}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${student.idToken}` },
  });
  record(9, 'Normal student access to /api/admin/overview blocked (403)', t9Res.status === 403, `HTTP ${t9Res.status}`);

  // Test 10: Authenticated normal student access to /api/admin/users -> 403 Forbidden
  const t10Res = await fetch(`${apiBase}/api/admin/users`, {
    headers: { Authorization: `Bearer ${student.idToken}` },
  });
  record(10, 'Normal student access to /api/admin/users blocked (403)', t10Res.status === 403, `HTTP ${t10Res.status}`);

  // Test 11: Authenticated normal student access to /api/admin/listings -> 403 Forbidden
  const t11Res = await fetch(`${apiBase}/api/admin/listings`, {
    headers: { Authorization: `Bearer ${student.idToken}` },
  });
  record(11, 'Normal student access to /api/admin/listings blocked (403)', t11Res.status === 403, `HTTP ${t11Res.status}`);

  // Test 12: Authenticated normal student access to /api/admin/reports -> 403 Forbidden
  const t12Res = await fetch(`${apiBase}/api/admin/reports`, {
    headers: { Authorization: `Bearer ${student.idToken}` },
  });
  record(12, 'Normal student access to /api/admin/reports blocked (403)', t12Res.status === 403, `HTTP ${t12Res.status}`);

  // Test 13: Authenticated normal student invoking admin mutation /api/admin/users/warn -> 403 Forbidden
  const t13Res = await fetch(`${apiBase}/api/admin/users/warn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
    body: JSON.stringify({ userId: 'any_user', reason: 'Abuse' }),
  });
  record(13, 'Normal student action /api/admin/users/warn blocked (403)', t13Res.status === 403, `HTTP ${t13Res.status}`);

  // Test 14: Authenticated normal student invoking admin mutation /api/admin/listings/moderate -> 403 Forbidden
  const t14Res = await fetch(`${apiBase}/api/admin/listings/moderate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
    body: JSON.stringify({ listingId: 'any_listing', action: 'hide', reason: 'Spam' }),
  });
  record(14, 'Normal student action /api/admin/listings/moderate blocked (403)', t14Res.status === 403, `HTTP ${t14Res.status}`);

  // -------------------------------------------------------------------------
  // TEST GROUP 3: User Reporting & Duplicate Prevention
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: User Reporting & Abuse Protection ---');

  // Test 15: Unauthenticated report submission -> 401 Unauthorized
  const t15Res = await fetch(`${apiBase}/api/reports/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId: 'l1', reason: 'Inappropriate content' }),
  });
  record(15, 'Unauthenticated report submission blocked (401)', t15Res.status === 401, `HTTP ${t15Res.status}`);

  // Test 16: Missing required fields on report submission -> 400 Bad Request
  const t16Res = await fetch(`${apiBase}/api/reports/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.idToken}` },
    body: JSON.stringify({ listingId: '', reason: '' }),
  });
  record(16, 'Empty fields report submission rejected (400)', t16Res.status === 400, `HTTP ${t16Res.status}`);

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Firestore Security Rules Enforcement
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: Firestore Security Rules Protection ---');

  // Test 17: Tampering with moderation fields on user profile (status, warningCount) -> 403 Forbidden
  const t17Res = await fetch(`${firestoreBase}/users/${student.localId}?updateMask.fieldPaths=status&updateMask.fieldPaths=warningCount`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.idToken}`,
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'active' },
        warningCount: { integerValue: "0" },
      },
    }),
  });
  record(17, 'Tamper user moderation status/warnings blocked by Firestore Rules (403)', t17Res.status === 403, `HTTP ${t17Res.status}`);

  // Test 18: Normal student reading admin_audit_logs subcollection/collection -> 403 Forbidden
  const t18Res = await fetch(`${firestoreBase}/admin_audit_logs`, {
    headers: { Authorization: `Bearer ${student.idToken}` },
  });
  record(18, 'Normal student read on admin_audit_logs blocked by Firestore Rules (403)', t18Res.status === 403, `HTTP ${t18Res.status}`);

  console.log('\n================================================================');
  console.log('                      VERIFICATION SUMMARY                      ');
  console.log('================================================================');
  results.forEach((r) => {
    console.log(`[${r.status.padEnd(4)}] Test #${String(r.id).padStart(2)}: ${r.name}`);
  });
  console.log('----------------------------------------------------------------');
  const allPassed = results.every((r) => r.status === 'PASS');
  console.log(`OVERALL RESULT: ${allPassed ? 'ALL 18 VERIFICATION CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runModerationTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
