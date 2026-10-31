/**
 * StudentNeed – Phase 2.1 Enterprise k6 Load Testing Script
 * 
 * Safety Rules:
 * - Refuses to execute against production (https://studentneed.me).
 * - Requires explicit BASE_URL targeting staging or local environments.
 * - Does not send OTP emails or alter real student accounts.
 * 
 * Usage:
 *   k6 run -e BASE_URL=https://staging.studentneed.me scripts/k6-load-test.js
 *   k6 run -e BASE_URL=http://127.0.0.1:3000 scripts/k6-load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

// Safety check: Never run k6 against live production
if (BASE_URL.includes('studentneed.me') && !BASE_URL.includes('staging')) {
  throw new Error(`CRITICAL: k6 load test refused against production "${BASE_URL}". Target staging only.`);
}

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 10 VUs: Smoke test
    { duration: '1m', target: 50 },    // 50 VUs: Normal campus activity
    { duration: '1m30s', target: 100 }, // 100 VUs: Increased peak activity
    { duration: '2m', target: 250 },   // 250 VUs: High activity
    { duration: '2m', target: 500 },   // 500 VUs: Stress & scalability assessment
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Under 1% failures
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    'http_req_duration{scenario:marketplace}': ['p(95)<300'],
    'http_req_duration{scenario:images}': ['p(95)<400'],
  },
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

export default function () {
  const userId = __VU;

  // 1. Marketplace Discovery & Probing
  group('Marketplace Browsing', function () {
    const readyRes = http.get(`${BASE_URL}/api/ready`, {
      tags: { scenario: 'marketplace', name: 'ReadyProbe' },
    });
    check(readyRes, {
      'ready returns 200': (r) => r.status === 200,
    });
    sleep(0.2);

    const healthRes = http.get(`${BASE_URL}/api/health`, {
      tags: { scenario: 'marketplace', name: 'HealthCheck' },
    });
    check(healthRes, {
      'health returns 200': (r) => r.status === 200,
    });
    sleep(0.3);

    const checkListing = http.post(
      `${BASE_URL}/api/moderation/check-listing`,
      JSON.stringify({
        title: `Semester 5 Course Notes - VU ${userId}`,
        description: 'Comprehensive study materials for Anna University engineering subjects.',
        category: 'Textbooks',
        type: 'Sale',
      }),
      {
        headers: JSON_HEADERS,
        tags: { scenario: 'marketplace', name: 'CheckListing' },
      }
    );
    check(checkListing, {
      'check-listing accepted': (r) => r.status === 200,
    });
    sleep(0.4);
  });

  // 2. Authentication Policy Validation (Without Email Dispatch)
  group('Authentication Validation', function () {
    const pwRes = http.post(
      `${BASE_URL}/api/auth/validate-password`,
      JSON.stringify({ password: 'AnnaUniv@Student2026!' }),
      {
        headers: JSON_HEADERS,
        tags: { scenario: 'auth', name: 'ValidatePassword' },
      }
    );
    check(pwRes, {
      'valid password accepted': (r) => r.status === 200,
    });
    sleep(0.2);
  });

  // 3. Cloudinary Responsive Image Delivery
  group('Image Delivery', function () {
    const imgUrl = 'https://res.cloudinary.com/ddc64bq61/image/upload/c_fill,w_300,q_auto:good,f_auto,dpr_auto/v1746200000/studentneed/listings/sample_book.jpg';
    const imgRes = http.get(imgUrl, {
      tags: { scenario: 'images', name: 'Thumbnail300w' },
    });
    check(imgRes, {
      'image returns 200 or 404 (non-server-error)': (r) => r.status < 500,
    });
    sleep(0.3);
  });

  // 4. Chat Cross-User Isolation Security Check
  group('Chat Security', function () {
    const unauthChat = http.post(
      `${BASE_URL}/api/push/notify-message`,
      JSON.stringify({
        chatId: 'test_chat_isolation',
        messageId: 'test_msg_1',
      }),
      {
        headers: {
          ...JSON_HEADERS,
          'Authorization': 'Bearer k6-invalid-token',
        },
        tags: { scenario: 'chat', name: 'UnauthCheck' },
      }
    );
    check(unauthChat, {
      'unauthorized chat access rejected with 401 or 403': (r) => r.status === 401 || r.status === 403,
    });
    sleep(0.3);
  });

  // 5. Campus AI Assistant (Rate-limited, sampled occasionally)
  if (__ITER % 5 === 0) {
    group('Assistant Query', function () {
      const assistantRes = http.post(
        `${BASE_URL}/api/chat/assistant`,
        JSON.stringify({
          message: 'How do campus item meetups work at MIT campus?',
        }),
        {
          headers: JSON_HEADERS,
          tags: { scenario: 'assistant', name: 'CampusAssistant' },
        }
      );
      check(assistantRes, {
        'assistant response valid (200 or 429 rate limit)': (r) => r.status === 200 || r.status === 429,
      });
      sleep(0.5);
    });
  }
}
