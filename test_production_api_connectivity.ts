import fs from 'fs';
import path from 'path';
import { getApiBaseUrl, API_BASE_URL, AUTH_ENDPOINTS, NOTIFICATION_ENDPOINTS, RESERVATION_ENDPOINTS, REQUEST_ENDPOINTS, UPLOAD_ENDPOINTS, ApiError, apiFetch } from './src/config/api';

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

console.log('\n--- Running StudentNeed Production Frontend-to-Backend Connectivity Tests ---\n');

// 1. Verify getApiBaseUrl logic & fallback
{
  const url = getApiBaseUrl();
  assert(
    url === '' || url === 'https://studentneed-backend.onrender.com',
    'getApiBaseUrl returns valid backend URL or dev origin'
  );

  // Check .env.production
  const envProdPath = path.join(process.cwd(), '.env.production');
  assert(fs.existsSync(envProdPath), '.env.production template exists for Vite builds');
  const envProdContent = fs.readFileSync(envProdPath, 'utf-8');
  assert(
    envProdContent.includes('VITE_API_URL=https://studentneed-backend.onrender.com'),
    '.env.production configures VITE_API_URL to production Render backend'
  );
}

// 2. Verify all endpoint mappings prepend valid base URL
{
  assert(AUTH_ENDPOINTS.sendOtp.includes('/api/auth/send-otp'), 'AUTH_ENDPOINTS.sendOtp mapped');
  assert(AUTH_ENDPOINTS.verifyOtp.includes('/api/auth/verify-otp'), 'AUTH_ENDPOINTS.verifyOtp mapped');
  assert(AUTH_ENDPOINTS.finalizeAccount.includes('/api/auth/finalize-account'), 'AUTH_ENDPOINTS.finalizeAccount mapped');
  assert(AUTH_ENDPOINTS.deleteAccount.includes('/api/account/delete'), 'AUTH_ENDPOINTS.deleteAccount mapped');
  assert(AUTH_ENDPOINTS.health.includes('/api/health'), 'AUTH_ENDPOINTS.health mapped');

  assert(NOTIFICATION_ENDPOINTS.registerFcm.includes('/api/push/fcm-token'), 'NOTIFICATION_ENDPOINTS.registerFcm mapped');
  assert(NOTIFICATION_ENDPOINTS.unregisterFcm.includes('/api/push/fcm-unsubscribe'), 'NOTIFICATION_ENDPOINTS.unregisterFcm mapped');
  assert(NOTIFICATION_ENDPOINTS.vapidPublicKey.includes('/api/push/vapid-public-key'), 'NOTIFICATION_ENDPOINTS.vapidPublicKey mapped');
  assert(NOTIFICATION_ENDPOINTS.notifyMessage.includes('/api/push/notify-message'), 'NOTIFICATION_ENDPOINTS.notifyMessage mapped');
  assert(NOTIFICATION_ENDPOINTS.markAllRead.includes('/api/notifications/mark-all-read'), 'NOTIFICATION_ENDPOINTS.markAllRead mapped');

  assert(RESERVATION_ENDPOINTS.accept.includes('/api/reservations/accept'), 'RESERVATION_ENDPOINTS.accept mapped');
  assert(RESERVATION_ENDPOINTS.decline.includes('/api/reservations/decline'), 'RESERVATION_ENDPOINTS.decline mapped');
  assert(RESERVATION_ENDPOINTS.complete.includes('/api/reservations/complete'), 'RESERVATION_ENDPOINTS.complete mapped');
  assert(RESERVATION_ENDPOINTS.cancel.includes('/api/reservations/cancel'), 'RESERVATION_ENDPOINTS.cancel mapped');

  assert(REQUEST_ENDPOINTS.renew.includes('/api/requests/renew'), 'REQUEST_ENDPOINTS.renew mapped');
  assert(UPLOAD_ENDPOINTS.signature.includes('/api/upload/signature'), 'UPLOAD_ENDPOINTS.signature mapped');
  assert(UPLOAD_ENDPOINTS.image.includes('/api/upload/image'), 'UPLOAD_ENDPOINTS.image mapped');
}

// 3. Verify zero hardcoded relative fetch('/api/...') calls in src/
{
  const scanDir = (dir: string, results: string[] = []) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, results);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Check for fetch('/api/ or fetch("/api/
        const match = content.match(/fetch\(\s*['"`]\/api\/[^'"`]+['"`]/g);
        if (match) {
          results.push(`${fullPath}: ${match.join(', ')}`);
        }
      }
    }
    return results;
  };

  const hardcodedCalls = scanDir(path.join(process.cwd(), 'src'));
  assert(
    hardcodedCalls.length === 0,
    'Zero hardcoded fetch("/api/...") calls exist in src/ directory',
    hardcodedCalls.join('\n')
  );
}

// 4. Verify CORS configuration in server.ts
{
  const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  assert(serverSrc.includes('https://studentneed.me'), 'server.ts CORS allows https://studentneed.me');
  assert(serverSrc.includes('https://www.studentneed.me'), 'server.ts CORS allows https://www.studentneed.me');
  assert(serverSrc.includes('https://kv-adk-26.web.app'), 'server.ts CORS allows https://kv-adk-26.web.app');
  assert(serverSrc.includes('https://kv-adk-26.firebaseapp.com'), 'server.ts CORS allows https://kv-adk-26.firebaseapp.com');
  assert(serverSrc.includes('process.env.ALLOWED_ORIGINS'), 'server.ts CORS dynamically loads ALLOWED_ORIGINS');
  assert(serverSrc.includes('process.env.FRONTEND_URL'), 'server.ts CORS checks FRONTEND_URL');
}

// 5. Verify ApiError class and non-JSON error handling contract
{
  const err = new ApiError('Test error', 404, { detail: 'not found' });
  assert(err.name === 'ApiError', 'ApiError name initialized');
  assert(err.status === 404, 'ApiError status code preserved');
  assert(err.message === 'Test error', 'ApiError message preserved');
}

console.log(`\nAPI Connectivity Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
