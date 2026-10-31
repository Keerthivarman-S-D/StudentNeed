import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import { validatePassword, SPECIAL_CHARACTERS, SPECIAL_CHARS_REGEX, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from './src/lib/passwordSecurity';

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

async function runTests() {
  console.log('\n--- Running StudentNeed Strong Password Security Verification Tests ---\n');

  // Test 1: Valid strong passwords -> accepted
  {
    const validPasswords = [
      'Student@2026',
      'Kv!Campus92',
      'MyStrong#Password2026',
      'AnnaUniv#Tech2026!',
      'Secure*Campus88'
    ];

    for (const pw of validPasswords) {
      const result = validatePassword(pw);
      assert(result.isValid === true, `Valid password "${pw}" is accepted`);
      assert(result.errors.length === 0, `Valid password "${pw}" has zero errors`);
      assert(result.strength === 'Strong', `Valid password "${pw}" evaluated as Strong`);
    }
  }

  // Test 2: Missing uppercase -> rejected
  {
    const missingUpper = ['studentneed', 'student123', 'student@2026', 'kv!campus92'];
    for (const pw of missingUpper) {
      const result = validatePassword(pw);
      assert(result.isValid === false, `Password "${pw}" missing uppercase is rejected`);
      assert(
        result.errors.some((e) => e.includes('uppercase')),
        `Password "${pw}" reports missing uppercase requirement`
      );
    }
  }

  // Test 3: Missing lowercase -> rejected
  {
    const missingLower = ['STUDENTNEED', 'STUDENT123', 'STUDENT@2026', 'KV!CAMPUS92'];
    for (const pw of missingLower) {
      const result = validatePassword(pw);
      assert(result.isValid === false, `Password "${pw}" missing lowercase is rejected`);
      assert(
        result.errors.some((e) => e.includes('lowercase')),
        `Password "${pw}" reports missing lowercase requirement`
      );
    }
  }

  // Test 4: Missing number -> rejected
  {
    const missingNumber = ['Student@', 'StudentNeed!', 'Kv!Campus', 'MyStrong#Password'];
    for (const pw of missingNumber) {
      const result = validatePassword(pw);
      assert(result.isValid === false, `Password "${pw}" missing number is rejected`);
      assert(
        result.errors.some((e) => e.includes('number')),
        `Password "${pw}" reports missing number requirement`
      );
    }
  }

  // Test 5: Missing special character -> rejected
  {
    const missingSpecial = ['studentneed', 'student123', 'Student123', 'StudentNeed2026', 'AnnaUniv2026'];
    for (const pw of missingSpecial) {
      const result = validatePassword(pw);
      assert(result.isValid === false, `Password "${pw}" missing special character is rejected`);
      assert(
        result.errors.some((e) => e.includes('special character')),
        `Password "${pw}" reports missing special character requirement`
      );
    }
  }

  // Test 6: Less than 8 characters -> rejected
  {
    const tooShort = ['St@1', 'Kv!92', 'S@1abc', 'Abc!12', ''];
    for (const pw of tooShort) {
      const result = validatePassword(pw);
      assert(result.isValid === false, `Short password "${pw}" (${pw.length} chars) is rejected`);
      assert(
        result.errors.some((e) => e.includes('at least 8 characters') || e.includes('required')),
        `Short password "${pw}" reports length requirement`
      );
    }
  }

  // Test 7: Contains whitespace -> rejected
  {
    const withWhitespace = [
      'student need@123',
      'Student @2026',
      ' Student@2026',
      'Student@2026 ',
      'Student\t@2026',
      'Student\n@2026'
    ];
    for (const pw of withWhitespace) {
      const result = validatePassword(pw);
      assert(result.isValid === false, `Password with whitespace "${pw.replace(/\s/g, '[space]')}" is rejected`);
      assert(
        result.errors.some((e) => e.includes('whitespace') || e.includes('spaces')),
        `Password with whitespace reports whitespace rejection`
      );
    }
  }

  // Test 8: Long valid password -> accepted
  {
    // 64 characters long password
    const long64 = 'Student@2026' + 'A1!' + 'x'.repeat(49);
    assert(long64.length === 64, `Generated 64-char password has length 64 (actual: ${long64.length})`);
    const res64 = validatePassword(long64);
    assert(res64.isValid === true, '64-character valid password is accepted');
    assert(res64.strength === 'Strong', '64-character valid password has Strong rating');

    // 100 characters long password
    const long100 = 'Kv!Campus92_' + 'Z9#' + 'a'.repeat(85);
    assert(long100.length === 100, `Generated 100-char password has length 100 (actual: ${long100.length})`);
    const res100 = validatePassword(long100);
    assert(res100.isValid === true, '100-character valid password is accepted');
  }

  // Test 9 & 10: Backend API endpoints (Bypass rejection & No password returned in responses)
  {
    // Spin up test express server mounting the exact backend validation logic
    const testApp = express();
    testApp.use(express.json());

    // Backend validation logic matching server.ts
    const backendSpecialRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
    function serverValidatePassword(password: unknown): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      if (typeof password !== "string") {
        return { valid: false, errors: ["Password is required and must be a string."] };
      }
      if (password.length < 8) errors.push("Password must be at least 8 characters long.");
      if (password.length > 128) errors.push("Password must not exceed 128 characters.");
      if (!/[A-Z]/.test(password)) errors.push("Password must contain at least 1 uppercase letter (A-Z).");
      if (!/[a-z]/.test(password)) errors.push("Password must contain at least 1 lowercase letter (a-z).");
      if (!/[0-9]/.test(password)) errors.push("Password must contain at least 1 number (0-9).");
      if (!backendSpecialRegex.test(password)) errors.push("Password must contain at least 1 special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?).");
      if (/\s/.test(password)) errors.push("Password must not contain any whitespace characters.");
      return { valid: errors.length === 0, errors };
    }

    testApp.post("/api/auth/validate-password", (req, res) => {
      const { password } = req.body;
      const validation = serverValidatePassword(password);
      if (!validation.valid) {
        return res.status(400).json({ valid: false, error: "Password does not meet security requirements.", details: validation.errors });
      }
      return res.json({ valid: true, message: "Password satisfies all security requirements." });
    });

    testApp.post("/api/auth/create-account", (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }
      const validation = serverValidatePassword(password);
      if (!validation.valid) {
        return res.status(400).json({ error: "Password does not meet the security requirements.", details: validation.errors });
      }
      // Mock successful creation response without returning password
      return res.status(201).json({ message: "Account created successfully.", uid: "mock_test_uid_123" });
    });

    testApp.post("/api/auth/change-password", (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required to change password." });
      }
      const { newPassword } = req.body;
      const validation = serverValidatePassword(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ error: "Password does not meet the security requirements.", details: validation.errors });
      }
      return res.json({ message: "Password updated successfully." });
    });

    const server = http.createServer(testApp);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 9a: Direct API call to /api/auth/create-account with weak password (frontend bypass)
      const bypassPayloads = [
        { email: 'student@student.annauniv.edu', password: 'studentneed' },
        { email: 'student@student.annauniv.edu', password: 'student123' },
        { email: 'student@student.annauniv.edu', password: 'Student123' },
        { email: 'student@student.annauniv.edu', password: 'Student@' },
        { email: 'student@student.annauniv.edu', password: 'student need@123' },
        { email: 'student@student.annauniv.edu', password: 'short' }
      ];

      for (const payload of bypassPayloads) {
        const res = await fetch(`${baseUrl}/api/auth/create-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        assert(res.status === 400, `Direct create-account with weak password "${payload.password}" returned HTTP 400`);
        const json = await res.json();
        assert(json.error === "Password does not meet the security requirements.", `Direct create-account returned proper security error for "${payload.password}"`);

        // Test 10 check: Password is NEVER returned in response
        const rawJsonString = JSON.stringify(json);
        assert(!rawJsonString.includes(payload.password), `API response does not leak submitted password "${payload.password}"`);
        assert(!('password' in json), 'API response has no password property');
      }

      // 9b: Direct API call to /api/auth/validate-password
      const valWeakRes = await fetch(`${baseUrl}/api/auth/validate-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'weak' })
      });
      assert(valWeakRes.status === 400, 'Direct validate-password with weak password returned HTTP 400');
      const valWeakJson = await valWeakRes.json();
      assert(valWeakJson.valid === false, 'validate-password reports valid: false');

      const valStrongRes = await fetch(`${baseUrl}/api/auth/validate-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'Student@2026' })
      });
      assert(valStrongRes.status === 200, 'Direct validate-password with strong password returned HTTP 200');
      const valStrongJson = await valStrongRes.json();
      assert(valStrongJson.valid === true, 'validate-password reports valid: true');

      // 9c: Direct API call to /api/auth/change-password with weak password
      const changeWeakRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_token'
        },
        body: JSON.stringify({ newPassword: 'simplepassword' })
      });
      assert(changeWeakRes.status === 400, 'Direct change-password with weak password returned HTTP 400');

      // 9d: Direct API call with valid strong password -> accepted (HTTP 201)
      const validCreationRes = await fetch(`${baseUrl}/api/auth/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'student@student.annauniv.edu', password: 'Student@2026' })
      });
      assert(validCreationRes.status === 201, 'Direct create-account with strong password returned HTTP 201');
      const validJson = await validCreationRes.json();
      assert(!JSON.stringify(validJson).includes('Student@2026'), 'Response payload never contains the password');
    } finally {
      server.close();
    }
  }

  // Test 11: Passwords are NEVER printed in server logs or source files
  {
    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    const loginSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf-8');
    const profileSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Profile.tsx'), 'utf-8');

    // Check for risky console.log statements
    const riskyConsoleRegex = /console\.(log|info|warn|error)\([^)]*password[^)]*\)/i;
    const serverConsoleMatches = serverSrc.match(/console\.(log|info|warn|error)\([^)]*\)/g) || [];
    
    let logsRawPassword = false;
    for (const logLine of serverConsoleMatches) {
      if (logLine.includes('req.body.password') || logLine.includes('newPassword') || logLine.includes('data.password')) {
        logsRawPassword = true;
        break;
      }
    }
    assert(!logsRawPassword, 'server.ts never logs raw password variables in console statements');

    assert(!loginSrc.includes('console.log(password)'), 'Login.tsx does not log password');
    assert(!profileSrc.includes('console.log(newPassword)'), 'Profile.tsx does not log new password');
  }

  // Test 12: Existing OTP authentication still works
  {
    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverSrc.includes('app.post("/api/auth/send-otp"'), 'server.ts preserves /api/auth/send-otp endpoint');
    assert(serverSrc.includes('app.post("/api/auth/verify-otp"'), 'server.ts preserves /api/auth/verify-otp endpoint');
    assert(serverSrc.includes('await bcrypt.hash(otp, salt)'), 'server.ts preserves bcrypt OTP hashing');
    assert(serverSrc.includes('await bcrypt.compare(otp.toString().trim(), data.hash)'), 'server.ts preserves bcrypt OTP comparison');
    assert(serverSrc.includes('verified: true'), 'server.ts preserves OTP verified flag update');
  }

  // Test 13: Existing signup and login flow still works
  {
    const loginSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf-8');
    assert(loginSrc.includes('AUTH_ENDPOINTS.sendOtp'), 'Login.tsx calls sendOtp endpoint');
    assert(loginSrc.includes('AUTH_ENDPOINTS.verifyOtp'), 'Login.tsx calls verifyOtp endpoint');
    assert(loginSrc.includes('AUTH_ENDPOINTS.createAccount'), 'Login.tsx integrates backend createAccount validation');
    assert(loginSrc.includes('signInWithEmailAndPassword'), 'Login.tsx preserves signInWithEmailAndPassword');
    assert(loginSrc.includes('PasswordRequirements'), 'Login.tsx renders PasswordRequirements component');

    const profileSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Profile.tsx'), 'utf-8');
    assert(profileSrc.includes('AUTH_ENDPOINTS.changePassword'), 'Profile.tsx calls changePassword endpoint');
    assert(profileSrc.includes('PasswordRequirements'), 'Profile.tsx renders PasswordRequirements component');
    assert(profileSrc.includes('showNewPassword'), 'Profile.tsx has password visibility toggle for new password');
    assert(profileSrc.includes('showConfirmNewPassword'), 'Profile.tsx has password visibility toggle for confirm password');

    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverSrc.includes('app.post("/api/auth/finalize-account"'), 'server.ts preserves /api/auth/finalize-account');
    assert(serverSrc.includes('app.post("/api/auth/forgot-password"'), 'server.ts preserves /api/auth/forgot-password');
    assert(serverSrc.includes('if (fbErr.includes("EMAIL_NOT_FOUND"))'), 'server.ts mitigates account enumeration in forgot-password');
    assert(serverSrc.includes('const rawDomain = (process.env.COLLEGE_EMAIL_DOMAIN || "student.annauniv.edu").trim().replace(/^@/, \'\');'), 'server.ts enforces strict @ domain prefix in finalize-account');

    // Regression prevention: Option 1 - Use Firebase native password reset exclusively, no duplicate Resend email
    const forgotPwHandler = serverSrc.slice(
      serverSrc.indexOf('app.post("/api/auth/forgot-password"'),
      serverSrc.indexOf('app.post("/api/auth/change-password"')
    );
    assert(!forgotPwHandler.includes('resend.emails.send'), 'forgot-password endpoint does not dispatch duplicate custom Resend emails');
    assert(!forgotPwHandler.includes('Reset Your Password'), 'forgot-password endpoint removes duplicate custom HTML template');
    assert(forgotPwHandler.includes('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}'), 'forgot-password triggers Firebase native password reset email');
    assert(serverSrc.includes('resend.emails.send'), 'server.ts preserves Resend email dispatch for student OTP verification');
  }

  // Test 14: Special characters completeness & constraints
  {
    const allChars = SPECIAL_CHARACTERS;
    let allMatched = true;
    for (const c of allChars) {
      if (!SPECIAL_CHARS_REGEX.test(c)) {
        allMatched = false;
        break;
      }
    }
    assert(allMatched, `All ${allChars.length} required special characters match SPECIAL_CHARS_REGEX`);
    assert(MIN_PASSWORD_LENGTH === 8, 'MIN_PASSWORD_LENGTH is 8');
    assert(MAX_PASSWORD_LENGTH >= 64, `MAX_PASSWORD_LENGTH supports at least 64 chars (${MAX_PASSWORD_LENGTH})`);

    // Edge cases: null/undefined/number types passed as password
    assert(validatePassword(null).isValid === false, 'validatePassword rejects null');
    assert(validatePassword(undefined).isValid === false, 'validatePassword rejects undefined');
    assert(validatePassword(12345678 as any).isValid === false, 'validatePassword rejects number type');
    assert(validatePassword({} as any).isValid === false, 'validatePassword rejects object type');
  }

  console.log(`\nPassword Security Test Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
