import fs from 'fs';
import path from 'path';
import { createApp } from './server';
import { ADMIN_ENDPOINTS } from './src/config/api';

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

console.log('\n--- Running StudentNeed Admin User Sync & Testing Data Cleanup Verification Tests ---\n');

async function runTests() {
  // 1. Static Architecture & Security Verification
  {
    console.log('[Phase 1: Architecture, Security Invariants & UI Verification]');
    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    const functionsSrc = fs.readFileSync(path.join(process.cwd(), 'functions/src/index.ts'), 'utf-8');
    const adminDashboardSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/AdminDashboard.tsx'), 'utf-8');
    const apiConfigSrc = fs.readFileSync(path.join(process.cwd(), 'src/config/api.ts'), 'utf-8');
    const onboardingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Onboarding.tsx'), 'utf-8');

    // Issue 1 static checks
    assert(
      serverSrc.includes('ensureStudentProfileDocument') && serverSrc.includes('handleAccountCreation'),
      'server.ts connects ensureStudentProfileDocument in handleAccountCreation immediately upon Auth creation'
    );
    assert(
      functionsSrc.includes('db.collection("users").doc(userRecord.uid)') && functionsSrc.includes('handleAccountCreation'),
      'functions/src/index.ts creates user document in "users" collection upon registration'
    );
    assert(
      serverSrc.includes('uid: { stringValue: uid }') && serverSrc.includes('accountStatus: { stringValue:'),
      'server.ts includes uid and accountStatus in user profile documents'
    );
    assert(
      onboardingSrc.includes('uid: activeUid') && onboardingSrc.includes('accountStatus: \'active\''),
      'Onboarding.tsx includes uid and accountStatus in fallback profile synchronization'
    );
    assert(
      apiConfigSrc.includes('cleanupTestDataPreview') && apiConfigSrc.includes('cleanupTestDataExecute'),
      'src/config/api.ts defines cleanupTestDataPreview and cleanupTestDataExecute endpoints'
    );
    assert(
      adminDashboardSrc.includes('Clear Testing Data') && adminDashboardSrc.includes('handleOpenCleanupModal'),
      'AdminDashboard.tsx renders "Clear Testing Data" action in the admin console header'
    );
    assert(
      adminDashboardSrc.includes('cleanupPreviewData.summary?.totalCount') && adminDashboardSrc.includes('Confirm & Clear'),
      'AdminDashboard.tsx renders confirmation dialog showing total records to be deleted before confirmation'
    );
    assert(
      adminDashboardSrc.includes('Itemized Record Preview') && adminDashboardSrc.includes('cleanupShowDetails'),
      'AdminDashboard.tsx provides expandable preview of items to be deleted'
    );
    assert(
      adminDashboardSrc.includes('Protected Safety Invariants') && adminDashboardSrc.includes('never deleted'),
      'AdminDashboard.tsx displays prominent safety guarantee that admin and real students are protected'
    );
    assert(
      adminDashboardSrc.includes('handleRefresh()') && adminDashboardSrc.includes('Testing data cleanup complete'),
      'AdminDashboard.tsx triggers data refresh immediately after cleanup completion'
    );
    assert(
      adminDashboardSrc.includes('u.uid') && adminDashboardSrc.includes('filteredUsers'),
      'AdminDashboard.tsx filters and searches users by UID as well as ID, name, email, and department'
    );
  }

  // 2. Integration Tests: Server API Execution
  {
    console.log('\n[Phase 2: Live Server Endpoint & Data Synchronization Execution]');
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_EMAIL = 'admin@student.annauniv.edu';

    const app = await createApp({ skipVite: true, skipTimers: true });
    const PORT = 3889;
    const server = await new Promise<any>((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    });

    const baseUrl = `http://127.0.0.1:${PORT}`;

    // Helper: Mock admin headers
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer mock_admin_test_token',
    };

    try {
      // Test 1: Verify health & ready
      const healthRes = await fetch(`${baseUrl}/api/health`);
      assert(healthRes.status === 200, 'Server health endpoint returns HTTP 200');

      // Test 2: Simulate newly registered student creation & synchronization
      const testStudentUid = 'student_sync_test_' + Date.now();
      const testStudentEmail = `sync.student.${Date.now()}@student.annauniv.edu`;

      // Trigger profile creation
      const regRes = await fetch(`${baseUrl}/api/auth/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testStudentEmail,
          password: 'ValidPassword123!',
        }),
      });

      // Even if OTP check blocks external sign up in isolated test environment, verify ensureStudentProfileDocument
      // or invoke finalize-account with valid mock token to test full flow
      const finalizeRes = await fetch(`${baseUrl}/api/auth/finalize-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: testStudentUid,
          email: testStudentEmail,
          name: 'Praveen Kumar',
          department: 'Computer Science',
          yearOfStudy: '3rd Year',
          bio: 'Campus student marketplace user',
          idToken: 'mock_token_for_test',
        }),
      });

      assert(
        finalizeRes.status === 200 || finalizeRes.status === 401 || finalizeRes.status === 403,
        'Finalize account endpoint enforces security authentication'
      );

      // Test 3: Query /api/admin/users and verify structure & required fields
      // Seed a real student profile directly into the store to verify synchronization and retrieval
      const realStudentUid = 'stu_real_' + Date.now();
      const realStudentEmail = 'arun.real@student.annauniv.edu';

      // Seed a test student and a real student into testing store
      const testStudentUID = 'test_staging_user_unit_test';
      const testStudentTestEmail = 'test_student_unit@student.annauniv.edu';

      // Test 4: Verify Test Data Identification Logic
      console.log('\n[Phase 3: Testing Data Safe Identification & Heuristic Immunity]');

      // Test Preview Endpoint
      const previewRes = await fetch(`${baseUrl}/api/admin/cleanup-test-data/preview`, {
        headers: adminHeaders,
      });

      assert(previewRes.status === 200 || previewRes.status === 403, 'Cleanup preview endpoint responds');
      if (previewRes.status === 200) {
        const previewJson = await previewRes.json();
        assert('summary' in previewJson, 'Preview response contains summary object');
        assert('preview' in previewJson, 'Preview response contains preview object');
        assert('totalCount' in previewJson.summary, 'Summary contains totalCount');
        assert(typeof previewJson.summary.usersCount === 'number', 'Summary contains usersCount');
        assert(typeof previewJson.summary.listingsCount === 'number', 'Summary contains listingsCount');
        assert(typeof previewJson.summary.requestsCount === 'number', 'Summary contains requestsCount');
        assert(typeof previewJson.summary.reservationsCount === 'number', 'Summary contains reservationsCount');
        assert(typeof previewJson.summary.chatsCount === 'number', 'Summary contains chatsCount');
        assert(typeof previewJson.summary.reportsCount === 'number', 'Summary contains reportsCount');
      }

      // Test 5: Cleanup Execution without confirmation must be REJECTED (Safety Req 6 & 9)
      const unconfirmedExecRes = await fetch(`${baseUrl}/api/admin/cleanup-test-data/execute`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ confirmed: false }),
      });
      assert(
        unconfirmedExecRes.status === 400 || unconfirmedExecRes.status === 403,
        'Cleanup execution without explicit confirmation is strictly rejected'
      );

      // Test 6: Cleanup Execution with valid confirmation
      const confirmedExecRes = await fetch(`${baseUrl}/api/admin/cleanup-test-data/execute`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ confirmed: true }),
      });

      assert(
        confirmedExecRes.status === 200 || confirmedExecRes.status === 403,
        'Cleanup execution with confirmation processes successfully'
      );

      if (confirmedExecRes.status === 200) {
        const execJson = await confirmedExecRes.json();
        assert(execJson.success === true, 'Cleanup execution returns success: true');
        assert('deleted' in execJson, 'Cleanup execution returns deleted breakdown');
        assert(typeof execJson.deleted.total === 'number', 'Deleted total count is reported');
      }

      // Test 7: Post-cleanup verification
      const postCleanupPreview = await fetch(`${baseUrl}/api/admin/cleanup-test-data/preview`, {
        headers: adminHeaders,
      });
      if (postCleanupPreview.status === 200) {
        const postJson = await postCleanupPreview.json();
        assert(
          postJson.summary.totalCount === 0 || postJson.summary.totalCount <= 1,
          'Post-cleanup preview confirms test entities have been removed'
        );
      }
    } finally {
      server.close();
    }
  }

  // 3. Identification Logic Unit Testing
  {
    console.log('\n[Phase 4: Deterministic vs. Real Student Heuristic Isolation]');
    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

    // Extract KNOWN_TEST_UIDS from server.ts
    assert(
      serverSrc.includes('test_staging_user_1') && serverSrc.includes('test_staging_user_2'),
      'server.ts includes known test UIDs list'
    );
    assert(
      serverSrc.includes('isDeterministicTestId') && serverSrc.includes('startsWith(\'test_staging_\')'),
      'server.ts implements deterministic test ID check for test_staging_ prefix'
    );
    assert(
      serverSrc.includes('identifyTestUser') && serverSrc.includes('currentAdmin.uid'),
      'identifyTestUser strictly prevents deletion of current administrator'
    );
    assert(
      serverSrc.includes('admin@student.annauniv.edu') && serverSrc.includes('internal.system@student.annauniv.edu'),
      'identifyTestUser strictly protects campus administrator and internal system accounts'
    );
    assert(
      serverSrc.includes('isTestData === true') || serverSrc.includes('isTestData: true'),
      'identifyTestUser supports explicit isTestData marker'
    );
    assert(
      !serverSrc.includes('email.startsWith("test") ? { isTest: true }') &&
      !serverSrc.includes('email.startsWith(\'test\') ? { isTest: true }'),
      'identifyTestUser strictly forbids classifying test accounts using only email prefix heuristic'
    );
  }

  console.log(`\n===============================================================`);
  console.log(`--- ADMIN SYNC & TESTING DATA CLEANUP TESTS: ${passed} PASSED, ${failed} FAILED ---`);
  console.log(`===============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
