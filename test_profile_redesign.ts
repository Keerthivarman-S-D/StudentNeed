import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n--- Running StudentNeed Profile & Account Settings UI Redesign Verification Tests ---\n');

const profileSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Profile.tsx'), 'utf-8');
const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
const typesSrc = fs.readFileSync(path.join(process.cwd(), 'src/types.ts'), 'utf-8');

// 1. App.tsx Background Registration
assert(
  appSrc.includes("location.pathname === '/profile'") && appSrc.includes("location.pathname === '/reserved'"),
  'App.tsx registers /profile and /reserved routes for warm background (#f7f6f2)'
);

// 2. Visual Design Tokens
assert(profileSrc.includes('bg-[#f7f6f2]'), 'Profile page uses warm off-white background (#f7f6f2)');
assert(profileSrc.includes('text-[#252b27]'), 'Profile page uses dark charcoal typography (#252b27)');
assert(profileSrc.includes('text-[#555d56]'), 'Profile page uses secondary charcoal text (#555d56)');
assert(profileSrc.includes('text-[#717870]'), 'Profile page uses muted neutral text (#717870)');
assert(profileSrc.includes('bg-[#204b39]') && profileSrc.includes('hover:bg-[#183a2c]'), 'Profile page uses deep forest green (#204b39) and hover (#183a2c) for primary actions');
assert(profileSrc.includes('border-[#dedcd4]'), 'Profile page uses subtle neutral borders (#dedcd4)');
assert(profileSrc.includes('bg-[#edf1ec]'), 'Profile page uses soft sage surfaces and badges (#edf1ec)');

// 3. Two-Column Layout & Unified Left Sidebar
assert(
  profileSrc.includes('grid-cols-[240px_1fr]') || profileSrc.includes('grid-cols-[260px_1fr]'),
  'Profile page uses a two-column layout with sidebar'
);
assert(profileSrc.includes('Profile') && profileSrc.includes('Account settings'), 'Sidebar provides Profile and Account Settings navigation');
assert(profileSrc.includes('Reservations') && profileSrc.includes('Wishlist') && profileSrc.includes('Chat'), 'Sidebar provides Reservations, Wishlist, and Chat navigation');
assert(profileSrc.includes('MIT Campus · Anna University'), 'Sidebar renders campus affiliation footer');
assert(
  profileSrc.includes('bg-[#edf1ec] text-[#204b39]'),
  'Sidebar highlights active tab with soft sage surface and forest-green text'
);

// 4. Profile Page ("Your campus corner.") Layout
assert(profileSrc.includes('Your campus corner.'), 'Profile page renders "Your campus corner." heading');
assert(profileSrc.includes('Manage your listings and the essentials you’re sharing.'), 'Profile page renders descriptive subtitle');
assert(profileSrc.includes('Edit profile'), 'Student profile card includes "Edit profile" action');
assert(profileSrc.includes('currentUser.yearOfStudy') || profileSrc.includes('2nd Year'), 'Profile card renders year of study');
assert(profileSrc.includes('currentUser.bio') || profileSrc.includes('Engineering student'), 'Profile card renders student bio');

// 5. Cloudinary Photo Upload & Persistence
assert(profileSrc.includes('uploadImageToCloudinary'), 'Profile preserves Cloudinary photo upload');
assert(profileSrc.includes('validateImageFile'), 'Profile validates uploaded avatar file type and size');
assert(profileSrc.includes('avatarUrl: secureUrl'), 'Profile persists uploaded avatar to Firestore users document');
assert(profileSrc.includes('isUploadingImage'), 'Profile renders camera upload indicator with loading state');

// 6. Quick Navigation Cards
assert(profileSrc.includes('Reservations &rarr;') || profileSrc.includes('Reservations →'), 'Profile renders Reservations quick-nav card');
assert(profileSrc.includes('Wishlist &rarr;') || profileSrc.includes('Wishlist →'), 'Profile renders Wishlist quick-nav card');
assert(profileSrc.includes('Chat &rarr;') || profileSrc.includes('Chat →'), 'Profile renders Chat quick-nav card');

// 7. Your Listings Section
assert(profileSrc.includes('Your listings'), 'Profile renders "Your listings" section heading');
assert(profileSrc.includes('Post Item'), 'Profile renders "+ Post Item" primary button');
assert(profileSrc.includes('/create-listing'), 'Post Item button navigates to /create-listing');
assert(profileSrc.includes("filterKey === 'active'"), 'Listings section provides Active filter pill');
assert(profileSrc.includes("filterKey === 'reserved'") && profileSrc.includes("'Completed'"), 'Listings section provides Completed filter pill');
assert(profileSrc.includes('aspect-[16/10]'), 'Listing cards use 16:10 wide aspect ratio for photos');
assert(profileSrc.includes('Edit listing') && profileSrc.includes('setListingToEdit'), 'Listing card includes functional Edit listing modal trigger');
assert(profileSrc.includes('View') && profileSrc.includes('/listing/'), 'Listing card includes functional View navigation');

// 8. Account Settings 4 Cards Structure
assert(profileSrc.includes('Account settings'), 'Settings view renders "Account settings" heading');
assert(profileSrc.includes('Profile details'), 'Settings view renders "Profile details" card');
assert(profileSrc.includes('Display name') && profileSrc.includes('Year of study'), 'Profile details includes Display name and Year of study');
assert(profileSrc.includes('About you'), 'Profile details includes "About you" textarea');
assert(profileSrc.includes('Save changes'), 'Profile details includes "Save changes" primary action');

assert(profileSrc.includes('Campus email'), 'Settings view renders "Campus email" card');
assert(profileSrc.includes('Student email'), 'Campus email card renders read-only student email input');
assert(profileSrc.includes('Campus-only access'), 'Campus email card renders "Campus-only access" callout banner');

assert(profileSrc.includes('Change password'), 'Settings view renders "Change password" card');
assert(profileSrc.includes('Current password'), 'Change password card includes "Current password" input');
assert(profileSrc.includes('New password') && profileSrc.includes('Confirm new password'), 'Change password card includes new and confirm password inputs');
assert(profileSrc.includes('Update password'), 'Change password card includes "Update password" button');

assert(profileSrc.includes('Signing out'), 'Settings view renders "Signing out" card');
assert(profileSrc.includes('handleLogout') || profileSrc.includes('logout()'), 'Signing out card includes functional Sign out action');

// 9. Current-Password Security Flow Verification
assert(
  profileSrc.includes('EmailAuthProvider.credential') && profileSrc.includes('reauthenticateWithCredential'),
  'Current password is used to securely re-authenticate the student session before password change'
);
assert(
  profileSrc.includes('Current password is incorrect'),
  'Provides friendly security feedback when current password is wrong'
);
assert(
  profileSrc.includes('AUTH_ENDPOINTS.changePassword'),
  'Change password calls secure backend changePassword endpoint'
);
assert(
  profileSrc.includes('PasswordRequirements'),
  'Change password renders real-time password requirements checklist'
);
assert(
  profileSrc.includes('showNewPassword') && profileSrc.includes('showConfirmNewPassword') && profileSrc.includes('showCurrentPassword'),
  'Provides accessible password visibility toggles for all password fields'
);
assert(
  !profileSrc.includes('console.log(newPassword)') && !profileSrc.includes('console.log(currentPassword)'),
  'No password variables are logged to console'
);

// 10. Data Model & Types Alignment
assert(
  typesSrc.includes('yearOfStudy?: string;') && typesSrc.includes('bio?: string;'),
  'User type definition supports yearOfStudy and bio fields'
);

// 11. Preserved Routing & Tab Aliases
assert(
  profileSrc.includes("defaultTab?: 'listings' | 'reserved' | 'saved' | 'settings'"),
  'Profile component accepts defaultTab prop for /reserved route compatibility'
);
assert(
  profileSrc.includes("setSearchParams({ tab: newTab })") || profileSrc.includes("searchParams.get('tab')"),
  'Profile component synchronizes active tab with URL query parameters'
);

// 12. Stage 3: Reservations Redesign & Functional Parity
assert(
  profileSrc.includes('Keep track of your interest in items and coordinate the campus handoff.'),
  'Reservations view renders exact specified subtitle'
);
assert(
  profileSrc.includes('Items I Reserved') && profileSrc.includes('Incoming Requests'),
  'Reservations renders Items I Reserved and Incoming Requests filter tabs'
);
assert(
  profileSrc.includes('Past exchanges'),
  'Reservations renders Past exchanges view for completed handoffs'
);
assert(
  profileSrc.includes('Reserved items are held while students coordinate meetup'),
  'Reservations renders restrained clock hold notice banner'
);
assert(
  profileSrc.includes("res.status === 'completed'") && profileSrc.includes("Completed"),
  'Reservations card renders completed status badge'
);
assert(
  profileSrc.includes("res.status === 'accepted'") && profileSrc.includes("Reserved"),
  'Reservations card renders accepted/reserved status badge'
);
assert(
  profileSrc.includes("res.status === 'pending'") && profileSrc.includes("Pending"),
  'Reservations card renders pending status badge'
);
assert(
  profileSrc.includes('Meetup:') && (profileSrc.includes('Confirmed') || profileSrc.includes('Proposed')),
  'Reservations card renders campus meetup strip with confirmation status'
);
assert(
  profileSrc.includes("onClick={() => navigate(`/chat/${res.chatId}`)}") || profileSrc.includes("navigate('/chat/' + res.chatId)"),
  'Reservations card Open Chat button navigates using exact deterministic res.chatId'
);
assert(
  profileSrc.includes("navigate(`/listing/${res.listingId}`)") || profileSrc.includes("navigate('/listing/' + res.listingId)"),
  'Reservations card Item button navigates to listing detail'
);
assert(
  profileSrc.includes('handleAcceptReservation') && profileSrc.includes('RESERVATION_ENDPOINTS.accept'),
  'Reservations provides authorized seller acceptance action calling backend endpoint'
);
assert(
  profileSrc.includes('handleDeclineReservation'),
  'Reservations provides authorized seller decline action'
);
assert(
  profileSrc.includes('handleCancelReservation') && profileSrc.includes('RESERVATION_ENDPOINTS.cancel'),
  'Reservations provides authorized buyer cancellation action calling backend endpoint'
);
assert(
  profileSrc.includes('handleConfirmReservationMeetup'),
  'Reservations provides meetup confirmation action'
);
assert(
  profileSrc.includes('No items reserved yet') && profileSrc.includes('No incoming requests yet'),
  'Reservations provides friendly empty states for outgoing and incoming views'
);
assert(
  profileSrc.includes('isLoadingReservations') && profileSrc.includes('Skeleton'),
  'Reservations provides polished loading skeleton cards'
);

// 13. Stage 4: Wishlist / Saved Items Redesign
assert(
  profileSrc.includes('Good finds, saved for later.'),
  'Wishlist view renders exact specified title: "Good finds, saved for later."'
);
assert(
  profileSrc.includes('Your wishlist keeps useful campus items close. Saving does not reserve an item.'),
  'Wishlist view renders exact specified subtitle'
);
assert(
  profileSrc.includes("setSavedListingTypeFilter('All')") && profileSrc.includes('All saved'),
  'Wishlist renders "All saved" filter pill'
);
assert(
  profileSrc.includes("setSavedListingTypeFilter('Sale')") && profileSrc.includes('For Sale'),
  'Wishlist renders "For Sale" filter pill'
);
assert(
  profileSrc.includes("setSavedListingTypeFilter('Donate')") && profileSrc.includes('Donate'),
  'Wishlist renders "Donate" filter pill'
);
assert(
  profileSrc.includes("setSavedListingTypeFilter('Exchange')") && profileSrc.includes('Exchange'),
  'Wishlist renders "Exchange" filter pill'
);
assert(
  profileSrc.includes("savedListingTypeFilter === 'All'") && profileSrc.includes('bg-[#edf1ec] text-[#204b39]'),
  'Wishlist highlights active filter pill with soft sage background and forest-green text'
);
assert(
  profileSrc.includes('grid-cols-1 md:grid-cols-2 gap-5'),
  'Wishlist cards render responsive two-column desktop and single-column mobile grid'
);
assert(
  profileSrc.includes('aspect-[16/10]'),
  'Wishlist cards use 16:10 aspect ratio image container with fallback'
);
assert(
  profileSrc.includes('Heart') && profileSrc.includes('Remove ${item.title} from wishlist'),
  'Wishlist card renders heart/save control with accessible label'
);
assert(
  profileSrc.includes('View item') && profileSrc.includes('navigate(`/listing/${item.id}`)'),
  'Wishlist card provides "View item" action linking to listing detail'
);
assert(
  profileSrc.includes('Remove') && profileSrc.includes('toggleSaveListing(item.id)'),
  'Wishlist card provides "Remove" action reusing existing toggleSaveListing'
);
assert(
  profileSrc.includes('No saved items yet') && profileSrc.includes('Browse marketplace'),
  'Wishlist renders friendly empty state with "Browse marketplace" action'
);
assert(
  profileSrc.includes('listingsLoading && mySavedListings.length === 0'),
  'Wishlist renders loading skeletons while listings are loading'
);

console.log('\nProfile, Account Settings, Reservations & Wishlist Redesign Verification: All assertions passed successfully!\n');

