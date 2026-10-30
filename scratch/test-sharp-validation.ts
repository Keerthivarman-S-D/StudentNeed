import sharp from 'sharp';

async function testSharp() {
  console.log('Testing Sharp image validation and re-encoding:');

  // 1. Valid PNG
  // 1x1 transparent PNG
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  try {
    const meta = await sharp(validPngBuffer).metadata();
    console.log('Valid PNG decoded successfully:', meta.format, `${meta.width}x${meta.height}`);
    const cleanBuffer = await sharp(validPngBuffer).png().toBuffer();
    console.log('Re-encoded PNG length:', cleanBuffer.length);
  } catch (err: any) {
    console.error('Valid PNG failed:', err.message);
  }

  // 2. Corrupted / truncated image (valid header followed by garbage)
  const corruptBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x99, 0x88, 0x77]);
  try {
    const meta = await sharp(corruptBuffer).metadata();
    // sharp might read header metadata, but toBuffer() forces actual decoding of image frames/pixels!
    await sharp(corruptBuffer).jpeg().toBuffer();
    console.error('Corrupt JPEG unexpectedly passed!');
  } catch (err: any) {
    console.log('Corrupted JPEG correctly rejected by Sharp decode:', err.message);
  }

  // 3. SVG buffer
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect/></svg>');
  try {
    const meta = await sharp(svgBuffer).metadata();
    console.log('SVG detected format:', meta.format);
  } catch (err: any) {
    console.log('SVG rejected:', err.message);
  }

  // 4. Random garbage text labeled as image
  const garbageBuffer = Buffer.from('This is completely not an image.');
  try {
    await sharp(garbageBuffer).metadata();
    console.error('Garbage text unexpectedly passed!');
  } catch (err: any) {
    console.log('Garbage text correctly rejected by Sharp:', err.message);
  }
}

testSharp().catch(console.error);
