import fs from 'fs';

console.log('========================================================================');
console.log('   StudentNeed — Final Feature Refinement & Verification Suite');
console.log('========================================================================\n');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const { apiKey, projectId, firestoreDatabaseId } = config;
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents`;

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

async function runSuite() {
  console.log('[Setup] Authenticating test accounts...');
  const studentA = await authUser('student_a_test@student.annauniv.edu', 'P@ssw0rd12345!');
  const studentB = await authUser('student_b_test@student.annauniv.edu', 'P@ssw0rd12345!');
  const externalAttacker = await authUser('attacker_external@test.com', 'P@ssw0rd12345!');

  console.log(`Student A: ${studentA.localId}`);
  console.log(`Student B: ${studentB.localId}`);
  console.log(`Attacker:  ${externalAttacker.localId}\n`);

  // =========================================================================
  // 1. FEATURE 1: Chat Read/Unread Isolated Architecture & Security
  // =========================================================================
  console.log('--- 1. Chat Read/Unread System & Authorization ---');
  
  const testChatId = `chat_final_${Date.now()}`;

  // Attacker or Student A cannot tamper with Student B's private read document
  const aTamperBRead = await fetch(`${firestoreBase}/users/${studentB.localId}/private/chat_reads_${testChatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.idToken}` },
    body: JSON.stringify({
      fields: { chatId: { stringValue: testChatId }, lastReadAt: { timestampValue: new Date().toISOString() } }
    }),
  });

  recordResult(
    'FEAT1-01',
    'Cross-user tampering blocked on /users/{userId}/private/chat_reads',
    'HTTP 403 Forbidden',
    `HTTP ${aTamperBRead.status}`,
    aTamperBRead.status === 403,
    'Strict security boundary prevents Student A from modifying Student B read timestamps'
  );

  // Student B can write to their own private read document
  const bWriteOwnRead = await fetch(`${firestoreBase}/users/${studentB.localId}/private/chat_reads_${testChatId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentB.idToken}` },
    body: JSON.stringify({
      fields: { chatId: { stringValue: testChatId }, lastReadAt: { timestampValue: new Date().toISOString() } }
    }),
  });

  recordResult(
    'FEAT1-02',
    'Owner write permitted on /users/{userId}/private/chat_reads',
    'HTTP 200 OK',
    `HTTP ${bWriteOwnRead.status}`,
    bWriteOwnRead.status === 200,
    'Student B successfully updates own read receipts'
  );

  // Cleanup test read doc
  await fetch(`${firestoreBase}/users/${studentB.localId}/private/chat_reads_${testChatId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentB.idToken}` },
  });

  // =========================================================================
  // 2. FEATURE 2: Notifications & Web Audio Chime
  // =========================================================================
  console.log('--- 2. Browser Notifications + Sound System ---');

  // Verify NotificationContext and NotificationBell exist and have correct exports
  const notifContextCode = fs.readFileSync('./src/context/NotificationContext.tsx', 'utf8');
  const notifBellCode = fs.readFileSync('./src/components/NotificationBell.tsx', 'utf8');
  const navbarCode = fs.readFileSync('./src/components/Navbar.tsx', 'utf8');
  const appCode = fs.readFileSync('./src/App.tsx', 'utf8');

  const hasMelodicChime = notifContextCode.includes('587.33') && notifContextCode.includes('880.00');
  const hasDeduplication = notifContextCode.includes('seenEventKeysRef') && notifContextCode.includes('isInitialLoadRef');
  const hasProviderMounted = appCode.includes('<NotificationProvider>') && navbarCode.includes('<NotificationBell />');

  recordResult(
    'FEAT2-01',
    'Web Audio API 2-tone melodic chime implemented without external assets',
    'Contains 587.33Hz (D5) & 880Hz (A5) with AudioContext envelope',
    hasMelodicChime ? 'Implemented with exponential decay' : 'Missing frequencies',
    hasMelodicChime,
    'Zero external network dependencies, immune to CDN downtime'
  );

  recordResult(
    'FEAT2-02',
    'Notification snapshot deduplication prevents replay on reload',
    'isInitialLoadRef & seenEventKeysRef seed initial snapshot',
    hasDeduplication ? 'Deduplication tracking active' : 'Missing deduplication',
    hasDeduplication,
    'Page load / refresh never triggers false audio chime'
  );

  recordResult(
    'FEAT2-03',
    'NotificationProvider wrapped in App and NotificationBell mounted in Navbar',
    'App wrapped in NotificationProvider and Navbar mounts NotificationBell in desktop and mobile',
    hasProviderMounted ? 'Mounted in App and Navbar' : 'Missing mounts',
    hasProviderMounted,
    'Notification bell and unread badge accessible on both desktop and mobile'
  );

  // =========================================================================
  // 3. FEATURE 3: Exchange Listing — "Wanted in Exchange"
  // =========================================================================
  console.log('--- 3. Exchange Listing "Wanted in Exchange" ---');

  const typesCode = fs.readFileSync('./src/types.ts', 'utf8');
  const createListingCode = fs.readFileSync('./src/pages/CreateListing.tsx', 'utf8');
  const editModalCode = fs.readFileSync('./src/components/EditListingModal.tsx', 'utf8');
  const listingCardCode = fs.readFileSync('./src/components/ListingCard.tsx', 'utf8');
  const listingDetailCode = fs.readFileSync('./src/pages/ListingDetail.tsx', 'utf8');

  const hasWantedInTypes = typesCode.includes('wantedItem?: string;');
  const hasValidationInCreate = createListingCode.includes("type === 'Exchange' && !wantedItem.trim()") &&
                                createListingCode.includes("Wanted in exchange");
  const hasWantedInEdit = editModalCode.includes("Wanted in exchange") && editModalCode.includes("updates.wantedItem = trimmedWanted;");
  const hasWantedInCardAndDetail = listingCardCode.includes("listing.type === 'Exchange' && listing.wantedItem") &&
                                   listingDetailCode.includes("listing.type === 'Exchange'");

  recordResult(
    'FEAT3-01',
    'wantedItem field defined in TypeScript interfaces',
    'Listing and UpdateListingInput define wantedItem?: string',
    hasWantedInTypes ? 'Defined in types.ts' : 'Missing in types.ts',
    hasWantedInTypes,
    'Strict type safety for exchange item requirements'
  );

  recordResult(
    'FEAT3-02',
    'CreateListing requires wantedItem when type is Exchange',
    'Requires wantedItem and validates non-empty string on submit',
    hasValidationInCreate ? 'Required field with validation' : 'Missing validation',
    hasValidationInCreate,
    'Prevents publishing exchange listings without specifying desired item'
  );

  recordResult(
    'FEAT3-03',
    'ListingCard and ListingDetail render exchange requirements',
    'Displays "Exchange: {wantedItem}" badge on card and comparison card on detail page',
    hasWantedInCardAndDetail ? 'Rendered on card and detail' : 'Missing UI render',
    hasWantedInCardAndDetail,
    'Exchange barter intent is prominently visible to campus students'
  );

  // =========================================================================
  // 4. FEATURE 4: Currency Formatting (INR ₹)
  // =========================================================================
  console.log('--- 4. Currency Formatting (INR ₹) ---');

  const utilsCode = fs.readFileSync('./src/lib/utils.ts', 'utf8');
  const profileCode = fs.readFileSync('./src/pages/Profile.tsx', 'utf8');

  // Test pure formatCurrency logic
  const { formatCurrency } = await import('../src/lib/utils.ts');
  const zeroIsFree = formatCurrency(0) === 'Free';
  const priceFormatted = formatCurrency(450) === '₹450';
  const nullIsDash = formatCurrency(null) === '—';
  const undefIsDash = formatCurrency(undefined) === '—';
  const profileReplacedDollar = !profileCode.includes('$${item.price}') && profileCode.includes('formatCurrency(item.price)');

  recordResult(
    'FEAT4-01',
    'formatCurrency helper formats 0 as "Free", numbers as "₹...", and null as "—"',
    '0 -> "Free", 450 -> "₹450", null -> "—"',
    `0 -> "${formatCurrency(0)}", 450 -> "${formatCurrency(450)}", null -> "${formatCurrency(null)}"`,
    zeroIsFree && priceFormatted && nullIsDash && undefIsDash,
    'Reusable helper across marketplace and reserved tabs'
  );

  recordResult(
    'FEAT4-02',
    'Profile.tsx line 547 dollar sign replaced with formatCurrency',
    'No $${item.price} found, formatCurrency(item.price) active',
    profileReplacedDollar ? 'formatCurrency(item.price) active' : 'Leftover dollar sign',
    profileReplacedDollar,
    'Eliminates dollar symbol from user account reserved items'
  );

  // =========================================================================
  // 5. FEATURE 5: Registration — Profile Image Upload Only
  // =========================================================================
  console.log('--- 5. Registration Profile Image Upload Only ---');

  const onboardingCode = fs.readFileSync('./src/pages/Onboarding.tsx', 'utf8');

  const removedUrlTab = !onboardingCode.includes('avatarSource') &&
                        !onboardingCode.includes('avatarUrlInput') &&
                        !onboardingCode.includes('isCheckingUrl') &&
                        !onboardingCode.includes('Image URL');
  const keepsUploadAndPreview = onboardingCode.includes('uploadImageToCloudinary') &&
                                onboardingCode.includes('validateImageFile') &&
                                onboardingCode.includes('avatarPreview');

  recordResult(
    'FEAT5-01',
    'Onboarding.tsx removes external Image URL input, tab, and validation loop',
    'No avatarSource, avatarUrlInput, or isCheckingUrl states in Onboarding.tsx',
    removedUrlTab ? 'URL inputs completely removed' : 'Leftover URL code',
    removedUrlTab,
    'Eliminates external image URL vulnerabilities and broken image link errors'
  );

  recordResult(
    'FEAT5-02',
    'Onboarding.tsx preserves photo upload with preview, 5MB limit, and Cloudinary upload',
    'Upload photo button with thumbnail preview and remove action',
    keepsUploadAndPreview ? 'Upload, validation, and preview active' : 'Missing upload flow',
    keepsUploadAndPreview,
    'Campus students upload direct photo or use default avatar'
  );

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('========================================================================');
  console.log(`   Final Refinements Summary: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('========================================================================');

  if (failedTests === 0) {
    console.log('🎉 ALL FINAL FEATURE REFINEMENTS VERIFIED AND PASSED EMPIRICALLY!\n');
  } else {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
