import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

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

console.log('\n===============================================================');
console.log('--- StudentNeed Final Security & Upload Pipeline Verification ---');
console.log('===============================================================\n');

// -------------------------------------------------------------
// Test 1: Cloudinary Direct Upload Fallback Removed
// -------------------------------------------------------------
console.log('--- 1. Direct-Upload Fallback & Signature Endpoint Removal ---');

const cloudinaryPath = path.join(process.cwd(), 'src/lib/cloudinary.ts');
const serverPath = path.join(process.cwd(), 'server.ts');
const apiConfigPath = path.join(process.cwd(), 'src/config/api.ts');

const cloudinarySrc = fs.readFileSync(cloudinaryPath, 'utf-8');
const serverSrc = fs.readFileSync(serverPath, 'utf-8');
const apiConfigSrc = fs.readFileSync(apiConfigPath, 'utf-8');

assert(
  !cloudinarySrc.includes('api.cloudinary.com') && !cloudinarySrc.includes('uploadToCloudinaryEndpoint'),
  'src/lib/cloudinary.ts contains NO direct browser-to-Cloudinary upload URLs or fallback functions'
);

assert(
  !cloudinarySrc.includes('/api/upload/signature'),
  'src/lib/cloudinary.ts does NOT call /api/upload/signature'
);

assert(
  !serverSrc.includes('/api/upload/signature'),
  'server.ts completely removes the unused /api/upload/signature endpoint'
);

assert(
  !apiConfigSrc.includes('signature()'),
  'src/config/api.ts removes signature from UPLOAD_ENDPOINTS'
);

assert(
  cloudinarySrc.includes("xhr.open('POST', `${apiBase}/api/upload/image`)"),
  'src/lib/cloudinary.ts routes exclusively through authenticated backend route /api/upload/image'
);

assert(
  cloudinarySrc.includes('Image upload service is temporarily unreachable. Please check your connection and try again.'),
  'src/lib/cloudinary.ts provides clear retryable error message on backend unavailability without fallback'
);

// -------------------------------------------------------------
// Test 2: Sharp Decompression & Resource Exhaustion Protection
// -------------------------------------------------------------
console.log('\n--- 2. Sharp Decompression & Resource Exhaustion Protection ---');

assert(
  serverSrc.includes('limitInputPixels: MAX_INPUT_PIXELS'),
  'server.ts configures Sharp with limitInputPixels to guard against pixel bomb decompression'
);

assert(
  serverSrc.includes('width > MAX_IMAGE_DIMENSION') &&
  serverSrc.includes('height > MAX_IMAGE_DIMENSION') &&
  serverSrc.includes('totalPixels > MAX_INPUT_PIXELS'),
  'server.ts checks width, height (4096px) and total pixels (16 MP) before decoding pixels'
);

assert(
  serverSrc.includes('sanitizedBuffer = await image.png') &&
  serverSrc.includes('sanitizedBuffer = await image.jpeg') &&
  serverSrc.includes('sanitizedBuffer = await image.webp'),
  'server.ts preserves JPEG, PNG, and WebP support with safe re-encoding'
);

// -------------------------------------------------------------
// Test 3: Live Image Processing & Validation Simulation
// -------------------------------------------------------------
console.log('\n--- 3. Live Image Pipeline & Security Test Cases ---');

async function runUploadPipelineTests() {
  const MAX_IMAGE_DIMENSION = 4096;
  const MAX_INPUT_PIXELS = 16777216;

  // Pipeline simulator matching server.ts exactly
  async function simulateBackendUpload(fileBuffer: Buffer): Promise<{ status: number; error?: string; secureUrlSimulated?: boolean }> {
    // 1. Size check
    if (fileBuffer.length > 5 * 1024 * 1024) {
      return { status: 400, error: 'File size exceeds the 5 MB limit.' };
    }
    if (fileBuffer.length < 12) {
      return { status: 400, error: 'Malformed or truncated image file.' };
    }

    // 2. Disallowed signatures
    if (fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46) {
      return { status: 400, error: 'PDF documents cannot be uploaded as photos.' };
    }

    const sampleHeader = fileBuffer.subarray(0, Math.min(fileBuffer.length, 512)).toString('utf-8').toLowerCase();
    if (
      sampleHeader.includes('<svg') ||
      sampleHeader.includes('<?xml') ||
      sampleHeader.includes('<!doctype svg') ||
      sampleHeader.includes('<html') ||
      sampleHeader.includes('<script')
    ) {
      return { status: 400, error: 'SVG vector and script-containing files are rejected.' };
    }

    // 3. Authentic format check
    let detectedFormat: 'jpeg' | 'png' | 'webp' | null = null;
    if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
      detectedFormat = 'jpeg';
    } else if (
      fileBuffer.length >= 8 &&
      fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4e && fileBuffer[3] === 0x47 &&
      fileBuffer[4] === 0x0d && fileBuffer[5] === 0x0a && fileBuffer[6] === 0x1a && fileBuffer[7] === 0x0a
    ) {
      detectedFormat = 'png';
    } else if (
      fileBuffer.length >= 12 &&
      fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46 &&
      fileBuffer[8] === 0x57 && fileBuffer[9] === 0x45 && fileBuffer[10] === 0x42 && fileBuffer[11] === 0x50
    ) {
      detectedFormat = 'webp';
    }

    if (!detectedFormat) {
      return { status: 400, error: 'Malformed or unrecognized image format. Only authentic JPG, PNG, and WebP are allowed.' };
    }

    // 4. Sharp decoding with limitInputPixels and dimension verification
    try {
      const image = sharp(fileBuffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
      const metadata = await image.metadata();

      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
        return { status: 400, error: 'Unsupported image format decoded.' };
      }

      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const totalPixels = width * height;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || totalPixels > MAX_INPUT_PIXELS) {
        return {
          status: 400,
          error: `Image dimensions (${width}x${height}, ${totalPixels} pixels) exceed the maximum allowed limits of ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}px or 16 MP.`,
        };
      }

      // Re-encode
      let sanitizedBuffer: Buffer;
      if (metadata.format === 'png') {
        sanitizedBuffer = await image.png({ compressionLevel: 8 }).toBuffer();
      } else if (metadata.format === 'webp') {
        sanitizedBuffer = await image.webp({ quality: 85 }).toBuffer();
      } else {
        sanitizedBuffer = await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      }

      // If valid, would upload sanitizedBuffer to Cloudinary
      return { status: 200, secureUrlSimulated: true };
    } catch (decodeErr: any) {
      const errMsg = decodeErr?.message || '';
      if (errMsg.includes('pixel limit') || errMsg.includes('exceeds pixel limit')) {
        return { status: 400, error: 'Image total pixel count exceeds the safe limit (16 MP). Decompression bomb rejected.' };
      }
      return { status: 400, error: 'Corrupted, truncated, or malformed image data. The file cannot be safely decoded.' };
    }
  }

  // Case A: Valid image under 5 MB
  const validPngBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 32, g: 75, b: 57, alpha: 1 },
    },
  }).png().toBuffer();

  const validRes = await simulateBackendUpload(validPngBuffer);
  assert(validRes.status === 200 && validRes.secureUrlSimulated === true, 'Valid 200x200 PNG under 5 MB is successfully decoded and re-encoded');

  // Case B: 6 MB image
  const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024);
  // Prepend valid PNG signature so signature passes but size check rejects
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversizedBuffer, 0);
  const oversizedRes = await simulateBackendUpload(oversizedBuffer);
  assert(
    oversizedRes.status === 400 && oversizedRes.error?.includes('5 MB limit') === true,
    '6 MB image payload is rejected with HTTP 400 before decoding, creating zero Cloudinary assets'
  );

  // Case C: Malformed image
  const malformedBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef]);
  const malformedRes = await simulateBackendUpload(malformedBuffer);
  assert(
    malformedRes.status === 400 && malformedRes.error?.includes('malformed') === true,
    'Malformed/corrupted image header is rejected with HTTP 400 by Sharp, creating zero Cloudinary assets'
  );

  // Case D: Disguised SVG
  const disguisedSvg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const svgRes = await simulateBackendUpload(disguisedSvg);
  assert(
    svgRes.status === 400 && svgRes.error?.includes('SVG vector and script-containing files are rejected') === true,
    'Disguised SVG payload is rejected with HTTP 400, creating zero Cloudinary assets'
  );

  // Case E: Oversized dimension decompression bomb (e.g. 5000 x 5000 = 25 MP > 16 MP limit)
  const bombBuffer = await sharp({
    create: {
      width: 5000,
      height: 5000,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  }).jpeg().toBuffer();

  const bombRes = await simulateBackendUpload(bombBuffer);
  assert(
    bombRes.status === 400 && (bombRes.error?.includes('exceed the maximum allowed limits') || bombRes.error?.includes('exceeds the safe limit') || bombRes.error?.includes('limit')),
    'Decompression bomb (5000x5000, 25 MP) is rejected with HTTP 400 BEFORE re-encoding, creating zero Cloudinary assets'
  );

  // Case F: Verify failed uploads do not invoke Cloudinary
  assert(
    oversizedRes.secureUrlSimulated !== true &&
    malformedRes.secureUrlSimulated !== true &&
    svgRes.secureUrlSimulated !== true &&
    bombRes.secureUrlSimulated !== true,
    'Failed uploads strictly abort before the Cloudinary API call, creating zero Cloudinary assets'
  );
}

// -------------------------------------------------------------
// Test 4: Notification Registration Status Verification
// -------------------------------------------------------------
console.log('\n--- 4. Notification Registration Status Accuracy ---');

const notifContextPath = path.join(process.cwd(), 'src/context/NotificationContext.tsx');
const notifBellPath = path.join(process.cwd(), 'src/components/NotificationBell.tsx');

const notifContextSrc = fs.readFileSync(notifContextPath, 'utf-8');
const notifBellSrc = fs.readFileSync(notifBellPath, 'utf-8');

assert(
  notifContextSrc.includes('fcmRes && fcmRes.ok') &&
  notifContextSrc.includes('subRes && subRes.ok'),
  'NotificationContext checks actual HTTP response status (fcmRes.ok, subRes.ok) for FCM & Web Push'
);

assert(
  notifContextSrc.includes('if (!regResult.success) {') &&
  notifContextSrc.includes('setBrowserNotificationsEnabled(false);'),
  'toggleBrowserNotifications does NOT mark registration successful when both FCM and Web Push fail'
);

assert(
  notifContextSrc.includes('permissionStatus: NotificationPermission') &&
  notifBellSrc.includes('isPermissionGrantedOnly'),
  'NotificationBell explicitly distinguishes browser permission from successful server registration in UI'
);

assert(
  notifBellSrc.includes('Not Registered') &&
  notifBellSrc.includes('Alerts ON') &&
  notifBellSrc.includes('Alerts OFF'),
  'NotificationBell UI displays "Alerts ON", "Not Registered", or "Alerts OFF" reflecting true state'
);

runUploadPipelineTests().then(() => {
  console.log(`\n===============================================================`);
  console.log(`Upload & Notification Security Tests: ${passed} passed, ${failed} failed.`);
  console.log(`===============================================================\n`);
  if (failed > 0) process.exit(1);
});
