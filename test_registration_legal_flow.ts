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

console.log('\n--- Running StudentNeed Registration Legal Flow Verification Tests ---\n');

const regPath = path.join(process.cwd(), 'src/pages/Register.tsx');
const termsPath = path.join(process.cwd(), 'src/pages/Terms.tsx');
const privacyPath = path.join(process.cwd(), 'src/pages/Privacy.tsx');
const appPath = path.join(process.cwd(), 'src/App.tsx');

const regSrc = fs.readFileSync(regPath, 'utf-8');
const termsSrc = fs.readFileSync(termsPath, 'utf-8');
const privacySrc = fs.readFileSync(privacyPath, 'utf-8');
const appSrc = fs.readFileSync(appPath, 'utf-8');

// Test A: Terms of Service link & target="_blank"
{
  assert(
    regSrc.includes('to="/terms"') &&
    regSrc.includes('target="_blank"') &&
    regSrc.includes('rel="noopener noreferrer"'),
    'Test A: Terms of Service link targets /terms in a new tab with rel="noopener noreferrer"'
  );
  assert(
    termsSrc.includes('handleBack') &&
    termsSrc.includes('window.close()') &&
    termsSrc.includes('navigate(-1)'),
    'Test A: Terms page includes smart back handler that returns to registration without redirecting to Launch'
  );
}

// Test B: Privacy Policy link & target="_blank"
{
  assert(
    regSrc.includes('to="/privacy"') &&
    regSrc.includes('target="_blank"') &&
    regSrc.includes('rel="noopener noreferrer"'),
    'Test B: Privacy Policy link targets /privacy in a new tab with rel="noopener noreferrer"'
  );
  assert(
    privacySrc.includes('handleBack') &&
    privacySrc.includes('window.close()') &&
    privacySrc.includes('navigate(-1)'),
    'Test B: Privacy page includes smart back handler that returns to registration without redirecting to Launch'
  );
}

// Test C: Legal links do not toggle consent checkbox or trigger form submission
{
  // Checkbox label separation: <Link> must NOT be nested inside <label htmlFor="terms-agreement-checkbox">
  const labelWithLink = /<label[^>]*htmlFor=["']terms-agreement-checkbox["'][^>]*>(?:(?!<\/label>)[\s\S])*?<Link/m.test(regSrc);
  assert(
    !labelWithLink,
    'Test C: Legal links are separated from <label htmlFor="terms-agreement-checkbox"> to prevent toggling the consent checkbox'
  );

  assert(
    regSrc.includes('registrationDraft') &&
    regSrc.includes('updateDraft'),
    'Test C: Registration form uses in-memory draft preservation across navigation'
  );
}

// Test D: No passwords exposed in browser storage (localStorage / sessionStorage)
{
  // Confirm that password is NOT stored in localStorage or sessionStorage in Register.tsx
  const hasLocalPassword = regSrc.includes('localStorage.setItem') && regSrc.includes('password');
  assert(
    !hasLocalPassword,
    'Test D: Plaintext password is NEVER stored in localStorage'
  );

  assert(
    regSrc.includes('clearRegistrationDraft'),
    'Test D: In-memory draft can be cleared, ensuring clean lifecycle'
  );
}

// Test E: Complete registration normally and confirm correct destination navigation
{
  assert(
    regSrc.includes("navigate('/verify-email'"),
    'Test E: Successful form validation and OTP request navigates to /verify-email'
  );
  assert(
    regSrc.includes('clearRegistrationDraft()'),
    'Test E: In-memory draft is wiped upon successful progression to verification'
  );
}

// Summary
console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
