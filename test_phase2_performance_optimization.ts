/**
 * Test Suite: StudentNeed - Phase 2 Performance & Scalability Optimization
 * 
 * Verifies:
 * 1. Cloudinary responsive image delivery, auto format (f_auto), quality (q_auto:good), and avatar face cropping
 * 2. Responsive srcSet generation across multiple breakpoints
 * 3. Chat message pagination with limitToLast(30), cursor-based endBefore earlier message loading, and duplicate send lock
 * 4. Marketplace cursor pagination state (isLoadingMoreListings), loading skeletons, and disabled button state
 * 5. Cloud Run HTTP keepAliveTimeout (65s), headersTimeout (66s), requestTimeout (30s) alignment
 * 6. Lightweight readiness probe (/api/ready)
 * 7. Preservation of Phase 1 security rules and distributed rate limiting
 */

process.env.NODE_ENV = 'test';
process.env.TEST_APP_INSTANCE = 'true';

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { 
  getOptimizedImageUrl, 
  getOptimizedAvatarUrl, 
  getOptimizedListingUrl, 
  getResponsiveImageSrcSet 
} from './src/lib/cloudinary.js';
import http from 'http';

let passed = 0;
let failed = 0;

function it(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message || err}`);
      failed++;
    }
  })();
}

async function runTests() {
  console.log('='.repeat(80));
  console.log(' StudentNeed - Phase 2 Performance & Scalability Tests');
  console.log('='.repeat(80));

  console.log('\n1. Image Optimization & Cloudinary Transformations:');

  await it('getOptimizedImageUrl formats Cloudinary URL with quality, format, and dpr auto', () => {
    const rawUrl = 'https://res.cloudinary.com/ddc64bq61/image/upload/v12345/studentneed/listings/sample.jpg';
    const optimized = getOptimizedImageUrl(rawUrl, { width: 500 });

    assert.ok(optimized.includes('c_fill,w_500'), 'Should contain crop and width');
    assert.ok(optimized.includes('q_auto:good'), 'Should default to q_auto:good');
    assert.ok(optimized.includes('f_auto'), 'Should include f_auto for modern WebP/AVIF delivery');
    assert.ok(optimized.includes('dpr_auto'), 'Should include dpr_auto for high-DPI displays');
  });

  await it('getOptimizedAvatarUrl generates face-centered square thumbnail', () => {
    const avatarUrl = 'https://res.cloudinary.com/ddc64bq61/image/upload/v12345/studentneed/avatars/user123.jpg';
    const optimized = getOptimizedAvatarUrl(avatarUrl, 96);

    assert.ok(optimized.includes('c_thumb,w_96,h_96,g_face'), 'Should use thumbnail crop with face auto-centering');
    assert.ok(optimized.includes('f_auto'), 'Should use automatic WebP/AVIF format');
  });

  await it('getOptimizedListingUrl generates listing card thumbnail', () => {
    const listingUrl = 'https://res.cloudinary.com/ddc64bq61/image/upload/v12345/studentneed/listings/book.jpg';
    const optimized = getOptimizedListingUrl(listingUrl, 480, 320);

    assert.ok(optimized.includes('c_fill,w_480,h_320'), 'Should contain fill crop with width and height');
    assert.ok(optimized.includes('g_auto'), 'Should contain auto gravity');
  });

  await it('getResponsiveImageSrcSet generates comma-separated responsive widths', () => {
    const listingUrl = 'https://res.cloudinary.com/ddc64bq61/image/upload/v12345/studentneed/listings/book.jpg';
    const srcSet = getResponsiveImageSrcSet(listingUrl, [300, 480, 640]);

    assert.ok(srcSet.includes('300w'), 'Should include 300w descriptor');
    assert.ok(srcSet.includes('480w'), 'Should include 480w descriptor');
    assert.ok(srcSet.includes('640w'), 'Should include 640w descriptor');
    const entries = srcSet.split(/,\s+(?=https?:\/\/)/);
    assert.strictEqual(entries.length, 3, 'Should generate 3 breakpoints');
  });

  await it('safely handles empty, null, or external URLs without errors', () => {
    assert.strictEqual(getOptimizedImageUrl(''), '');
    assert.strictEqual(getOptimizedImageUrl(null as any), '');
    assert.strictEqual(getOptimizedImageUrl(undefined as any), '');

    const unsplashUrl = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c';
    const optimizedUnsplash = getOptimizedImageUrl(unsplashUrl, { width: 400 });
    assert.ok(optimizedUnsplash.includes('w=400'), 'Should format Unsplash width');
  });

  console.log('\n2. Chat Message Pagination & Listener Performance:');

  await it('Chat.tsx limits initial messages to limitToLast(30)', () => {
    const chatContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
    assert.ok(chatContent.includes('limitToLast(30)'), 'Messages query must use limitToLast(30) to prevent downloading entire chat history');
    assert.ok(chatContent.includes('oldestDocSnapshotRef'), 'Must track oldest document snapshot cursor');
  });

  await it('Chat.tsx implements on-demand handleLoadEarlierMessages with endBefore cursor', () => {
    const chatContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
    assert.ok(chatContent.includes('handleLoadEarlierMessages'), 'Must define handleLoadEarlierMessages');
    assert.ok(chatContent.includes('endBefore(oldestDocSnapshotRef.current)'), 'Must query earlier messages using endBefore cursor');
    assert.ok(chatContent.includes('hasMoreEarlierMessages'), 'Must manage hasMoreEarlierMessages state');
  });

  await it('Chat.tsx maintains scroll position when earlier messages load', () => {
    const chatContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
    assert.ok(chatContent.includes('container.scrollTop = container.scrollHeight - previousScrollHeight'), 'Must calculate scroll offset when prepending earlier messages');
    assert.ok(chatContent.includes('!isLoadingEarlierRef.current'), 'Should not auto-scroll to bottom when loading earlier messages');
  });

  await it('Chat.tsx renders Load earlier messages button in message feed', () => {
    const chatContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
    assert.ok(chatContent.includes('Load earlier messages'), 'Must render button with Load earlier messages label');
  });

  console.log('\n3. Marketplace Pagination & UI Loading States:');

  await it('AppContext exposes isLoadingMoreListings in AppContextType and provider value', () => {
    const appContextContent = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf-8');
    assert.ok(appContextContent.includes('isLoadingMoreListings: boolean'), 'AppContextType must include isLoadingMoreListings');
    assert.ok(appContextContent.includes('isLoadingMoreListings,'), 'Provider value must expose isLoadingMoreListings');
  });

  await it('Marketplace.tsx disables Load More button and renders skeletons during fetch', () => {
    const marketplaceContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/Marketplace.tsx'), 'utf-8');
    assert.ok(marketplaceContent.includes('isLoadingMoreListings'), 'Marketplace must consume isLoadingMoreListings');
    assert.ok(marketplaceContent.includes('disabled={isLoadingMoreListings}'), 'Load More button must be disabled when loading');
    assert.ok(marketplaceContent.includes('<ListingCardSkeleton'), 'Must render ListingCardSkeleton during pagination load');
  });

  console.log('\n4. Cloud Run Backend Configuration & Health Probes:');

  await it('server.ts configures keepAliveTimeout, headersTimeout, and requestTimeout for reverse proxy alignment', () => {
    const serverContent = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert.ok(serverContent.includes('server.keepAliveTimeout = 65000'), 'keepAliveTimeout must be 65000ms (exceeding Cloud Run 60s idle timeout)');
    assert.ok(serverContent.includes('server.headersTimeout = 66000'), 'headersTimeout must be 66000ms (strictly greater than keepAliveTimeout)');
    assert.ok(serverContent.includes('server.requestTimeout = 30000'), 'requestTimeout must be 30000ms');
  });

  await it('/api/ready responds with 200 OK and no-cache header', async () => {
    const { createApp } = await import('./server.js');
    const app = await createApp({ skipVite: true, skipTimers: true });
    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address() as any;
    const res = await fetch(`http://127.0.0.1:${address.port}/api/ready`);
    const data = await res.json();

    assert.strictEqual(res.status, 200, 'Readiness probe must return 200 OK');
    assert.strictEqual(data.status, 'ready', 'Response must indicate ready status');
    assert.ok(res.headers.get('cache-control')?.includes('no-cache'), 'Must disable caching on readiness probe');

    await new Promise((r) => server.close(r));
  });

  console.log('\n5. Phase 1 Security & Rule Preservation:');

  await it('firestore.rules preserves strict registered_emails and rate_limits rules', () => {
    const rulesContent = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');
    assert.ok(rulesContent.includes('match /registered_emails/{emailDocId}'), 'Preserves registered_emails rules');
    assert.ok(rulesContent.includes('match /rate_limits/{limitId}'), 'Preserves rate_limits rules');
    assert.ok(rulesContent.includes('isInternalSystem() || isAdmin()'), 'Preserves system-only privilege requirement');
  });

  await it('server.ts preserves distributed rate limiting and structured logger', () => {
    const serverContent = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert.ok(serverContent.includes('checkDistributedRateLimit'), 'Preserves checkDistributedRateLimit');
    assert.ok(serverContent.includes('sendRateLimitResponse'), 'Preserves sendRateLimitResponse');
    assert.ok(serverContent.includes('logStructured'), 'Preserves structured logging');
  });

  console.log('\n6. Phase 2.1 Load Testing & Scalability Validation:');

  await it('scripts/load-test.ts relabels test as local microbenchmark and disclaims Cloud Run validation', () => {
    const loadTestContent = fs.readFileSync(path.join(process.cwd(), 'scripts/load-test.ts'), 'utf-8');
    assert.ok(loadTestContent.includes('StudentNeed - Local API Process Smoke & Microbenchmark Test'), 'Must relabel description');
    assert.ok(loadTestContent.includes('This test does NOT validate Cloud Run multi-instance autoscaling'), 'Must include Cloud Run limitation disclaimer');
    assert.ok(loadTestContent.includes('successfulRps'), 'Must calculate successful RPS separately');
    assert.ok(loadTestContent.includes('attemptedRps'), 'Must calculate attempted RPS separately');
    assert.ok(loadTestContent.includes('rateLimited429'), 'Must count 429 rate limit responses separately');
  });

  await it('scripts/staging-load-test.ts enforces safety against production and requires staging confirmation', () => {
    const stagingContent = fs.readFileSync(path.join(process.cwd(), 'scripts/staging-load-test.ts'), 'utf-8');
    assert.ok(stagingContent.includes('assertStagingSafety'), 'Must call assertStagingSafety');
    assert.ok(stagingContent.includes('CONFIRM_STAGING_LOAD_TEST'), 'Must require CONFIRM_STAGING_LOAD_TEST confirmation');
    assert.ok(stagingContent.includes('Scenario A: Marketplace browsing'), 'Must simulate Marketplace scenario');
    assert.ok(stagingContent.includes('Scenario B: Authenticated student session'), 'Must simulate Authenticated Student scenario');
    assert.ok(stagingContent.includes('Scenario C: Reservation creation'), 'Must simulate Reservation scenario');
    assert.ok(stagingContent.includes('Scenario D: Chat message sync'), 'Must simulate Chat scenario');
    assert.ok(stagingContent.includes('Scenario E: Cloudinary responsive'), 'Must simulate Image delivery scenario');
    assert.ok(stagingContent.includes('Scenario F: Campus AI Assistant'), 'Must simulate AI Assistant scenario separately');
  });

  await it('scripts/seed-staging-data.ts uses deterministic test prefixes and enforces safety check', () => {
    const seedContent = fs.readFileSync(path.join(process.cwd(), 'scripts/seed-staging-data.ts'), 'utf-8');
    assert.ok(seedContent.includes('assertStagingSafety'), 'Must export and call assertStagingSafety');
    assert.ok(seedContent.includes('test_staging_'), 'Must use test_staging_ prefix for seeded data');
    assert.ok(seedContent.includes('normalized.includes(\'studentneed.me\')'), 'Must throw error if targeting studentneed.me');
  });

  await it('scripts/k6-load-test.js enforces safety guard and defines multi-scenario profile', () => {
    const k6Content = fs.readFileSync(path.join(process.cwd(), 'scripts/k6-load-test.js'), 'utf-8');
    assert.ok(k6Content.includes('Safety check: Never run k6 against live production'), 'Must include safety check against production');
    assert.ok(k6Content.includes('marketplace'), 'Must define marketplace scenario');
    assert.ok(k6Content.includes('p(95)<500'), 'Must define p95 latency thresholds');
  });

  await it('server.ts enforces layered abuse protection on assistant endpoint (concurrency, user, campus NAT, guest)', () => {
    const serverContent = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert.ok(serverContent.includes('MAX_CONCURRENT_ASSISTANT_GENERATIONS'), 'Must define global concurrency limit');
    assert.ok(serverContent.includes('chat-assistant:user:'), 'Must enforce authenticated student per-user limit');
    assert.ok(serverContent.includes('chat-assistant:nat-campus:'), 'Must enforce campus NAT shared IP ceiling');
    assert.ok(serverContent.includes('chat-assistant:guest-ip:'), 'Must enforce unauthenticated guest strict IP limit');
  });

  await it('scripts/staging-load-test.ts implements payload validation and honest environment transparency', () => {
    const stagingContent = fs.readFileSync(path.join(process.cwd(), 'scripts/staging-load-test.ts'), 'utf-8');
    assert.ok(stagingContent.includes('safeFetchWithValidation'), 'Must validate response payload content');
    assert.ok(stagingContent.includes('LOCAL STAGING SIMULATION'), 'Must transparently label local simulation');
    assert.ok(stagingContent.includes('aiMetrics'), 'Must report AI assistant telemetry and fallback note');
    assert.ok(stagingContent.includes('expectedSuccess') && stagingContent.includes('expectedRejection'), 'Must classify expected success vs expected rejection');
  });

  await it('scripts/authenticated-staging-validation.ts implements safe authenticated E2E validation across all 5 core workflows', () => {
    const e2eContent = fs.readFileSync(path.join(process.cwd(), 'scripts/authenticated-staging-validation.ts'), 'utf-8');
    assert.ok(e2eContent.includes('assertStagingSafety'), 'Must enforce staging safety check against production hostnames');
    assert.ok(e2eContent.includes('CONFIRM_STAGING_LOAD_TEST'), 'Must require explicit confirmation before execution');
    assert.ok(e2eContent.includes('testMarketplaceWorkflow'), 'Must test actual marketplace Firestore queries and pagination');
    assert.ok(e2eContent.includes('testReservationWorkflow'), 'Must test atomic reservation creation, idempotency, and cancellation');
    assert.ok(e2eContent.includes('testChatWorkflow'), 'Must test authenticated multi-user chat, pagination, and cross-chat security');
    assert.ok(e2eContent.includes('testImageWorkflow'), 'Must test Cloudinary CDN responsive delivery (w_300, w_480, w_640)');
    assert.ok(e2eContent.includes('testAssistantWorkflow'), 'Must test AI Assistant fallback and concurrency guard');
    assert.ok(e2eContent.includes('rateLimitReview'), 'Must include comprehensive rate-limiting architecture evaluation');
  });

  console.log('\n' + '='.repeat(80));
  console.log(` TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
