import fs from 'fs';
import path from 'path';
import { validatePassword } from './src/lib/passwordSecurity';

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

console.log('\n--- Running StudentNeed Authentication UI Redesign Verification Tests ---\n');

// 1. Verify Shared AuthLayout Structure & Visual Assets
{
  const layoutSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/AuthLayout.tsx'), 'utf-8');
  assert(layoutSrc.includes('LaunchHeader'), 'AuthLayout integrates LaunchHeader');
  assert(layoutSrc.includes('MIT Campus · Anna University'), 'AuthLayout displays campus badge');
  assert(layoutSrc.includes('Useful things. Closer connections.'), 'AuthLayout displays headline');
  assert(layoutSrc.includes("A campus-only space to find what you need") && (layoutSrc.includes("don't") || layoutSrc.includes("don&apos;t")), 'AuthLayout displays subheading');
  assert(layoutSrc.includes('/images/landing/hero-handoff.webp'), 'AuthLayout includes campus handoff image');
  assert(layoutSrc.includes('Find → Connect → Meet. No shipping. Just your campus.'), 'AuthLayout includes caption');
  assert(layoutSrc.includes('StudentNeed · Privacy Policy · Terms of Service'), 'AuthLayout displays footer notice');
  assert(layoutSrc.includes('bg-[#f7f6f2]') || layoutSrc.includes('bg-[#faf9f5]'), 'AuthLayout uses warm off-white background');
}

// 2. Verify Step 1: Email Registration Screen (Register.tsx)
{
  const regSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Register.tsx'), 'utf-8');
  assert(regSrc.includes('Join your campus.'), 'Register page renders "Join your campus." heading');
  assert(regSrc.includes('Create an account with your official student email.'), 'Register page renders description');
  assert(regSrc.includes('Only @student.annauniv.edu emails are accepted.') || regSrc.includes('COLLEGE_EMAIL_DOMAIN'), 'Register page enforces email domain notice');
  assert(regSrc.includes('Madras Institute of Technology · Anna University'), 'Register page renders campus identification panel');
  assert(regSrc.includes('Send Verification Code'), 'Register page includes Send Verification Code button');
  assert(regSrc.includes("send a code to your student email to confirm access") && (regSrc.includes("We'll") || regSrc.includes("We&apos;ll")), 'Register page includes verification note');
  assert(regSrc.includes('Already registered? Sign in') || (regSrc.includes('Already registered?') && regSrc.includes('Sign in')), 'Register page includes Sign in link');
  assert(regSrc.includes('AUTH_ENDPOINTS.sendOtp'), 'Register page calls sendOtp endpoint');
  assert(regSrc.includes('sessionStorage.setItem'), 'Register page preserves pending credentials for verification step');
}

// 3. Verify Step 2: Email OTP Verification Screen (VerifyEmail.tsx)
{
  const otpSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/VerifyEmail.tsx'), 'utf-8');
  assert(otpSrc.includes('Check your student email.'), 'VerifyEmail renders "Check your student email." heading');
  assert(otpSrc.includes('Enter the 6-digit code sent to your student email to confirm access.'), 'VerifyEmail renders subtitle');
  assert(otpSrc.includes('Verification code'), 'VerifyEmail renders Verification code label');
  assert(otpSrc.includes('digits.map'), 'VerifyEmail renders 6 separate digit boxes');
  assert(otpSrc.includes('handleDigitChange'), 'VerifyEmail supports single-digit entry');
  assert(otpSrc.includes('handleKeyDown'), 'VerifyEmail supports keyboard navigation and backspace');
  assert(otpSrc.includes('handlePaste') || otpSrc.includes('onPaste'), 'VerifyEmail supports paste of 6-digit code');
  assert(otpSrc.includes("Check your spam folder") && (otpSrc.includes("Didn't") || otpSrc.includes("Didn&apos;t")), 'VerifyEmail includes spam folder guidance');
  assert(otpSrc.includes('Resend code'), 'VerifyEmail includes Resend code button');
  assert(otpSrc.includes('Use a different email'), 'VerifyEmail includes Use a different email button');
  assert(otpSrc.includes("Keep your code private") && (otpSrc.includes("won't") || otpSrc.includes("won&apos;t")), 'VerifyEmail includes privacy reminder');
  assert(otpSrc.includes('AUTH_ENDPOINTS.verifyOtp'), 'VerifyEmail calls verifyOtp endpoint');
}

// 4. Verify Step 3: Complete Student Profile Screen (Onboarding.tsx)
{
  const onbSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Onboarding.tsx'), 'utf-8');
  assert(onbSrc.includes("Let's set up your profile!") || onbSrc.includes("Let&apos;s set up your profile!"), 'Onboarding renders "Let\'s set up your profile!" heading');
  assert(onbSrc.includes('Tell us a little about yourself to get started with StudentNeed.'), 'Onboarding renders subtitle');
  assert(onbSrc.includes('Year of study'), 'Onboarding includes Year of study label');
  assert(onbSrc.includes('Select your year'), 'Onboarding includes Year of study placeholder');
  assert(onbSrc.includes('1st Year') && onbSrc.includes('2nd Year') && onbSrc.includes('3rd Year') && onbSrc.includes('4th Year') && onbSrc.includes('Postgraduate'), 'Onboarding includes valid years of study');
  assert(onbSrc.includes('PasswordRequirements'), 'Onboarding integrates PasswordRequirements component');
  assert(onbSrc.includes('Create Password'), 'Onboarding includes Create Password field');
  assert(onbSrc.includes('Confirm Password'), 'Onboarding includes Confirm Password field');
  assert(onbSrc.includes('Madras Institute of Technology – Anna University'), 'Onboarding displays auto-populated MIT campus');
  assert(onbSrc.includes('Complete Profile'), 'Onboarding includes Complete Profile button');
  assert(onbSrc.includes('AUTH_ENDPOINTS.createAccount'), 'Onboarding completes account creation');
  assert(onbSrc.includes('AUTH_ENDPOINTS.finalizeAccount'), 'Onboarding finalizes profile');
}

// 4. Verify Sign-in Screen Structure & Handlers
{
  const loginSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf-8');
  assert(loginSrc.includes('Welcome back.'), 'Login page renders "Welcome back." heading');
  assert(loginSrc.includes('Sign in to connect with students on your campus.'), 'Login page renders subtitle');
  assert(loginSrc.includes('Use your official @student.annauniv.edu email.'), 'Login page includes official email hint');
  assert(loginSrc.includes('Forgot password?'), 'Login page includes Forgot password action');
  assert(loginSrc.includes('AUTH_ENDPOINTS.forgotPassword'), 'Login page connects forgotPassword endpoint');
  assert(loginSrc.includes('Your campus, your community'), 'Login page renders community panel heading');
  assert(loginSrc.includes('Sign in to reserve items, message peers and coordinate campus meetups.'), 'Login page renders community panel body');
  assert(loginSrc.includes('New to StudentNeed?'), 'Login page includes New to StudentNeed prompt');
  assert(loginSrc.includes('Create an account'), 'Login page includes Create an account button');
  assert(loginSrc.includes('By continuing, you agree to the Terms of Service and Privacy Policy.'), 'Login page renders terms footnote');
  assert(loginSrc.includes('signInWithEmailAndPassword'), 'Login page connects signInWithEmailAndPassword');
}

// 5. Verify App Routing
{
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert(appSrc.includes('path="/login"'), 'App.tsx defines /login route');
  assert(appSrc.includes('path="/register"'), 'App.tsx defines /register route');
  assert(appSrc.includes('path="/verify-email"'), 'App.tsx defines /verify-email route');
  assert(appSrc.includes('isAuthPage'), 'App.tsx detects auth routes and customizes layout');
}

// 6. Verify LaunchHeader Auth Mode
{
  const headerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/LaunchHeader.tsx'), 'utf-8');
  assert(headerSrc.includes('How It Works'), 'LaunchHeader includes "How It Works"');
  assert(headerSrc.includes('About'), 'LaunchHeader includes "About"');
  assert(headerSrc.includes('Contact'), 'LaunchHeader includes "Contact"');
  assert(headerSrc.includes('Get Started'), 'LaunchHeader includes "Get Started"');
  assert(headerSrc.includes('Sign in'), 'LaunchHeader includes "Sign in"');
}

console.log(`\nAuth Redesign Verification Results: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
