import fs from 'fs';
import path from 'path';
import {
  detectImageSignature,
  validateImageFile,
  MAX_IMAGE_FILE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
} from './src/lib/cloudinary';

console.log('\n===============================================================');
console.log('--- StudentNeed Profile Image Upload Verification Suite ---');
console.log('===============================================================\n');

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
  const onboardingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Onboarding.tsx'), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  const cloudinarySrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/cloudinary.ts'), 'utf-8');
  const profileSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Profile.tsx'), 'utf-8');
  const createListingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateListing.tsx'), 'utf-8');

  // --- Scenario 1: Authentication Before Upload Invariant ---
  console.log('\n[Scenario 1 & 2: Registration Flow & Authentication Order]');
  const createAccountIdx = onboardingSrc.indexOf('AUTH_ENDPOINTS.createAccount');
  const signInIdx = onboardingSrc.indexOf('signInWithEmailAndPassword(', createAccountIdx);
  const uploadAvatarIdx = onboardingSrc.indexOf('uploadImageToCloudinary(avatarFile');
  const finalizeAccountIdx = onboardingSrc.indexOf('AUTH_ENDPOINTS.finalizeAccount', uploadAvatarIdx);

  assert(
    createAccountIdx !== -1 && signInIdx !== -1 && uploadAvatarIdx !== -1 && finalizeAccountIdx !== -1,
    'All registration steps are present in Onboarding.tsx'
  );
  assert(
    createAccountIdx < signInIdx,
    'createAccount is executed before signInWithEmailAndPassword'
  );
  assert(
    signInIdx < uploadAvatarIdx,
    'Firebase user session is established BEFORE uploadImageToCloudinary is invoked'
  );
  assert(
    uploadAvatarIdx < finalizeAccountIdx,
    'uploadImageToCloudinary resolves BEFORE finalizeAccount is called with secure avatar URL'
  );

  // --- Scenario 3: Graceful Upload Failure Fallback & Non-blocking Registration ---
  console.log('\n[Scenario 3: Graceful Upload Failure Handling]');
  assert(
    onboardingSrc.includes('avatarUploadFailed = true') &&
    onboardingSrc.includes('finalAvatarUrl = defaultAvatarUrl'),
    'Onboarding falls back to default monogram if avatar upload fails'
  );
  assert(
    !onboardingSrc.substring(uploadAvatarIdx, finalizeAccountIdx).includes('return;'),
    'Onboarding does NOT abort registration if avatar upload fails'
  );
  assert(
    onboardingSrc.includes('Your profile photo could not be uploaded, but you can update it anytime in settings'),
    'Onboarding provides clear retry feedback if photo upload fails'
  );

  // --- Scenario 4: Server verifyStudentCaller 404 Handling During Onboarding ---
  console.log('\n[Scenario 4: Backend Student Verification During Onboarding]');
  const verifyCallerFn = serverSrc.substring(
    serverSrc.indexOf('async function verifyStudentCaller'),
    serverSrc.indexOf('async function verifyAdminOrSystem')
  );
  assert(
    verifyCallerFn.includes('uRes.status === 404') &&
    verifyCallerFn.includes('getOtpRecord') &&
    verifyCallerFn.includes('isEmailRegistered'),
    'server.ts verifyStudentCaller permits authentic students with verified OTP or registered email during onboarding'
  );
  assert(
    serverSrc.includes('studentneed/avatars') && serverSrc.includes('studentneed/listings'),
    'server.ts explicitly allows studentneed/avatars and studentneed/listings folders'
  );
  assert(
    serverSrc.includes('caller.uid') && serverSrc.includes('uniquePublicId'),
    'server.ts scopes Cloudinary public_id strictly to caller.uid'
  );

  // --- Scenario 5: Valid JPG Image Validation ---
  console.log('\n[Scenario 5: Valid JPG Validation]');
  const validJpgBytes = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01
  ]);
  const jpgSig = detectImageSignature(validJpgBytes);
  assert(jpgSig.format === 'jpeg' && jpgSig.isSafeImage, 'JPEG magic bytes (FF D8 FF) detected as safe image');

  const jpgBlob = new Blob([validJpgBytes], { type: 'image/jpeg' });
  const jpgFile = new File([jpgBlob], 'avatar.jpg', { type: 'image/jpeg' });
  const jpgValidation = await validateImageFile(jpgFile);
  assert(jpgValidation.valid, 'validateImageFile accepts valid JPEG avatar file');

  // --- Scenario 6: Valid PNG Image Validation ---
  console.log('\n[Scenario 6: Valid PNG Validation]');
  const validPngBytes = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
  ]);
  const pngSig = detectImageSignature(validPngBytes);
  assert(pngSig.format === 'png' && pngSig.isSafeImage, 'PNG magic bytes (89 50 4E 47 ...) detected as safe image');

  const pngBlob = new Blob([validPngBytes], { type: 'image/png' });
  const pngFile = new File([pngBlob], 'avatar.png', { type: 'image/png' });
  const pngValidation = await validateImageFile(pngFile);
  assert(pngValidation.valid, 'validateImageFile accepts valid PNG avatar file');

  // --- Scenario 7: Oversized Image Rejection ---
  console.log('\n[Scenario 7: Oversized Image Rejection]');
  // Create virtual 6MB blob
  const oversizedBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' });
  const oversizedFile = new File([oversizedBlob], 'large.jpg', { type: 'image/jpeg' });
  const oversizedValidation = await validateImageFile(oversizedFile);
  assert(
    !oversizedValidation.valid && (oversizedValidation.error || '').includes('exceeds the 5 MB limit'),
    'validateImageFile rejects files exceeding 5 MB limit'
  );

  // --- Scenario 8: Unsupported File Rejection (PDF, SVG, HTML) ---
  console.log('\n[Scenario 8: Unsupported File Rejections]');
  const pdfBytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35, 0x0A, 0x25, 0xD0, 0xD4, 0xC5, 0xD8
  ]);
  const pdfSig = detectImageSignature(pdfBytes);
  assert(pdfSig.format === 'pdf' && !pdfSig.isSafeImage, 'detectImageSignature rejects PDF');

  const pdfFile = new File([new Blob([pdfBytes], { type: 'application/pdf' })], 'document.pdf', { type: 'application/pdf' });
  const pdfValidation = await validateImageFile(pdfFile);
  assert(
    !pdfValidation.valid && (pdfValidation.error?.includes('Unsupported file format') || pdfValidation.error?.includes('PDF documents cannot be uploaded')),
    'validateImageFile explicitly rejects PDF uploads'
  );

  const svgText = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const svgBytes = new TextEncoder().encode(svgText);
  const svgSig = detectImageSignature(svgBytes);
  assert(svgSig.format === 'svg' && !svgSig.isSafeImage, 'detectImageSignature detects and flags malicious SVG');

  const svgFile = new File([new Blob([svgBytes], { type: 'image/svg+xml' })], 'vector.svg', { type: 'image/svg+xml' });
  const svgValidation = await validateImageFile(svgFile);
  assert(
    !svgValidation.valid && (svgValidation.error?.includes('Unsupported file format') || svgValidation.error?.includes('SVG vector files are not permitted')),
    'validateImageFile strictly rejects SVG uploads'
  );

  // --- Scenario 9: Existing Profile Settings & Marketplace Image Uploads Untouched ---
  console.log('\n[Scenario 9: Non-Regression on Working Features]');
  assert(
    profileSrc.includes('uploadImageToCloudinary(file,') &&
    profileSrc.includes("folder: 'studentneed/avatars'"),
    'Profile.tsx preserves working authenticated avatar upload'
  );
  assert(
    createListingSrc.includes('uploadImageToCloudinary(file,') &&
    createListingSrc.includes("folder: 'studentneed/listings'"),
    'CreateListing.tsx preserves working listing photos upload'
  );
  assert(
    onboardingSrc.includes('autoComplete="name"'),
    'Onboarding name input includes standard autoComplete attribute'
  );

  console.log('\n===============================================================');
  console.log(`Profile Image Upload Test Results: ${passed} passed, ${failed} failed.`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
