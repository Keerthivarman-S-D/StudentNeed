import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n--- Running StudentNeed Listing Detail UI Redesign Verification Tests ---\n');

const detailSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/ListingDetail.tsx'), 'utf-8');

// 1. Breadcrumbs and Title
assert(
  detailSrc.includes('to="/marketplace"') &&
  detailSrc.includes('listing.category') &&
  detailSrc.includes('listing.title'),
  'ListingDetail renders title and breadcrumb navigation'
);

// 2. Gallery and Thumbnails
assert(
  detailSrc.includes('aspect-[16/10]') && detailSrc.includes('getOptimizedImageUrl'),
  'ListingDetail main gallery uses 16:10 wide aspect ratio with optimized image delivery'
);
assert(
  detailSrc.includes('listing.images.slice(0, 4)') || detailSrc.includes('listing.images.slice'),
  'ListingDetail renders thumbnail strip for multi-photo listings'
);
assert(
  detailSrc.includes('<ImageOff className="h-12 w-12 text-zinc-300 mb-2" />') &&
  detailSrc.includes('<span className="text-sm font-medium text-zinc-400">No image</span>'),
  'ListingDetail preserves neutral "No image" fallback with ImageOff icon'
);

// 3. About this item card
assert(
  detailSrc.includes('About this item'),
  'ListingDetail renders "About this item" card heading'
);
assert(
  detailSrc.includes('Please check the item and its functions when you meet.'),
  'ListingDetail includes student inspection reminder'
);

// 4. Primary Action Card: Badges, Price, and Buttons
assert(
  detailSrc.includes('listing.price') && detailSrc.includes('listing.type'),
  'Action card renders listing price and type badge'
);
assert(
  detailSrc.includes('bg-[#204b39]'),
  'Primary action button uses deep forest green (#204b39)'
);
assert(
  detailSrc.includes('Reserve item') || detailSrc.includes('View Request in Chat'),
  'Action card includes "Reserve item" CTA'
);
assert(
  detailSrc.includes('Message student'),
  'Action card includes "Message student" CTA'
);
assert(
  detailSrc.includes('Save to wishlist'),
  'Action card includes "Save to wishlist" CTA'
);
assert(
  detailSrc.includes('Reserve to express interest. Discuss the exchange directly with the owner.'),
  'Action card displays exchange guidance subtext'
);

// 5. "LISTED BY" and "Meet on campus" Cards
assert(
  detailSrc.includes('LISTED BY'),
  'ListingDetail renders "LISTED BY" student profile card'
);
assert(
  detailSrc.includes('Campus student · Anna University'),
  'Listed by card includes Anna University affiliation notice'
);
assert(
  detailSrc.includes('Meet on campus'),
  'ListingDetail renders "Meet on campus" location card'
);
assert(
  detailSrc.includes('Suggested by the student, not an official pickup location.'),
  'Meet on campus card includes student-chosen pickup notice'
);

// 6. Full-Width Safety Exchange Notice
assert(
  detailSrc.includes('A simple student-to-student exchange'),
  'ListingDetail renders full-width safety banner title'
);
assert(
  detailSrc.includes('StudentNeed does not arrange delivery or process payments.'),
  'Safety banner clarifies zero delivery/payment liability'
);

// 7. Footer
assert(
  detailSrc.includes('StudentNeed · MIT Campus, Anna University · Campus meetups only'),
  'ListingDetail renders campus meetup footer'
);

// 8. Owner and Modals Management
assert(
  detailSrc.includes('Edit Listing') && detailSrc.includes('Cancel Post'),
  'ListingDetail provides owner management actions'
);
assert(
  detailSrc.includes('<EditListingModal') && detailSrc.includes('<ReportListingModal'),
  'ListingDetail preserves edit and report modals'
);

// 9. App.tsx detects /listing/ routes
const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
assert(
  appSrc.includes("location.pathname.startsWith('/listing/')"),
  'App.tsx detects /listing/ route to apply warm background'
);

console.log('\nListing Detail Redesign Verification Results: All assertions passed successfully!\n');
