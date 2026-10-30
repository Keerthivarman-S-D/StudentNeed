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

console.log('\n--- Running StudentNeed Production Regression Verification Tests ---\n');

// 1. Strict Error Check in NotificationContext
{
  const notifSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/NotificationContext.tsx'), 'utf-8');
  assert(
    notifSrc.includes("throw new Error('useNotifications must be used within a NotificationProvider')"),
    'NotificationContext strictly enforces provider presence (does not silently swallow errors)'
  );
}

// 2. Strict Error Check in AppContext
{
  const appCtxSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf-8');
  assert(
    appCtxSrc.includes("throw new Error('useAppContext must be used within an AppProvider')"),
    'AppContext strictly enforces provider presence (does not silently swallow errors)'
  );
  assert(
    appCtxSrc.includes('export const AppContext = createContext'),
    'AppContext exports the raw Context for ancestor checking'
  );
}

// 3. Provider Placement & NotificationToast Guarding
{
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert(
    appSrc.includes('<MarketplaceProviders>') &&
    appSrc.includes('<NotificationToast />') &&
    appSrc.includes('</MarketplaceProviders>'),
    'App.tsx renders NotificationToast strictly INSIDE MarketplaceProviders'
  );
  const appContentBody = appSrc.substring(appSrc.indexOf('function AppContent'), appSrc.indexOf('function AppShell'));
  assert(
    !appContentBody.includes('<NotificationToast'),
    'AppContent completely eliminates NotificationToast from public shell'
  );
  assert(
    appSrc.includes('hideAppNavbar = isLaunchActive || isAuthPage'),
    'App.tsx hides navbar on launch and auth/legal pages'
  );
  assert(
    appSrc.includes("'/terms', '/privacy'"),
    'Legal routes (/terms, /privacy) are treated as standalone public pages'
  );
}

// 4. Firestore Long Polling and Strict CSP
{
  const firebaseSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/firebase.ts'), 'utf-8');
  assert(
    firebaseSrc.includes('experimentalForceLongPolling: true'),
    'Firestore initializes with experimentalForceLongPolling: true to eliminate WebChannel data-probe CSP blocks'
  );
  assert(
    firebaseSrc.includes('firebaseConfig.firestoreDatabaseId'),
    'Firestore initializes with dedicated firestoreDatabaseId'
  );

  const firebaseJson = fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8');
  assert(
    !firebaseJson.includes("connect-src 'self' data:") && !firebaseJson.includes('data:text/plain'),
    'CSP connect-src directive is NOT weakened with data: URI allowance'
  );
  assert(
    firebaseJson.includes('https://firestore.googleapis.com'),
    'CSP connect-src explicitly permits official Firestore endpoints'
  );
}

// 5. Live Showcase Preserved with Real AppProvider Wrapping
{
  const liveShowcasePath = path.join(process.cwd(), 'src/components/LiveShowcaseSection.tsx');
  assert(fs.existsSync(liveShowcasePath), 'LiveShowcaseSection component exists');
  const liveShowcaseSrc = fs.readFileSync(liveShowcasePath, 'utf-8');
  assert(
    liveShowcaseSrc.includes('<AppProvider>') && liveShowcaseSrc.includes('</AppProvider>'),
    'LiveShowcaseSection ensures it is wrapped in an actual AppProvider with real Firestore access'
  );
  assert(
    liveShowcaseSrc.includes('useContext(AppContext)'),
    'LiveShowcaseSection checks for existing ancestor AppContext before creating provider'
  );
  assert(
    liveShowcaseSrc.includes('liveListings.length >= 4') && liveShowcaseSrc.includes('<ListingCard'),
    'LiveShowcaseSection dynamically displays live ListingCards when >= 4 active listings exist'
  );
  assert(
    liveShowcaseSrc.includes('sampleItems.map'),
    'LiveShowcaseSection falls back to curated sample items when fewer than 4 live listings exist'
  );

  const launchSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Launch.tsx'), 'utf-8');
  assert(
    launchSrc.includes("lazy(() => import('../components/LiveShowcaseSection'))"),
    'Launch.tsx dynamically imports LiveShowcaseSection'
  );
  assert(
    launchSrc.includes('<SampleItemsGrid'),
    'Launch.tsx renders SampleItemsGrid instantly as zero-flicker Suspense fallback'
  );
}

console.log(`\nRegression Verification Tests Completed: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
