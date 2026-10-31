import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n--- Running StudentNeed Marketplace UI Redesign Verification Tests ---\n');

// 1. Marketplace Component Source Inspection
const marketplaceSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Marketplace.tsx'), 'utf-8');

// Title and Subtitle
assert(
  marketplaceSrc.includes('Campus Marketplace'),
  'Marketplace renders "Campus Marketplace" heading'
);
assert(
  marketplaceSrc.includes('Discover, buy, borrow, or swap essentials with verified peers across MIT campus.'),
  'Marketplace renders description subtitle'
);

// Warm off-white background and charcoal/forest green styling
assert(
  marketplaceSrc.includes('bg-[#f7f6f2]'),
  'Marketplace uses warm off-white background (#f7f6f2)'
);
assert(
  marketplaceSrc.includes('text-[#252b27]'),
  'Marketplace uses dark charcoal (#252b27) typography'
);
assert(
  marketplaceSrc.includes('bg-[#204b39]'),
  'Marketplace uses deep forest green (#204b39) for primary buttons/accents'
);

// Logged-out campus verification banner
assert(
  marketplaceSrc.includes('!currentUser && (') || marketplaceSrc.includes('!currentUser &&'),
  'Marketplace conditionally displays verification banner for unauthenticated students'
);
assert(
  marketplaceSrc.includes('Anna University Verified Network'),
  'Campus banner renders "Anna University Verified Network" eyebrow'
);
assert(
  marketplaceSrc.includes('Access exclusive campus listings & student exchanges') ||
  marketplaceSrc.includes('Access exclusive campus listings &amp; student exchanges'),
  'Campus banner renders exclusive campus listings heading'
);
assert(
  marketplaceSrc.includes('Sign in with your verified @student.annauniv.edu email to reserve items'),
  'Campus banner provides verified email explanation'
);
assert(
  marketplaceSrc.includes('Sign In with Student Email'),
  'Campus banner includes "Sign In with Student Email" action button'
);
assert(
  marketplaceSrc.includes('to="/login"'),
  'Campus banner links to existing /login route'
);

// Search and Sorting controls
assert(
  marketplaceSrc.includes('Search campus marketplace'),
  'Marketplace renders "Search campus marketplace" label'
);
assert(
  marketplaceSrc.includes('Search items, textbooks, equipment, calculators...'),
  'Search input has correct placeholder'
);
assert(
  marketplaceSrc.includes('Sort listings'),
  'Marketplace renders "Sort listings" control'
);
assert(
  marketplaceSrc.includes('Newest first') &&
  marketplaceSrc.includes('Price: Low to High') &&
  marketplaceSrc.includes('Price: High to Low'),
  'Sorting dropdown provides all required sort options'
);

// Non-mutating sorting
assert(
  marketplaceSrc.includes('[...result]') || marketplaceSrc.includes('[...listings]'),
  'Sorting makes a copy of the listings array before sorting to avoid mutation'
);

// Filter Sidebar: Listing Type & Category
assert(
  marketplaceSrc.includes('Filters'),
  'Sidebar renders "Filters" heading'
);
assert(
  marketplaceSrc.includes('LISTING TYPE'),
  'Sidebar renders "LISTING TYPE" group'
);
assert(
  marketplaceSrc.includes('CATEGORY'),
  'Sidebar renders "CATEGORY" group'
);
assert(
  marketplaceSrc.includes('Textbooks') &&
  marketplaceSrc.includes('Electronics') &&
  marketplaceSrc.includes('Stationery') &&
  marketplaceSrc.includes('Lab Essentials') &&
  marketplaceSrc.includes('Hostel Essentials') &&
  marketplaceSrc.includes('Sports') &&
  marketplaceSrc.includes('College Wear') &&
  marketplaceSrc.includes('Other'),
  'All categories are included in the category filter'
);

// Clear/Reset option
assert(
  marketplaceSrc.includes('handleClearAllFilters'),
  'Marketplace provides a clear all / reset filters handler'
);

// Product Grid Layout
assert(
  marketplaceSrc.includes('Available Items'),
  'Product section renders "Available Items" heading'
);
assert(
  marketplaceSrc.includes('sm:grid-cols-2') || marketplaceSrc.includes('lg:grid-cols-2'),
  'Listings area is arranged in a two-column grid on desktop'
);

// Loading, Error, and Empty States
assert(
  marketplaceSrc.includes('listingsLoading ? (') || marketplaceSrc.includes('listingsLoading ?'),
  'Marketplace preserves loading skeletons state'
);
assert(
  marketplaceSrc.includes('listingsError ? (') || marketplaceSrc.includes('listingsError ?'),
  'Marketplace preserves error state'
);
assert(
  marketplaceSrc.includes('No campus items found'),
  'Marketplace preserves friendly empty results state'
);
assert(
  marketplaceSrc.includes('to="/create-listing"'),
  'Empty state connects to /create-listing'
);

// Footer
assert(
  marketplaceSrc.includes('StudentNeed · MIT Campus, Anna University · Campus meetups only'),
  'Marketplace renders student meetup footer notice'
);

// 2. ListingCard Component Inspection
const cardSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/ListingCard.tsx'), 'utf-8');

assert(
  cardSrc.includes('to={`/listing/${listing.id}`}') || cardSrc.includes('to={\'/listing/\' + listing.id}'),
  'ListingCard navigates to /listing/:id'
);
assert(
  cardSrc.includes('toggleSaveListing(listing.id)'),
  'ListingCard connects heart wishlist button to toggleSaveListing handler'
);
assert(
  cardSrc.includes('aspect-[16/10]'),
  'ListingCard uses 16:10 wide aspect ratio for listing photos'
);
assert(
  cardSrc.includes('border-[#dedcd4]'),
  'ListingCard uses subtle neutral border #dedcd4'
);
assert(
  cardSrc.includes('Student-chosen meetup'),
  'ListingCard displays campus meetup metadata'
);
assert(
  cardSrc.includes('getOptimizedImageUrl'),
  'ListingCard uses real optimized images from listing data'
);

// 3. Navbar Inspection
const navbarSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/Navbar.tsx'), 'utf-8');

assert(
  navbarSrc.includes('border-[#dedcd4]'),
  'Navbar uses clean subtle border matching design tokens'
);
assert(
  navbarSrc.includes('bg-[#204b39]'),
  'Navbar Post Item button uses deep forest green (#204b39)'
);
assert(
  navbarSrc.includes('Search campus...'),
  'Navbar search field has "Search campus..." placeholder'
);
assert(
  navbarSrc.includes('to="/marketplace"'),
  'Navbar contains Marketplace navigation link'
);
assert(
  navbarSrc.includes('to="/requests"'),
  'Navbar contains Requests navigation link'
);

// 4. App.tsx Warm Background Route Inspection
const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
assert(
  appSrc.includes("location.pathname === '/marketplace'"),
  'App.tsx detects /marketplace route to apply warm off-white background'
);

console.log('\nMarketplace Redesign Verification Results: All assertions passed successfully!\n');
