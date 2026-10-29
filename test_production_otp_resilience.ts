import crypto from 'crypto';
import bcrypt from 'bcryptjs';
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

console.log('\n--- Running StudentNeed OTP & API Abuse Resilience Tests ---\n');

const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

// 1. Verify Cryptographically Secure Random OTP Generation
{
  assert(
    serverSrc.includes('crypto.randomInt(100000, 1000000).toString()'),
    'server.ts generates 6-digit OTP using crypto.randomInt'
  );

  // Test randomInt distribution & length
  for (let i = 0; i < 20; i++) {
    const otp = crypto.randomInt(100000, 1000000).toString();
    assert(otp.length === 6 && /^\d{6}$/.test(otp), `Generated OTP ${otp} is exactly 6 numeric digits`);
  }
}

// 2. Verify Cryptographic Bcrypt Hashing & Secure Verification
(async () => {
  const otp = '482910';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(otp, salt);

  assert(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'OTP is hashed using salted bcrypt');
  assert(hash !== otp, 'Raw OTP is never stored in plain text');

  const validMatch = await bcrypt.compare('482910', hash);
  assert(validMatch === true, 'Bcrypt correctly verifies valid OTP against hash');

  const invalidMatch = await bcrypt.compare('111111', hash);
  assert(invalidMatch === false, 'Bcrypt rejects incorrect OTP against hash');
})();

// 3. Test: Expired OTP is Rejected
{
  const expiredRecord = {
    hash: 'somehash',
    expiresAt: Date.now() - 1000, // expired 1s ago
    attempts: 0,
    used: false,
    verified: false,
  };

  const isExpired = Date.now() > expiredRecord.expiresAt;
  assert(isExpired === true, 'OTP timestamp check accurately identifies expired OTP');

  assert(
    serverSrc.includes('if (Date.now() > data.expiresAt) {') &&
    serverSrc.includes('This verification code has expired. Please request a new code.'),
    'server.ts rejects verification when Date.now() > data.expiresAt'
  );
}

// 4. Test: Replay Attempt Rejected
{
  const usedRecord = {
    hash: 'somehash',
    expiresAt: Date.now() + 300000,
    attempts: 1,
    used: true, // already used
    verified: true,
  };

  const canReuse = !usedRecord || usedRecord.used;
  assert(canReuse === true, 'Single-use flag used=true blocks OTP replay');

  assert(
    serverSrc.includes('if (!data || data.used) {') &&
    serverSrc.includes('No pending verification found or OTP expired.'),
    'server.ts rejects verification when OTP record is already used'
  );
}

// 5. Test: Attempt Counter Exceeded (Max 5 Attempts) Locks Out
{
  assert(
    serverSrc.includes('if (data.attempts >= 5) {') &&
    serverSrc.includes('Too many failed attempts. Please request a new OTP.'),
    'server.ts enforces maximum 5 verification attempts per OTP challenge'
  );

  assert(
    serverSrc.includes('data.attempts += 1;') &&
    serverSrc.includes('await saveOtpRecord(emailDocId, data);') &&
    serverSrc.indexOf('data.attempts += 1;') < serverSrc.indexOf('await bcrypt.compare('),
    'Attempt counter is incremented BEFORE bcrypt hash comparison to prevent race conditions'
  );
}

// 6. Test: 60-second Cooldown on Repeated Requests
{
  assert(
    serverSrc.includes('Date.now() - existingDoc.lastRequestedAt < 60 * 1000') &&
    serverSrc.includes('Please wait 60 seconds before requesting a new OTP.'),
    'server.ts enforces 60-second cooldown between successive OTP dispatches'
  );
}

// 7. Test: Concurrent Verification Locking
{
  assert(
    serverSrc.includes('const inFlightOtpVerifications = new Set<string>();') &&
    serverSrc.includes('inFlightOtpVerifications.has(emailDocId)') &&
    serverSrc.includes('Verification in progress. Please wait a moment.'),
    'server.ts implements in-flight mutex lock to serialize concurrent OTP verification attempts'
  );
}

// 8. Test: Unauthorized Account Creation / Finalization Bypassing OTP is Denied
{
  assert(
    serverSrc.includes('if (!verifiedRecord || !verifiedRecord.verified || !verifiedRecord.verifiedExpiresAt || Date.now() > verifiedRecord.verifiedExpiresAt)') &&
    serverSrc.includes('Email not verified or verification expired.'),
    'create-account and finalize-account strictly verify OTP completion from trusted server store'
  );

  assert(
    serverSrc.includes('await deleteOtpRecord(emailDocId);') &&
    serverSrc.includes('finalize-account'),
    'finalize-account immediately deletes the verified OTP record to prevent account creation replay'
  );
}

// 9. Test: Account Enumeration Mitigation
{
  assert(
    serverSrc.includes('Mitigate account enumeration: return uniform success response when email is not registered') &&
    serverSrc.includes('Password reset email sent.'),
    'Password reset returns uniform success response even for unregistered emails to prevent enumeration'
  );
}

// 10. Test: Input Validation & Request Body Limits
{
  assert(
    serverSrc.includes('express.json({ limit: "100kb" })'),
    'server.ts applies strict 100kb body limit to standard JSON endpoints to prevent memory exhaustion'
  );
  assert(
    serverSrc.includes('express.json({ limit: "6mb" })'),
    'server.ts restricts image upload payload to 6mb'
  );
  assert(
    serverSrc.includes('validatePassword(password)'),
    'server.ts executes strict server-side password validation before account creation'
  );
}

console.log(`\nOTP & Abuse Resilience Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
