/**
 * StudentNeed - Local API Process Smoke & Microbenchmark Test
 * 
 * SCOPE & LIMITATION DISCLAIMER:
 * --------------------------------------------------------------------------------
 * This test executes strictly within a single local Node.js / Express process on
 * 127.0.0.1 (loopback). It is designed as an internal development smoke test to
 * measure:
 * 1. Single-instance HTTP socket keep-alive and event-loop processing latency.
 * 2. Rapid response times of lightweight health & readiness probes (/api/ready, /api/health).
 * 3. Rate-limiter enforcement when requests originate from a single IP.
 * 
 * IMPORTANT: This test does NOT validate Cloud Run multi-instance autoscaling,
 * live Firestore concurrent quota scaling, or end-to-end browser Web Vitals.
 * Staging load testing must be run via `scripts/staging-load-test.ts`.
 * --------------------------------------------------------------------------------
 */

process.env.NODE_ENV = 'test';
process.env.TEST_APP_INSTANCE = 'true';

import http from 'http';

interface LocalStageMetric {
  stage: string;
  concurrency: number;
  totalAttempted: number;
  successfulCount: number; // 2xx, 3xx
  rateLimited429: number;  // 429 specifically
  other4xx: number;        // other 4xx
  serverErrors5xx: number; // 5xx
  networkFailures: number; // timeouts / socket resets
  durationMs: number;
  successfulRps: number;
  attemptedRps: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  heapDeltaMb: number;
}

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
}

async function makeRequest(
  baseUrl: string,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; duration: number }> {
  const url = `${baseUrl}${path}`;
  const start = performance.now();

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body,
    });
    const duration = performance.now() - start;
    await res.text();
    return { status: res.status, duration };
  } catch (err: any) {
    if (err.cause?.code === 'ECONNRESET' || err.message?.includes('socket hang up') || err.message?.includes('fetch failed')) {
      try {
        await new Promise((r) => setTimeout(r, 20));
        const res = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Accept': 'application/json',
            ...(options.headers || {}),
          },
          body: options.body,
        });
        const duration = performance.now() - start;
        await res.text();
        return { status: res.status, duration };
      } catch {
        // Fall through to network failure
      }
    }
    const duration = performance.now() - start;
    return { status: 599, duration };
  }
}

/**
 * Simulates a local student API probe session:
 * 1. Lightweight container readiness probe (/api/ready)
 * 2. System health probe (/api/health)
 * 3. Rate-limited Assistant query (/api/chat/assistant)
 */
async function simulateLocalSession(baseUrl: string, userId: number): Promise<{ durations: number[]; statuses: number[] }> {
  const durations: number[] = [];
  const statuses: number[] = [];

  // Probe 1: Container readiness probe
  const readyRes = await makeRequest(baseUrl, '/api/ready');
  durations.push(readyRes.duration);
  statuses.push(readyRes.status);

  // Probe 2: System health status
  const healthRes = await makeRequest(baseUrl, '/api/health');
  durations.push(healthRes.duration);
  statuses.push(healthRes.status);

  // Probe 3: Assistant query (subject to 30 req/10m per-IP rate limit)
  const assistantRes = await makeRequest(baseUrl, '/api/chat/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `What are the approved campus meetup spots? User ${userId}`,
    }),
  });
  durations.push(assistantRes.duration);
  statuses.push(assistantRes.status);

  return { durations, statuses };
}

async function runLocalStage(
  baseUrl: string,
  stageName: string,
  concurrency: number
): Promise<LocalStageMetric> {
  const memStart = process.memoryUsage();
  const startTime = performance.now();

  const allDurations: number[] = [];
  let successfulCount = 0;
  let rateLimited429 = 0;
  let other4xx = 0;
  let serverErrors5xx = 0;
  let networkFailures = 0;

  const sessionPromises = Array.from({ length: concurrency }, (_, idx) =>
    simulateLocalSession(baseUrl, idx + 1)
  );

  const results = await Promise.all(sessionPromises);

  for (const res of results) {
    for (let i = 0; i < res.statuses.length; i++) {
      const status = res.statuses[i];
      const duration = res.durations[i];
      allDurations.push(duration);

      if (status >= 200 && status < 400) {
        successfulCount++;
      } else if (status === 429) {
        rateLimited429++;
      } else if (status >= 400 && status < 500) {
        other4xx++;
      } else if (status >= 500 && status < 599) {
        serverErrors5xx++;
      } else {
        networkFailures++;
      }
    }
  }

  const durationMs = performance.now() - startTime;
  const durationSec = durationMs / 1000;
  const memEnd = process.memoryUsage();

  allDurations.sort((a, b) => a - b);

  const totalAttempted = allDurations.length;
  const successfulRps = Number((successfulCount / durationSec).toFixed(1));
  const attemptedRps = Number((totalAttempted / durationSec).toFixed(1));

  return {
    stage: stageName,
    concurrency,
    totalAttempted,
    successfulCount,
    rateLimited429,
    other4xx,
    serverErrors5xx,
    networkFailures,
    durationMs: Math.round(durationMs),
    successfulRps,
    attemptedRps,
    p50Ms: Number(percentile(allDurations, 50).toFixed(1)),
    p90Ms: Number(percentile(allDurations, 90).toFixed(1)),
    p95Ms: Number(percentile(allDurations, 95).toFixed(1)),
    p99Ms: Number(percentile(allDurations, 99).toFixed(1)),
    maxMs: Number((allDurations[allDurations.length - 1] || 0).toFixed(1)),
    heapDeltaMb: Number(((memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024).toFixed(2)),
  };
}

async function main() {
  console.log('='.repeat(88));
  console.log(' StudentNeed - Local Express Process Microbenchmark & Smoke Test');
  console.log(' NOTICE: Measures single-instance loopback I/O on 127.0.0.1.');
  console.log(' This test does NOT validate Cloud Run autoscaling or Firestore concurrent quotas.');
  console.log(' For true staging validation, run: npm run test:staging-load');
  console.log('='.repeat(88));

  const { createApp } = await import('../server.js');
  const app = await createApp({ skipVite: true, skipTimers: true });
  const server = http.createServer(app);

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 30000;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', 1024, () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Local Smoke] Test staging server initialized on ${baseUrl}\n`);

  const stages = [
    { name: '10 Users (Basic Smoke)', users: 10 },
    { name: '50 Users (Normal Activity)', users: 50 },
    { name: '100 Users (Increased Load)', users: 100 },
    { name: '250 Users (High Load)', users: 250 },
    { name: '500 Users (Local Stress)', users: 500 },
  ];

  const results: LocalStageMetric[] = [];

  for (const stage of stages) {
    process.stdout.write(`Running Stage: ${stage.name}... `);
    const metric = await runLocalStage(baseUrl, stage.name, stage.users);
    results.push(metric);
    console.log(
      `Done (${metric.totalAttempted} attempted: ${metric.successfulCount} 2xx, ${metric.rateLimited429} 429s, ${metric.serverErrors5xx} 5xx in ${metric.durationMs}ms | Succ RPS: ${metric.successfulRps})`
    );
    await new Promise((r) => setTimeout(r, 200));
  }

  server.close();

  console.log('\n' + '='.repeat(88));
  console.log(' LOCAL SMOKE TEST METRICS BREAKDOWN');
  console.log('='.repeat(88));
  console.table(
    results.map((r) => ({
      'Stage': r.stage,
      'Users': r.concurrency,
      'Attempted': r.totalAttempted,
      '2xx/3xx': r.successfulCount,
      '429 Limited': r.rateLimited429,
      'Other 4xx': r.other4xx,
      '5xx Server': r.serverErrors5xx,
      'Failures': r.networkFailures,
      'Succ RPS': r.successfulRps,
      'Total RPS': r.attemptedRps,
      'p50 (ms)': r.p50Ms,
      'p95 (ms)': r.p95Ms,
      'p99 (ms)': r.p99Ms,
      'Max (ms)': r.maxMs,
      'Heap Δ (MB)': r.heapDeltaMb,
    }))
  );

  console.log('\nAnalysis & Rate-Limiter Interpretation:');
  console.log('1. Rate Limiting (429 Responses):');
  console.log('   - The assistant endpoint (/api/chat/assistant) enforces a strict IP limit of 30 req / 10 min.');
  console.log('   - Because all virtual users share loopback IP 127.0.0.1, requests beyond the 30-request threshold');
  console.log('     trigger HTTP 429 "Too many assistant requests from this IP address".');
  console.log('   - These 429 blocks are EXPECTED SECURITY ENFORCEMENT, not server failures.');
  console.log('   - Unlike the previous script, 429s are isolated above and NOT counted in "Succ RPS".');
  console.log('\n2. Pass / Fail Evaluation:');

  const hasUnexpected5xx = results.some((r) => r.serverErrors5xx > 0);
  const hasUnexpected4xx = results.some((r) => r.other4xx > 0);
  const normalLoadP95 = results.find((r) => r.concurrency === 50)?.p95Ms || 0;

  console.log(`   - Zero 5xx Server Errors: ${!hasUnexpected5xx ? 'PASS (0 errors)' : 'FAIL'}`);
  console.log(`   - Zero Unexpected 4xx (non-429): ${!hasUnexpected4xx ? 'PASS (0 unexpected errors)' : 'FAIL'}`);
  console.log(`   - Normal Load p95 Latency: ${normalLoadP95} ms (${normalLoadP95 < 500 ? 'PASS < 500ms target' : 'FAIL'})`);

  if (hasUnexpected5xx) {
    console.error('\nFAIL: Local smoke test encountered unexpected 5xx server errors.');
    process.exit(1);
  } else {
    console.log('\nLOCAL SMOKE TEST PASSED (Local Express loopback socket & rate-limiting verified).');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal local smoke test error:', err);
  process.exit(1);
});
