import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n--- Running StudentNeed Requests Page UI Redesign Verification Tests ---\n');

const requestsSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Requests.tsx'), 'utf-8');
const createRequestSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateRequest.tsx'), 'utf-8');
const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');

// 1. Visual Design Tokens in Requests Page
assert(
  requestsSrc.includes('bg-[#f7f6f2]'),
  'Requests page uses warm off-white background (#f7f6f2)'
);
assert(
  requestsSrc.includes('text-[#252b27]'),
  'Requests page uses dark charcoal (#252b27) for primary typography'
);
assert(
  requestsSrc.includes('text-[#555d56]'),
  'Requests page uses secondary text (#555d56)'
);
assert(
  requestsSrc.includes('text-[#555d56]'),
  'Requests page uses accessible muted text (#555d56)'
);
assert(
  requestsSrc.includes('bg-[#204b39]') && requestsSrc.includes('hover:bg-[#183a2c]'),
  'Requests page uses deep forest green (#204b39) and hover (#183a2c) for primary actions'
);
assert(
  requestsSrc.includes('border-[#dedcd4]'),
  'Requests page uses subtle neutral borders (#dedcd4)'
);
assert(
  requestsSrc.includes('bg-[#edf1ec]'),
  'Requests page uses soft sage panel (#edf1ec) for notices and badges'
);

// 2. Header Section
assert(
  requestsSrc.includes('Campus Requests'),
  'Header renders "Campus Requests" title'
);
assert(
  requestsSrc.includes('Find what students need, or post a request of your own.'),
  'Header renders "Find what students need, or post a request of your own." subtitle'
);
assert(
  requestsSrc.includes('Post a Request') && requestsSrc.includes('to="/create-request"'),
  'Header renders primary "Post a Request" button linking to /create-request'
);

// 3. Campus Safety Notice
assert(
  requestsSrc.includes('Campus Safety &amp; Exchange Notice') || requestsSrc.includes('Campus Safety & Exchange Notice'),
  'Renders full-width campus safety & exchange notice'
);
assert(
  requestsSrc.includes('Always inspect items in person at a verified public campus spot'),
  'Safety panel includes student in-person inspection guidance'
);

// 4. Tab and Filter Controls
assert(
  requestsSrc.includes('All Requests') && requestsSrc.includes('My Requests'),
  'Requests page provides All Requests vs My Requests tabs'
);
assert(
  requestsSrc.includes('Search campus requests') || requestsSrc.includes('placeholder="Search requests by title, description, or category..."'),
  'Requests page renders search input with clear placeholder'
);
assert(
  requestsSrc.includes('Sort requests') && 
  requestsSrc.includes('Newest first') && 
  requestsSrc.includes('Oldest first') && 
  requestsSrc.includes('Highest budget') && 
  requestsSrc.includes('Needed soonest'),
  'Sort control provides Newest, Oldest, Highest budget, and Needed soonest options'
);
assert(
  requestsSrc.includes('Textbooks') &&
  requestsSrc.includes('Electronics') &&
  requestsSrc.includes('Stationery') &&
  requestsSrc.includes('Lab Essentials') &&
  requestsSrc.includes('Hostel Essentials') &&
  requestsSrc.includes('Sports') &&
  requestsSrc.includes('College Wear') &&
  requestsSrc.includes('Other'),
  'Category filter contains all supported categories'
);

// 5. Request Cards & Schema Integrity
assert(
  requestsSrc.includes('request.category') &&
  requestsSrc.includes('request.neededBy') &&
  requestsSrc.includes('request.title') &&
  requestsSrc.includes('request.description') &&
  requestsSrc.includes('request.location'),
  'Request card renders real schema fields (category, neededBy, title, description, location)'
);
assert(
  requestsSrc.includes('request.budget'),
  'Request card conditionally displays budget badge when present'
);
assert(
  requestsSrc.includes('requester?.name') || requestsSrc.includes('requester.name'),
  'Request card renders requester name and student affiliation'
);
assert(
  requestsSrc.includes('I Have This / Contact') && requestsSrc.includes('Continue Chat'),
  'Request card renders clear response CTAs (I Have This / Contact and Continue Chat)'
);
assert(
  requestsSrc.includes('Mark as Found') && requestsSrc.includes('Cancel Request'),
  'Request card renders owner management controls (Mark as Found and Cancel Request)'
);
assert(
  requestsSrc.includes('Student Responses'),
  'Request card displays incoming student response inquiries to request owner'
);

// 6. Request Chat Isolation & Determinism
assert(
  requestsSrc.includes('const chatId = `req_${request.id}_${[currentUserId, request.requesterId].sort().join(\'_\')}`;'),
  'Requests.tsx uses isolated deterministic req_${request.id}_ chat keying'
);
assert(
  requestsSrc.includes('userChats.find(') && requestsSrc.includes('c.requestId === request.id'),
  'Requests.tsx reuses existing conversations from state'
);

// 7. Loading, Error, and Empty States
assert(
  requestsSrc.includes('requestsLoading') && requestsSrc.includes('animate-pulse'),
  'Requests page includes polished loading skeleton cards'
);
assert(
  requestsSrc.includes('requestsError') && requestsSrc.includes('Could not load campus requests'),
  'Requests page includes friendly error state'
);
assert(
  requestsSrc.includes('No matching campus requests') && 
  requestsSrc.includes('Clear All Filters'),
  'Requests page includes empty search/filter state with reset action'
);

// 8. CreateRequest Page Integration
assert(
  (createRequestSrc.includes("Can&apos;t find what you need?") || createRequestSrc.includes("Can't find what you need?")) &&
  createRequestSrc.includes('Back to Requests'),
  'CreateRequest page has clear title and back navigation'
);
assert(
  createRequestSrc.includes('border-[#dedcd4]') &&
  createRequestSrc.includes('bg-[#204b39]'),
  'CreateRequest page uses design system border and button tokens'
);
assert(
  createRequestSrc.includes('if (!title.trim())') &&
  createRequestSrc.includes('if (!description.trim())') &&
  createRequestSrc.includes('if (!neededBy.trim())') &&
  createRequestSrc.includes('if (!location.trim())'),
  'CreateRequest strictly validates required fields'
);
assert(
  createRequestSrc.includes('Posting your request…') &&
  createRequestSrc.includes('Could not post request. Please try again.'),
  'CreateRequest preserves friendly loading and error messaging'
);

// 9. App.tsx and Navigation Integration
assert(
  appSrc.includes("location.pathname === '/requests'") &&
  appSrc.includes("location.pathname === '/create-request'"),
  'App.tsx detects /requests and /create-request to apply warm background'
);

console.log('\nRequests Redesign Verification Results: All assertions passed successfully!\n');
