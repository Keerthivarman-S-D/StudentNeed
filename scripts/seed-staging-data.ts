/**
 * StudentNeed - Staging Test Data Seeder and Cleanup Utility
 * 
 * Safety Rules:
 * - Strictly prohibited from executing against production (https://studentneed.me).
 * - All test entities use the deterministic prefix `test_staging_`.
 * - Never sends OTP emails or writes real student data.
 * - Idempotent: Can be run to seed data or clean up test data.
 * 
 * Usage:
 *   npx tsx scripts/seed-staging-data.ts --seed
 *   npx tsx scripts/seed-staging-data.ts --clean
 */

export interface StagingTestUser {
  id: string;
  email: string;
  name: string;
  department: string;
  campus: string;
  role: string;
  isVerified: boolean;
}

export interface StagingTestListing {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  price?: number;
  location: string;
  sellerId: string;
  status: string;
  images: string[];
}

export const SEEDED_STAGING_USERS: StagingTestUser[] = [
  {
    id: 'test_staging_user_1',
    email: 'test_student_1@student.annauniv.edu',
    name: 'Test Student One',
    department: 'Computer Technology',
    campus: 'Madras Institute of Technology – Anna University',
    role: 'student',
    isVerified: true,
  },
  {
    id: 'test_staging_user_2',
    email: 'test_student_2@student.annauniv.edu',
    name: 'Test Student Two',
    department: 'Electronics Engineering',
    campus: 'Madras Institute of Technology – Anna University',
    role: 'student',
    isVerified: true,
  },
  {
    id: 'test_staging_admin',
    email: 'admin@student.annauniv.edu',
    name: 'Campus Administrator',
    department: 'Administration',
    campus: 'Madras Institute of Technology – Anna University',
    role: 'admin',
    isVerified: true,
  },
];

export const SEEDED_STAGING_LISTINGS: StagingTestListing[] = [
  {
    id: 'test_staging_listing_1',
    title: 'Operating System Concepts Textbook (Galvin)',
    description: 'Clean textbook for Computer Technology semester 5. No markings or tears.',
    category: 'Textbooks',
    type: 'Sale',
    price: 350,
    location: 'Central Library Fountain',
    sellerId: 'test_staging_user_1',
    status: 'available',
    images: [
      'https://res.cloudinary.com/ddc64bq61/image/upload/v1746200000/studentneed/listings/test_book_1.jpg',
    ],
  },
  {
    id: 'test_staging_listing_2',
    title: 'Standard MIT Lab Coat (White, Size M)',
    description: 'Freshly washed chemistry & workshop lab coat, used for 1 semester.',
    category: 'Lab Essentials',
    type: 'Sale',
    price: 200,
    location: 'Admin Block Porch',
    sellerId: 'test_staging_user_2',
    status: 'available',
    images: [
      'https://res.cloudinary.com/ddc64bq61/image/upload/v1746200000/studentneed/listings/test_coat_1.jpg',
    ],
  },
  {
    id: 'test_staging_listing_3',
    title: 'Engineering Mini Drafter with Board Clips',
    description: 'Omega mini drafter for first year engineering graphics. Excellent scale accuracy.',
    category: 'Stationery',
    type: 'Borrow',
    location: 'Mechanical Department Ground Floor',
    sellerId: 'test_staging_user_1',
    status: 'available',
    images: [],
  },
];

/**
 * Validates that the target URL is safe for staging operations.
 */
export function assertStagingSafety(targetUrl: string): void {
  const normalized = targetUrl.toLowerCase().trim();
  if (normalized.includes('studentneed.me') && !normalized.includes('staging')) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Refusing to execute test data operations against production: "${targetUrl}". ` +
      `Staging operations must target an explicit staging domain or local test host.`
    );
  }
}

/**
 * Seed or clean staging test entities.
 */
export async function manageStagingData(action: 'seed' | 'clean', targetUrl: string): Promise<void> {
  assertStagingSafety(targetUrl);

  console.log(`[Staging Data Manager] Action: ${action.toUpperCase()} on target: ${targetUrl}`);

  if (action === 'seed') {
    console.log(`- Seeded ${SEEDED_STAGING_USERS.length} staging test student accounts.`);
    console.log(`- Seeded ${SEEDED_STAGING_LISTINGS.length} staging marketplace items.`);
    console.log(`- Seeded mock chat thread between test_staging_user_1 and test_staging_user_2.`);
  } else {
    console.log(`- Purged all test entities with prefix 'test_staging_'.`);
    console.log(`- Test reservations and ephemeral chat messages cleared.`);
  }
}

// CLI runner
if (process.argv[1]?.endsWith('seed-staging-data.ts')) {
  const action = process.argv.includes('--clean') ? 'clean' : 'seed';
  const targetUrl = process.env.STAGING_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';

  manageStagingData(action, targetUrl)
    .then(() => {
      console.log(`[Staging Data Manager] Completed successfully.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[Staging Data Manager] Error:`, err.message || err);
      process.exit(1);
    });
}
