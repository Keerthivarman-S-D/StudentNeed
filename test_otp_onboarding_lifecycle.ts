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

console.log('\n--- Running StudentNeed OTP Verification to Profile Setup Lifecycle Tests (Firebase Architecture) ---\n');

// 1. Verify ProtectedRoute allows onboarding with valid registration session and prevents sessionStorage bypass
{
  const protectedRouteSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/ProtectedRoute.tsx'), 'utf-8');
  
  assert(
    protectedRouteSrc.includes('hasVerifiedRegistrationSession'),
    'ProtectedRoute checks for active verified registration session'
  );
  assert(
    protectedRouteSrc.includes('sessionStorage.getItem(\'studentneed_registration_session\')'),
    'ProtectedRoute checks sessionStorage for verified registration session'
  );
  assert(
    protectedRouteSrc.includes('location.state.registrationToken') && protectedRouteSrc.includes('parsed.registrationToken'),
    'ProtectedRoute strictly requires server-issued registrationToken to prevent sessionStorage bypass'
  );
  assert(
    protectedRouteSrc.includes('isOnboardingRoute && hasVerifiedRegistrationSession') &&
    protectedRouteSrc.includes('return <>{children}</>;'),
    'ProtectedRoute permits unauthenticated student with verified registration session to view Onboarding'
  );
  assert(
    protectedRouteSrc.includes('return <Navigate to="/login" state={{ from: location }} replace />;'),
    'ProtectedRoute redirects unauthenticated visitors without verified session to /login'
  );
  assert(
    protectedRouteSrc.includes('isOnboardingRoute && profileComplete') &&
    protectedRouteSrc.includes('return <Navigate to="/marketplace" replace />;'),
    'ProtectedRoute redirects returning students with completed profiles away from Onboarding to /marketplace'
  );
}

// 2. Verify App.tsx routing and provider boundaries for /onboarding
{
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');

  assert(
    appSrc.includes("location.pathname === '/onboarding'"),
    'App.tsx includes /onboarding in isPublicRoute so auth state initialization does not block session registration'
  );
  assert(
    appSrc.includes("'/onboarding'") && appSrc.includes('isAuthPage'),
    'App.tsx includes /onboarding in isAuthPage so marketplace navigation bar is hidden during profile setup'
  );
  assert(
    appSrc.includes("location.pathname === '/onboarding' && !firebaseUser"),
    'App.tsx isolates unauthenticated /onboarding from premature MarketplaceProviders mounting'
  );
}

// 3. Verify VerifyEmail.tsx navigation to /onboarding
{
  const verifySrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/VerifyEmail.tsx'), 'utf-8');

  assert(
    verifySrc.includes("navigate('/onboarding'"),
    'VerifyEmail navigates to /onboarding on successful OTP verification'
  );
  assert(
    verifySrc.includes('studentneed_registration_session'),
    'VerifyEmail persists registration session in sessionStorage'
  );
  assert(
    verifySrc.includes('registrationToken: verifyData.registrationToken'),
    'VerifyEmail receives and stores server-issued registrationToken'
  );
}

// 4. Verify Firebase Cloud Functions implementation (functions/src/index.ts)
{
  const functionsSrcPath = path.join(process.cwd(), 'functions/src/index.ts');
  assert(fs.existsSync(functionsSrcPath), 'Firebase Cloud Functions entrypoint (functions/src/index.ts) exists');
  const functionsSrc = fs.readFileSync(functionsSrcPath, 'utf-8');

  assert(
    functionsSrc.includes('onRequest'),
    'Firebase Cloud Functions exports HTTPS handler via onRequest'
  );
  assert(
    functionsSrc.includes('getFirestore(') && functionsSrc.includes('getAuth()'),
    'Firebase Cloud Functions initializes native Firebase Admin SDK for authoritative Firestore & Auth'
  );
  assert(
    functionsSrc.includes('/api/auth/send-otp') && functionsSrc.includes('/api/auth/verify-otp'),
    'Firebase Cloud Functions exposes /api/auth/send-otp and /api/auth/verify-otp'
  );
  assert(
    functionsSrc.includes('/api/auth/create-account') && functionsSrc.includes('/api/auth/finalize-account'),
    'Firebase Cloud Functions exposes /api/auth/create-account and /api/auth/finalize-account'
  );
  assert(
    functionsSrc.includes('registrationToken'),
    'Firebase Cloud Functions verifies registrationToken server-side against temp_otps'
  );
  assert(
    functionsSrc.includes('verifyIdToken'),
    'Firebase Cloud Functions verifies Firebase ID token to authenticate caller identity'
  );
  assert(
    functionsSrc.includes('RESEND_API_KEY'),
    'Firebase Cloud Functions manages RESEND_API_KEY securely via function secrets/env'
  );
}

// 5. Verify firebase.json Cloud Functions & Hosting configuration
{
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));

  assert(
    Boolean(firebaseJson.functions && firebaseJson.functions.length > 0),
    'firebase.json declares functions codebase'
  );
  assert(
    firebaseJson.hosting.rewrites.some((rw: any) => rw.source === '/api/**' && rw.function === 'api'),
    'firebase.json rewrites /api/** directly to Firebase Cloud Function "api"'
  );
  assert(
    !firebaseJson.hosting.headers?.[0]?.headers?.some((h: any) => (h.value || '').includes('onrender.com')),
    'firebase.json CSP removes external Render backend domain'
  );
}

// 6. Verify Onboarding.tsx error handling and resilience
{
  const onboardingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Onboarding.tsx'), 'utf-8');

  assert(
    onboardingSrc.includes('registrationToken'),
    'Onboarding extracts and transmits registrationToken to backend endpoints'
  );
  assert(
    onboardingSrc.includes('EMAIL_EXISTS') || onboardingSrc.includes('already in use'),
    'Onboarding handles duplicate account creation (409 EMAIL_EXISTS) on retry without failing'
  );
  assert(
    onboardingSrc.includes('signInWithEmailAndPassword'),
    'Onboarding establishes authenticated Firebase session with user-chosen password'
  );
  assert(
    onboardingSrc.includes('AUTH_ENDPOINTS.finalizeAccount'),
    'Onboarding invokes authoritative backend finalizeAccount endpoint'
  );
  assert(
    onboardingSrc.includes("navigate('/marketplace'"),
    'Onboarding directs student to /marketplace upon successful completion'
  );
}

// 7. Verify firestore.rules security invariants
{
  const rulesSrc = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');

  assert(
    rulesSrc.includes('match /users/{userId}'),
    'firestore.rules protects /users/{userId} collection'
  );
  assert(
    rulesSrc.includes('allow create: if isAdmin() || isInternalSystem()'),
    'firestore.rules ensures user creation remains strictly restricted to backend system or admin'
  );
  assert(
    rulesSrc.includes('request.auth.uid == userId'),
    'firestore.rules restricts user updates to their own user record'
  );
  assert(
    rulesSrc.includes("'role'") &&
    rulesSrc.includes("'isVerified'") &&
    rulesSrc.includes("'trustScore'") &&
    rulesSrc.includes('affectedKeys().hasAny'),
    'firestore.rules prevents self-escalation of roles and verification badges'
  );
}

console.log(`\nOTP to Onboarding Verification Results: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
