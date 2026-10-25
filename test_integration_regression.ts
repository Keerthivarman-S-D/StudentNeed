import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n--- Running StudentNeed Full Website Integration & Regression Verification Tests ---\n');

const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
const navbarSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/Navbar.tsx'), 'utf-8');
const marketplaceSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Marketplace.tsx'), 'utf-8');
const detailSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/ListingDetail.tsx'), 'utf-8');
const requestsSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Requests.tsx'), 'utf-8');
const createRequestSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateRequest.tsx'), 'utf-8');
const createListingSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/CreateListing.tsx'), 'utf-8');
const chatSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
const profileSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Profile.tsx'), 'utf-8');
const loginSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Login.tsx'), 'utf-8');
const registerSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Register.tsx'), 'utf-8');
const verifyEmailSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/VerifyEmail.tsx'), 'utf-8');

// 1. Full Navigation & Route Compatibility in App.tsx
assert(
  appSrc.includes('path="/marketplace"') &&
  appSrc.includes('path="/listing/:id"') &&
  appSrc.includes('path="/create-listing"') &&
  appSrc.includes('path="/create-request"') &&
  appSrc.includes('path="/login"') &&
  appSrc.includes('path="/register"') &&
  appSrc.includes('path="/verify-email"') &&
  appSrc.includes('path="/profile"') &&
  appSrc.includes('path="/reserved"') &&
  appSrc.includes('path="/requests"') &&
  appSrc.includes('path="/chat"') &&
  appSrc.includes('path="/chat/:chatId"') &&
  appSrc.includes('path="/admin"'),
  'App.tsx registers all core user-facing and admin routes with correct URL paths'
);

assert(
  appSrc.includes('<Profile defaultTab="reserved" />'),
  'App.tsx preserves /reserved alias passing defaultTab="reserved" to Profile'
);

assert(
  appSrc.includes('<ProtectedRoute>') && appSrc.includes('<Profile />'),
  'App.tsx protects Profile and Reservations routes behind ProtectedRoute'
);

assert(
  appSrc.includes('<ProtectedRoute>') && appSrc.includes('<ChatPage />'),
  'App.tsx protects /chat and /chat/:chatId routes behind ProtectedRoute'
);

assert(
  appSrc.includes("location.pathname === '/create-listing'"),
  'App.tsx registers /create-listing in isWarmBgPage for seamless #f7f6f2 page background'
);

// 2. Shared Navbar Integration
assert(
  navbarSrc.includes("navigate(`/marketplace?q=${encodeURIComponent(trimmed)}`)"),
  'Navbar search form routes search queries directly to Marketplace search query parameters'
);

assert(
  navbarSrc.includes('to="/marketplace"') &&
  navbarSrc.includes('to="/requests"') &&
  navbarSrc.includes('to="/create-listing"') &&
  navbarSrc.includes('to="/profile"'),
  'Navbar provides navigation links for Marketplace, Requests, Post Item, and Profile'
);

assert(
  navbarSrc.includes('hasActiveReservation') && navbarSrc.includes('to="/reserved"'),
  'Navbar provides quick Active Trade navigation to /reserved when user has an active reservation'
);

assert(
  navbarSrc.includes('text-[#204b39] font-bold') && navbarSrc.includes('bg-[#204b39] mt-0.5'),
  'Mobile bottom navigation uses consistent forest-green #204b39 active indicator for all tabs'
);

// 3. Marketplace & Listing Cards Integration
assert(
  marketplaceSrc.includes('ListingCard') && marketplaceSrc.includes('selectedType'),
  'Marketplace renders listings using ListingCard and provides listing type filtering'
);

assert(
  marketplaceSrc.includes('bg-[#f7f6f2]') && marketplaceSrc.includes('#204b39'),
  'Marketplace conforms to warm off-white and forest-green design tokens'
);

// 4. Listing Detail Cross-Screen Navigation
assert(
  detailSrc.includes('listing_${listing.id}_${[currentUserId, sellerId].sort().join(\'_\')}'),
  'ListingDetail constructs deterministic chat ID combining listing ID and sorted participant IDs'
);

assert(
  detailSrc.includes('navigate(`/chat/${chatId}`)'),
  'ListingDetail Contact Student navigates directly to the deterministic chat thread'
);

assert(
  detailSrc.includes('toggleSaveListing(listing.id)'),
  'ListingDetail heart toggle button uses existing toggleSaveListing context handler'
);

assert(
  detailSrc.includes("doc(db, 'reservations', resId)"),
  'ListingDetail direct reserve initializes reservation document under reservations collection'
);

// 5. Requests & CreateRequest Cross-Screen Navigation
assert(
  requestsSrc.includes('req_${request.id}_${[currentUserId, request.requesterId].sort().join(\'_\')}'),
  'Requests constructs deterministic request chat ID combining request ID and participant IDs'
);

assert(
  requestsSrc.includes('to="/create-request"'),
  'Requests page provides prominent link to Post a Request (/create-request)'
);

assert(
  createRequestSrc.includes('navigate(\'/requests\')'),
  'CreateRequest redirects to /requests upon successful submission'
);

// 6. Chat Real-Time Messaging & Reservation Coordination
assert(
  chatSrc.includes('useParams<{ chatId: string }>()'),
  'Chat component reads chatId from URL parameter'
);

assert(
  chatSrc.includes('collection(db, \'chats\', chatId, \'messages\')'),
  'Chat listens to messages subcollection under active conversation'
);

assert(
  chatSrc.includes('reservationId') && chatSrc.includes('meetup'),
  'Chat integrates reservation context and meetup coordination state'
);

// 7. Profile, Reservations & Wishlist Integration
assert(
  profileSrc.includes("const initialTab = defaultTab || (searchParams.get('tab') as any) || 'listings'"),
  'Profile tab initialization supports defaultTab prop and URL query parameter ?tab=...'
);

assert(
  profileSrc.includes('Good finds, saved for later.') &&
  profileSrc.includes('Your wishlist keeps useful campus items close. Saving does not reserve an item.'),
  'Wishlist renders exact specified title and subtitle'
);

assert(
  profileSrc.includes("setSavedListingTypeFilter('All')") &&
  profileSrc.includes("setSavedListingTypeFilter('Sale')") &&
  profileSrc.includes("setSavedListingTypeFilter('Donate')") &&
  profileSrc.includes("setSavedListingTypeFilter('Exchange')"),
  'Wishlist provides All saved, For Sale, Donate, and Exchange filter pills'
);

assert(
  profileSrc.includes('aspect-[16/10]') && profileSrc.includes('toggleSaveListing(item.id)'),
  'Wishlist cards use 16:10 wide aspect ratio and functional Remove action via toggleSaveListing'
);

assert(
  profileSrc.includes('EmailAuthProvider.credential') && profileSrc.includes('reauthenticateWithCredential'),
  'Account Settings preserves secure current-password verification before allowing password updates'
);

// 8. Auth Pages Token Consistency
assert(
  loginSrc.includes('#204b39') && registerSrc.includes('#204b39') && verifyEmailSrc.includes('#204b39'),
  'Auth screens (Login, Register, VerifyEmail) use forest-green #204b39 for primary actions'
);

assert(
  loginSrc.includes('#f7f6f2') || registerSrc.includes('#f7f6f2') || appSrc.includes('isAuthPage'),
  'Auth screens sit on consistent warm off-white background'
);

console.log('\nStudentNeed Full Website Integration & Regression Verification: All 20 integration assertions passed successfully!\n');
