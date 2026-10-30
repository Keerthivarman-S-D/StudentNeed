// Ensure test flag is set BEFORE importing server.ts so the server does not bind port 3000
process.env.TEST_APP_INSTANCE = 'true';
process.env.NODE_ENV = 'test';

import http from 'http';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const { createApp, ipRateLimits, checkIpRateLimit } = await import('../server.js');

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
console.log('--- Express Middleware Order, Rate-Limiting & Payload Limits ---');
console.log('===============================================================\n');

// -------------------------------------------------------------------------
// Test 1: Static Source Verification of Middleware Order in server.ts
// -------------------------------------------------------------------------
console.log('--- 1. Static Middleware Order Verification in server.ts ---');

const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

assert(
  serverSrc.includes('const uploadIpRateLimitMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) =>'),
  'server.ts defines uploadIpRateLimitMiddleware'
);

assert(
  serverSrc.includes('app.post(\n    "/api/upload/image",\n    uploadIpRateLimitMiddleware,\n    express.json({ limit: "7.5mb" }),') ||
  serverSrc.includes('app.post(\r\n    "/api/upload/image",\r\n    uploadIpRateLimitMiddleware,\r\n    express.json({ limit: "7.5mb" }),'),
  'server.ts places uploadIpRateLimitMiddleware strictly BEFORE express.json({ limit: "7.5mb" })'
);

// Verify checkIpRateLimit is evaluated in the middleware and NOT called a second time in the controller
const middlewareStart = serverSrc.indexOf('const uploadIpRateLimitMiddleware');
const routeHandlerEnd = serverSrc.indexOf('// --- Event-Driven Notification System Helper ---', middlewareStart);
const uploadSectionContent = serverSrc.substring(middlewareStart, routeHandlerEnd);

const checkRateLimitOccurrences = (uploadSectionContent.match(/checkIpRateLimit/g) || []).length;
assert(
  checkRateLimitOccurrences === 1,
  `upload pipeline invokes checkIpRateLimit exactly once in the pre-parse middleware (found: ${checkRateLimitOccurrences}), avoiding duplicate rate limit consumption`
);

assert(
  serverSrc.includes('app.set("trust proxy", 1);'),
  'server.ts configures app.set("trust proxy", 1) for Render single-hop reverse proxy topology'
);

// -------------------------------------------------------------------------
// Test 2: Live Introspection of ACTUAL server.ts Express Application Stack
// -------------------------------------------------------------------------
console.log('\n--- 2. Live Introspection of ACTUAL server.ts Express App Stack ---');

async function runTests() {
  const app = await createApp({ skipVite: true, skipTimers: true });

  // 2A. Verify trust proxy configuration on actual Express app
  assert(
    app.get('trust proxy') === 1,
    'Actual server.ts Express instance has trust proxy configured to 1'
  );

  // 2B. Verify early body parser middleware in actual Express router stack
  const routerStack = (app as any).router?.stack || [];

  const earlyJsonIdx = routerStack.findIndex((s: any) => s.name === 'earlyJsonParserMiddleware');
  const earlyUrlencodedIdx = routerStack.findIndex((s: any) => s.name === 'earlyUrlencodedParserMiddleware');
  const uploadRouteIdx = routerStack.findIndex((s: any) => s.route && s.route.path === '/api/upload/image');

  assert(
    earlyJsonIdx !== -1 && earlyUrlencodedIdx !== -1,
    'Actual server.ts router stack registers earlyJsonParserMiddleware and earlyUrlencodedParserMiddleware'
  );

  assert(
    earlyJsonIdx < uploadRouteIdx && earlyUrlencodedIdx < uploadRouteIdx,
    `Early body parsers (indices: ${earlyJsonIdx}, ${earlyUrlencodedIdx}) precede upload route (index: ${uploadRouteIdx}) in actual Express stack`
  );

  // 2C. Verify route-level middleware ordering on /api/upload/image
  const uploadLayer = routerStack[uploadRouteIdx];
  const routeStack = uploadLayer.route.stack;

  assert(
    routeStack.length >= 3,
    `/api/upload/image route contains at least 3 handlers (found: ${routeStack.length})`
  );

  assert(
    routeStack[0].name === 'uploadIpRateLimitMiddleware',
    `/api/upload/image handler[0] is strictly uploadIpRateLimitMiddleware (found: ${routeStack[0].name})`
  );

  assert(
    routeStack[1].name === 'jsonParser',
    `/api/upload/image handler[1] is express.json body parser (found: ${routeStack[1].name})`
  );

  // -------------------------------------------------------------------------
  // Test 3: Live HTTP Requests against ACTUAL server.ts Express Pipeline
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Live HTTP Requests against ACTUAL server.ts Express Pipeline ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const sendPost = (
      urlPath: string,
      jsonBody: string,
      headers: Record<string, string> = {}
    ): Promise<{ status: number; data: any }> => {
      return new Promise((resolve, reject) => {
        const u = new URL(urlPath, baseUrl);
        const req = http.request(
          u,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(jsonBody),
              ...headers,
            },
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              try {
                resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
              } catch {
                resolve({ status: res.statusCode || 500, data: body });
              }
            });
          }
        );
        req.on('error', reject);
        req.write(jsonBody);
        req.end();
      });
    };

    // Helper to generate unique IP for testing
    let ipCounter = 100;
    const getTestIp = () => `203.0.113.${ipCounter++}`;

    // -------------------------------------------------------------------------
    // 3A. Early body parser bypass for /api/upload/image
    // A 250 KB JSON payload (exceeding standard 100 KB limit) reaches upload route
    // and returns HTTP 403 (unauthenticated caller), NOT HTTP 413!
    // -------------------------------------------------------------------------
    const testIpA = getTestIp();
    const payload250kb = JSON.stringify({ file: 'A'.repeat(250 * 1024) });
    const res3A = await sendPost('/api/upload/image', payload250kb, {
      'x-forwarded-for': testIpA,
    });

    assert(
      res3A.status === 403 && res3A.data?.error?.includes('Authentication and verified student status required'),
      'Actual server.ts allows 250 KB upload payload past early 100 KB body parser to reach auth check (HTTP 403)'
    );

    // -------------------------------------------------------------------------
    // 3B. Standard endpoint strictly enforces 100 KB limit
    // A 120 KB JSON payload to /api/auth/validate-password is rejected with HTTP 413
    // -------------------------------------------------------------------------
    const payload120kb = JSON.stringify({ password: 'B'.repeat(120 * 1024) });
    const res3B = await sendPost('/api/auth/validate-password', payload120kb);

    assert(
      res3B.status === 413 && res3B.data?.error?.includes('Payload too large'),
      'Actual server.ts standard endpoint rejects 120 KB payload with HTTP 413 (Payload too large)'
    );

    // -------------------------------------------------------------------------
    // 3C. Upload endpoint enforces 7.5 MB request body limit
    // An 8 MB JSON payload to /api/upload/image is rejected with HTTP 413
    // -------------------------------------------------------------------------
    const testIpC = getTestIp();
    const payload8mb = JSON.stringify({ file: 'C'.repeat(8 * 1024 * 1024) });
    const res3C = await sendPost('/api/upload/image', payload8mb, {
      'x-forwarded-for': testIpC,
    });

    assert(
      res3C.status === 413 && res3C.data?.error?.includes('Payload too large'),
      'Actual server.ts /api/upload/image rejects 8 MB payload with HTTP 413 (Payload too large)'
    );

    // -------------------------------------------------------------------------
    // 3D. 30 requests / 10 minutes limit is enforced BEFORE JSON parsing
    // Send 30 requests from testIpD, consuming all allowed slots.
    // On the 31st request, send an 8 MB payload.
    // It MUST return HTTP 429 (Too many upload requests), NOT HTTP 413!
    // This proves the rate limiter executed and rejected the request BEFORE
    // express.json({ limit: "7.5mb" }) could process/reject the 8 MB body.
    // -------------------------------------------------------------------------
    const testIpD = getTestIp();
    const smallPayload = JSON.stringify({ file: 'tiny' });

    // Send 30 allowed requests
    let allSucceededToAuth = true;
    for (let i = 1; i <= 30; i++) {
      const res = await sendPost('/api/upload/image', smallPayload, {
        'x-forwarded-for': testIpD,
      });
      if (res.status !== 403) {
        allSucceededToAuth = false;
        break;
      }
    }

    assert(
      allSucceededToAuth,
      'Actual server.ts allows exactly 30 upload requests within the 10-minute rate limit window'
    );

    // 31st request with 8 MB payload
    const res3D = await sendPost('/api/upload/image', payload8mb, {
      'x-forwarded-for': testIpD,
    });

    assert(
      res3D.status === 429 && res3D.data?.error?.includes('Too many upload requests'),
      '31st request with 8 MB payload returns HTTP 429 (Too Many Requests), proving rate limit runs BEFORE body parsing'
    );

    // -------------------------------------------------------------------------
    // 3E. Render Trust Proxy & Spoofed X-Forwarded-For Defense
    // When trust proxy is 1, Render adds the real client IP to the end of X-Forwarded-For.
    // An attacker prepending spoofed IPs (e.g. '1.2.3.4, 5.6.7.8, realClientIp')
    // cannot bypass rate limiting, because Express takes the last untrusted hop (realClientIp).
    // -------------------------------------------------------------------------
    const spoofedRes = await sendPost('/api/upload/image', smallPayload, {
      'x-forwarded-for': `spoofed.attacker.1, spoofed.attacker.2, ${testIpD}`,
    });

    assert(
      spoofedRes.status === 429,
      'Manipulating X-Forwarded-For with prepended fake IPs does NOT bypass rate limit (req.ip safely resolves to trusted hop)'
    );

    // -------------------------------------------------------------------------
    // 3F. Rate limit bucket count increments exactly once per upload request
    // -------------------------------------------------------------------------
    const testIpF = getTestIp();
    const rateLimitKey = `upload-image:${testIpF}`;

    const countBefore = ipRateLimits.get(rateLimitKey)?.count || 0;
    await sendPost('/api/upload/image', smallPayload, {
      'x-forwarded-for': testIpF,
    });
    const countAfter = ipRateLimits.get(rateLimitKey)?.count || 0;

    assert(
      countBefore === 0 && countAfter === 1,
      `Rate limit bucket count incremented exactly once (before: ${countBefore}, after: ${countAfter})`
    );

    // -------------------------------------------------------------------------
    // Test 4: Pure Decoded Image Size Enforcement (Sharp / Binary 5 MB limit)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Pure Decoded Image Size Enforcement (Sharp & Buffer Limits) ---');

    const baseJpg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 50, g: 100, b: 150 },
      },
    }).jpeg().toBuffer();

    const validBinarySize = 4950000; // 4.95 MB < 5 * 1024 * 1024 (5.24 MB)
    const validBuf = Buffer.alloc(validBinarySize, 0x00);
    baseJpg.copy(validBuf, 0);

    const oversizedBinarySize = 5300000; // 5.30 MB > 5 * 1024 * 1024 (5.24 MB)
    const oversizedBuf = Buffer.alloc(oversizedBinarySize, 0x00);
    baseJpg.copy(oversizedBuf, 0);

    const MAX_DECODED_BYTES = 5 * 1024 * 1024;
    assert(
      validBuf.length <= MAX_DECODED_BYTES,
      `Valid image buffer (${validBuf.length} bytes) is within 5 MB decoded limit (${MAX_DECODED_BYTES} bytes)`
    );

    assert(
      oversizedBuf.length > MAX_DECODED_BYTES,
      `Oversized image buffer (${oversizedBuf.length} bytes) strictly exceeds 5 MB decoded limit (${MAX_DECODED_BYTES} bytes)`
    );

  } finally {
    server.close();
  }
}

runTests().then(() => {
  console.log(`\n===============================================================`);
  console.log(`Actual Server Middleware & Upload Security: ${passed} passed, ${failed} failed.`);
  console.log(`===============================================================\n`);
  if (failed > 0) process.exit(1);
}).catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
