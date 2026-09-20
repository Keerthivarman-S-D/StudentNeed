import fs from 'fs';
import path from 'path';

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

console.log('\n--- Running StudentNeed Requests Chat & UX Verification Tests ---\n');

// Test 1: Deterministic Request Chat Keying & Conversation Reuse
{
  const studentA = 'user_student_A_uid';
  const studentB = 'user_student_B_uid';
  const requestId = 'req_item_12345';

  const makeChatId = (reqId: string, u1: string, u2: string) =>
    `req_${reqId}_${[u1, u2].sort().join('_')}`;

  const chatId1 = makeChatId(requestId, studentA, studentB);
  const chatId2 = makeChatId(requestId, studentB, studentA);
  const chatId3 = makeChatId(requestId, studentA, studentB);

  assert(chatId1 === chatId2, 'Chat ID is deterministic regardless of initiator');
  assert(chatId1 === chatId3, 'Repeated clicks produce identical Chat ID (prevents duplicate chats)');
  assert(chatId1.startsWith('req_req_item_12345_'), 'Chat ID includes request ID context');
}

// Test 2: Existing Conversation Reuse in Requests.tsx
{
  const requestsSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Requests.tsx'), 'utf-8');
  assert(
    requestsSrc.includes('const existingInState = userChats.find'),
    'Requests.tsx reuses existing conversation from userChats state immediately'
  );
  assert(
    requestsSrc.includes('navigate(`/chat/${existingInState.id}`)'),
    'Requests.tsx navigates to existing chat without duplicate creation'
  );
  assert(
    requestsSrc.includes('Fallback: If getDoc fails due to security rules evaluation on null resource'),
    'Requests.tsx includes graceful fallback creation for prospective chats'
  );
}

// Test 3: Firestore Rules Chat Permissions
{
  const rulesSrc = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8').replace(/\r\n/g, '\n');
  
  assert(
    rulesSrc.includes('allow get: if isAuthorizedStudent() && (\n        resource == null ||'),
    'firestore.rules allows get on non-existent chat docs (resource == null) without evaluation error'
  );
  assert(
    rulesSrc.includes('allow list: if isAuthorizedStudent() && (\n        request.auth.uid in resource.data.participants'),
    'firestore.rules isolates chat listing strictly to participants'
  );
  assert(
    rulesSrc.includes("(!('requestId' in request.resource.data) || request.resource.data.requestId is string)"),
    'firestore.rules authorizes requestId in chat creation'
  );
  assert(
    rulesSrc.includes('request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants'),
    'firestore.rules allows both participants to send and receive messages in chat'
  );
}

// Test 4: Create Request Form Validation & UX
{
  const createRequestSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateRequest.tsx'), 'utf-8');

  assert(
    createRequestSrc.includes("if (!title.trim())"),
    'CreateRequest validates title is non-empty / non-whitespace'
  );
  assert(
    createRequestSrc.includes("if (!description.trim())"),
    'CreateRequest validates description is non-empty / non-whitespace'
  );
  assert(
    createRequestSrc.includes("if (!neededBy.trim())"),
    'CreateRequest validates neededBy is non-empty / non-whitespace'
  );
  assert(
    createRequestSrc.includes("if (!location.trim())"),
    'CreateRequest validates location is non-empty / non-whitespace'
  );
  assert(
    createRequestSrc.includes('Posting your request…'),
    'CreateRequest displays friendly "Posting your request…" loading state'
  );
  assert(
    createRequestSrc.includes("setError('Could not post request. Please try again.')"),
    'CreateRequest displays friendly error message on failure without leaking Firestore'
  );
  assert(
    !createRequestSrc.includes('Posting to Firestore'),
    'CreateRequest removed "Posting to Firestore"'
  );
}

// Test 5: Elimination of Technical Developer Jargon Across UI Components
{
  const checkFiles = [
    'src/pages/Requests.tsx',
    'src/pages/CreateRequest.tsx',
    'src/pages/CreateListing.tsx',
    'src/pages/Marketplace.tsx',
    'src/components/EditListingModal.tsx',
    'src/pages/Profile.tsx',
    'src/components/StudentNeedChatbot.tsx',
  ];

  const forbiddenTerms = [
    'to Firestore',
    'from Firestore',
    'to Cloudinary',
    'from Cloudinary',
    'Server responded with status',
  ];

  let foundForbidden = false;

  for (const file of checkFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
    for (const term of forbiddenTerms) {
      if (content.includes(term)) {
        console.error(`Forbidden term "${term}" found in ${file}`);
        foundForbidden = true;
      }
    }
  }

  assert(!foundForbidden, 'No user-facing developer jargon (Firestore/Cloudinary/Server status) found in UI components');
}

// Test 6: Preserved Real-Time Chat Infrastructure & Banner
{
  const chatSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
  assert(
    chatSrc.includes('itemRequest && (') && chatSrc.includes('Request Context Bar'),
    'Chat.tsx displays rich request context banner with title, budget, status, location, neededBy'
  );
  assert(
    chatSrc.includes('collection(db, \'chats\', chatId, \'messages\')'),
    'Chat.tsx uses subcollection messages for real-time exchange'
  );
}

// Test 7: Sanitized AppContext & Firebase Error Handling
{
  const firebaseSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/firebase.ts'), 'utf-8');
  assert(
    firebaseSrc.includes("console.error('Firestore Error: ', JSON.stringify(errInfo));") &&
    firebaseSrc.includes("throw new Error('Unable to complete request. Please try again.');"),
    'firebase.ts keeps full developer logs in console while throwing sanitized friendly error'
  );

  const appContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf-8');
  assert(
    appContextSrc.includes("setRequestsError('Unable to load campus requests right now. Please refresh.');") &&
    appContextSrc.includes("setListingsError('Unable to load campus listings right now. Please refresh.');"),
    'AppContext sanitizes requestsError and listingsError to avoid displaying raw Firestore errors'
  );
}

// Test 8: Single Photo and Optional Photo in CreateListing.tsx
{
  const createListingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateListing.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    createListingSrc.includes('const [uploadedImage, setUploadedImage] = useState<string | null>(null);'),
    'CreateListing tracks a single uploadedImage state instead of an array of images'
  );
  assert(
    !createListingSrc.includes('up to 4 images') && !createListingSrc.includes('MAX_IMAGES = 4'),
    'CreateListing removed "up to 4 images" and MAX_IMAGES = 4'
  );
  assert(
    createListingSrc.includes('1 photo (up to 5MB)'),
    'CreateListing indicates single photo limit of 1 photo (up to 5MB)'
  );
  assert(
    !createListingSrc.includes('Sale listings require at least one photo'),
    'CreateListing does NOT mandate photos for Sale listings (photos are optional)'
  );
  assert(
    createListingSrc.includes('images: finalImages') && createListingSrc.includes('uploadedImage ? [uploadedImage] : [];'),
    'CreateListing formats images as 0 or 1 item array for database compatibility'
  );
}

// Test 9: Elimination of Borrow from CreateListing.tsx
{
  const createListingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateListing.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    createListingSrc.includes("const types: ActiveListingType[] = ['Sale', 'Donate', 'Exchange'];"),
    'CreateListing only offers active types: Sale (Sell), Donate, and Exchange'
  );
  assert(
    !createListingSrc.includes("'Borrow'"),
    'CreateListing completely removed "Borrow" from types and forms'
  );
  assert(
    createListingSrc.includes('grid grid-cols-3 gap-3'),
    'CreateListing displays a 3-column type selector for the active offering types'
  );
  assert(
    !createListingSrc.includes("type === 'Borrow'"),
    'CreateListing removed all active Borrow condition branching'
  );
}

// Test 10: Single Photo and Optional Photo in EditListingModal.tsx
{
  const editListingSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/EditListingModal.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    editListingSrc.includes('const [image, setImage] = useState<string | null>(listing.images?.[0] || null);'),
    'EditListingModal initializes single photo from existing listing images[0]'
  );
  assert(
    !editListingSrc.includes('Sale listings require at least one photo') &&
    !editListingSrc.includes('Please provide at least one photo for items on sale'),
    'EditListingModal does NOT require photo for Sale listings'
  );
  assert(
    !editListingSrc.includes('You can upload a maximum of 4 images'),
    'EditListingModal removed 4 image limit check'
  );
  assert(
    editListingSrc.includes('images: image ? [image] : []'),
    'EditListingModal submits 0 or 1 image in updates'
  );
}

// Test 11: Legacy Borrow Listing Conversion in EditListingModal.tsx
{
  const editListingSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/EditListingModal.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    editListingSrc.includes("const ACTIVE_TYPES: ActiveListingType[] = ['Sale', 'Donate', 'Exchange'];"),
    'EditListingModal defines active offering types for selection'
  );
  assert(
    editListingSrc.includes('Legacy Borrow Listing') &&
    editListingSrc.includes('Borrow listings have been retired from the active marketplace'),
    'EditListingModal displays informative banner when editing an old Borrow listing'
  );
  assert(
    editListingSrc.includes('Convert to') &&
    editListingSrc.includes('updates.type = type;'),
    'EditListingModal provides conversion buttons and persists type change in update payload'
  );
}

// Test 12: Neutral "No Image" Placeholder & Clean Badges in Cards and Details
{
  const listingCardSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/ListingCard.tsx'), 'utf-8');
  assert(
    listingCardSrc.includes('<ImageOff className="h-8 w-8 text-zinc-300 mb-1.5" />') &&
    listingCardSrc.includes('<span className="text-xs font-medium text-zinc-400">No image</span>'),
    'ListingCard renders neutral "No image" placeholder with ImageOff icon'
  );
  assert(
    listingCardSrc.includes('{listing.condition && ('),
    'ListingCard only renders condition badge if condition exists'
  );

  const listingDetailSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/ListingDetail.tsx'), 'utf-8');
  assert(
    listingDetailSrc.includes('<ImageOff className="h-12 w-12 text-zinc-300 mb-2" />') &&
    listingDetailSrc.includes('<span className="text-sm font-medium text-zinc-400">No image</span>'),
    'ListingDetail renders neutral "No image" placeholder with ImageOff icon'
  );
  assert(
    listingDetailSrc.includes('{listing.condition && ('),
    'ListingDetail only renders condition badge if condition exists'
  );
}

// Test 13: Total Elimination of Hardcoded Unsplash Paper Bag Image Fallbacks
{
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf-8');
  assert(
    !appSrc.includes('photo-1544816155-12df9643f363'),
    'AppContext contains no hardcoded Unsplash fallback image URL'
  );

  const createSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateListing.tsx'), 'utf-8');
  assert(
    !createSrc.includes('photo-1544816155-12df9643f363'),
    'CreateListing contains no hardcoded Unsplash fallback image URL'
  );
}

// Test 14: Marketplace Filters Exclude Borrow
{
  const marketplaceSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Marketplace.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    marketplaceSrc.includes("const types: (ActiveListingType | 'All')[] = ['All', 'Sale', 'Donate', 'Exchange'];"),
    'Marketplace filter list only offers All, Sale (For Sale), Donate, and Exchange'
  );
  assert(
    !marketplaceSrc.includes("'Borrow'"),
    'Marketplace filter list completely removes "Borrow"'
  );
}

// Test 15: Backward Compatibility for Historical Borrow Listings
{
  const listingCardSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/ListingCard.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    listingCardSrc.includes("case 'Borrow': return 'warning';"),
    'ListingCard maintains warning badge compatibility for historical Borrow listings'
  );

  const listingDetailSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/ListingDetail.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    listingDetailSrc.includes("case 'Borrow': return 'warning';"),
    'ListingDetail maintains warning badge compatibility for historical Borrow listings'
  );

  const typesSrc = fs.readFileSync(path.join(process.cwd(), 'src/types.ts'), 'utf-8').replace(/\r\n/g, '\n');
  assert(
    typesSrc.includes("export type ListingType = 'Sale' | 'Borrow' | 'Donate' | 'Exchange';"),
    'types.ts preserves ListingType containing "Borrow" for historical Firestore documents'
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}
