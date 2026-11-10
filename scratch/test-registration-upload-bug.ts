import fs from 'fs';
import path from 'path';
import { detectImageSignature, validateImageFile } from '../src/lib/cloudinary';

console.log('\n--- Investigating Registration Avatar Upload Bug ---\n');

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

async function runInvestigation() {
  const onboardingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Onboarding.tsx'), 'utf-8');
  const cloudinarySrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/cloudinary.ts'), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

  // 1. Trace Onboarding.tsx order of operations
  const uploadAvatarIdx = onboardingSrc.indexOf('uploadImageToCloudinary(avatarFile');
  const createAccountIdx = onboardingSrc.indexOf('AUTH_ENDPOINTS.createAccount');
  const signInCallIdx = onboardingSrc.indexOf('signInWithEmailAndPassword(', createAccountIdx);
  const finalizeAccountIdx = onboardingSrc.indexOf('AUTH_ENDPOINTS.finalizeAccount');

  console.log('Order of operations in existing Onboarding.tsx:');
  console.log(`  uploadImageToCloudinary index: ${uploadAvatarIdx}`);
  console.log(`  AUTH_ENDPOINTS.createAccount index: ${createAccountIdx}`);
  console.log(`  signInWithEmailAndPassword call index: ${signInCallIdx}`);
  console.log(`  AUTH_ENDPOINTS.finalizeAccount index: ${finalizeAccountIdx}`);

  assert(
    uploadAvatarIdx !== -1 && createAccountIdx !== -1 && signInCallIdx !== -1,
    'All registration steps found in Onboarding.tsx'
  );

  assert(
    uploadAvatarIdx < createAccountIdx,
    'CONFIRMED BUG: uploadImageToCloudinary is called BEFORE createAccount'
  );

  assert(
    uploadAvatarIdx < signInCallIdx,
    'CONFIRMED BUG: uploadImageToCloudinary is called BEFORE signInWithEmailAndPassword'
  );

  // 2. Check cloudinary.ts authentication precondition
  assert(
    cloudinarySrc.includes('const currentUser = auth.currentUser;') &&
    cloudinarySrc.includes('if (!currentUser)') &&
    cloudinarySrc.includes('throw new Error(\'Authentication required to upload photos'),
    'CONFIRMED BUG CAUSE: uploadImageToCloudinary strictly requires auth.currentUser to exist'
  );

  // 3. Inspect server.ts verifyStudentCaller for 404 user document handling
  const verifyCallerFn = serverSrc.substring(serverSrc.indexOf('async function verifyStudentCaller'), serverSrc.indexOf('async function verifyAdminOrSystem'));
  assert(
    verifyCallerFn.includes('if (uRes.ok)') && !verifyCallerFn.includes('uRes.status === 404'),
    'CONFIRMED SERVER LIMITATION: verifyStudentCaller does not allow verified students during onboarding before /users/{uid} document is created'
  );

  // 4. Test image format detection logic
  const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35, 0x0A, 0x25, 0xD0, 0xD4]);

  const jpegSig = detectImageSignature(jpegHeader);
  assert(jpegSig.format === 'jpeg' && jpegSig.isSafeImage, 'detectImageSignature correctly identifies JPEG');

  const pngSig = detectImageSignature(pngHeader);
  assert(pngSig.format === 'png' && pngSig.isSafeImage, 'detectImageSignature correctly identifies PNG');

  const webpSig = detectImageSignature(webpHeader);
  assert(webpSig.format === 'webp' && webpSig.isSafeImage, 'detectImageSignature correctly identifies WebP');

  const pdfSig = detectImageSignature(pdfHeader);
  assert(pdfSig.format === 'pdf' && !pdfSig.isSafeImage, 'detectImageSignature rejects PDF');

  console.log(`\nInvestigation Results: ${passed} passed, ${failed} failed.\n`);
}

runInvestigation().catch(console.error);
