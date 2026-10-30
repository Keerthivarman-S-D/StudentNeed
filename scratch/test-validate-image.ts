import { validateImageFile } from '../src/lib/cloudinary';

async function runTests() {
  console.log('--- 5. Results of all validateImageFile tests ---');

  // Test 1: Genuine Valid JPG (magic bytes FF D8 FF, image/jpeg, under 5MB)
  const jpgBytes = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48
  ]);
  const validJpg = new File([jpgBytes], 'camera.jpg', { type: 'image/jpeg' });
  const res1 = await validateImageFile(validJpg);
  console.log('Test 1 (Valid JPG):', JSON.stringify(res1));

  // Test 2: Genuine Valid PNG (magic bytes 89 50 4E 47..., image/png, under 5MB)
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
  ]);
  const validPng = new File([pngBytes], 'screenshot.png', { type: 'image/png' });
  const res2 = await validateImageFile(validPng);
  console.log('Test 2 (Valid PNG):', JSON.stringify(res2));

  // Test 3: Genuine Valid WebP (magic bytes RIFF...WEBP, image/webp, under 5MB)
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
  ]);
  const validWebp = new File([webpBytes], 'photo.webp', { type: 'image/webp' });
  const res3 = await validateImageFile(validWebp);
  console.log('Test 3 (Valid WebP):', JSON.stringify(res3));

  // Test 4: Disallowed SVG (image/svg+xml and <svg> content)
  const svg = new File(['<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>'], 'vector.svg', { type: 'image/svg+xml' });
  const res4 = await validateImageFile(svg);
  console.log('Test 4 (Disallowed SVG):', JSON.stringify(res4));

  // Test 5: Disallowed PDF (application/pdf and %PDF signature)
  const pdf = new File(['%PDF-1.4\n1 0 obj\n<<>>\nendobj'], 'document.pdf', { type: 'application/pdf' });
  const res5 = await validateImageFile(pdf);
  console.log('Test 5 (Disallowed PDF):', JSON.stringify(res5));

  // Test 6: Disallowed Oversized (> 5MB)
  const hugeBuffer = new Uint8Array(6 * 1024 * 1024);
  hugeBuffer[0] = 0xFF; hugeBuffer[1] = 0xD8; hugeBuffer[2] = 0xFF; hugeBuffer[3] = 0xE0;
  const huge = new File([hugeBuffer], 'large_photo.jpg', { type: 'image/jpeg' });
  const res6 = await validateImageFile(huge);
  console.log('Test 6 (Oversized 6MB):', JSON.stringify(res6));

  // Additional Test 7: Renamed SVG file (.svg renamed to .jpg)
  const disguisedSvg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'fake_avatar.jpg', { type: 'image/jpeg' });
  const res7 = await validateImageFile(disguisedSvg);
  console.log('Test 7 (Disguised SVG renamed to .jpg):', JSON.stringify(res7));

  // Additional Test 8: Renamed PDF file (.pdf renamed to .png)
  const disguisedPdf = new File(['%PDF-1.7 confidential document'], 'receipt.png', { type: 'image/png' });
  const res8 = await validateImageFile(disguisedPdf);
  console.log('Test 8 (Disguised PDF renamed to .png):', JSON.stringify(res8));

  // Additional Test 9: Malformed image file (random junk bytes)
  const junkBytes = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45, 0x67]);
  const malformed = new File([junkBytes], 'corrupt.jpg', { type: 'image/jpeg' });
  const res9 = await validateImageFile(malformed);
  console.log('Test 9 (Malformed image file):', JSON.stringify(res9));

  // Additional Test 10: Extension mismatch (PNG content disguised as .jpg)
  const renamedPng = new File([pngBytes], 'disguised.jpg', { type: 'image/jpeg' });
  const res10 = await validateImageFile(renamedPng);
  console.log('Test 10 (PNG renamed to .jpg):', JSON.stringify(res10));
}

runTests().catch(console.error);
