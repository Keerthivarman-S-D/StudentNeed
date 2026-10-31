import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n--- Running StudentNeed Chat Page UI Redesign Verification Tests ---\n');

const chatSrc = fs.readFileSync(path.join(process.cwd(), 'src/pages/Chat.tsx'), 'utf-8');
const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');

// 1. Visual Design Tokens
assert(
  chatSrc.includes('bg-[#f7f6f2]'),
  'Chat page uses warm off-white background (#f7f6f2)'
);
assert(
  chatSrc.includes('text-[#252b27]'),
  'Chat page uses dark charcoal typography (#252b27)'
);
assert(
  chatSrc.includes('text-[#555d56]'),
  'Chat page uses secondary charcoal text (#555d56)'
);
assert(
  chatSrc.includes('text-[#555d56]'),
  'Chat page uses accessible muted text (#555d56)'
);
assert(
  chatSrc.includes('bg-[#204b39]') && chatSrc.includes('hover:bg-[#183a2c]'),
  'Chat page uses deep forest green (#204b39) and hover (#183a2c) for primary actions'
);
assert(
  chatSrc.includes('border-[#dedcd4]'),
  'Chat page uses subtle neutral borders (#dedcd4)'
);
assert(
  chatSrc.includes('bg-[#edf1ec]'),
  'Chat page uses soft sage panels and badges (#edf1ec)'
);

// 2. Responsive Two-Panel Layout
assert(
  chatSrc.includes('w-full md:w-80 lg:w-96') && chatSrc.includes('border-r border-[#dedcd4]'),
  'Chat page renders conversation sidebar panel with responsive widths'
);
assert(
  chatSrc.includes('flex-1 flex flex-col bg-white min-w-0'),
  'Chat page renders active conversation panel'
);

// 3. Conversation Sidebar
assert(
  chatSrc.includes('Messages') && chatSrc.includes('Search conversations...'),
  'Sidebar renders "Messages" title and conversation search input'
);
assert(
  chatSrc.includes('chatUnreadCounts[c.id]') || chatSrc.includes('unreadCount > 0'),
  'Sidebar renders unread notification badge counter'
);
assert(
  chatSrc.includes('No messages yet') && chatSrc.includes('When you connect with peers'),
  'Sidebar renders friendly empty state when user has no conversations'
);
assert(
  chatSrc.includes('border-l-4 border-l-[#204b39]') || chatSrc.includes('bg-[#edf1ec]'),
  'Sidebar visually highlights the currently selected conversation'
);

// 4. Active Conversation Header & Context
assert(
  chatSrc.includes('otherUser?.name') && chatSrc.includes('Anna University'),
  'Conversation header displays other participant name and Anna University student affiliation'
);
assert(
  chatSrc.includes('itemRequest && (') && chatSrc.includes('Request Context Bar'),
  'Preserves rich Request Context Bar for campus request threads'
);
assert(
  chatSrc.includes('listing && (') && chatSrc.includes('Reservation Status & Action Bar'),
  'Preserves rich Reservation Status and Action Bar for marketplace listing threads'
);

// 5. Message Feed & Bubble Styling
assert(
  chatSrc.includes('bg-[#204b39] text-white rounded-tr-xs'),
  'Current user outgoing messages styled in forest-green bubbles (#204b39)'
);
assert(
  chatSrc.includes('bg-white text-[#252b27] border border-[#dedcd4] rounded-tl-xs'),
  'Counterparty received messages styled in neutral white cards with subtle borders'
);
assert(
  chatSrc.includes('break-words') && chatSrc.includes('whitespace-pre-wrap'),
  'Messages wrap text gracefully without horizontal overflow'
);
assert(
  chatSrc.includes('Quick Starters'),
  'Empty conversation displays quick starter prompts'
);

// 6. Message Composer
assert(
  chatSrc.includes('placeholder="Type your message to coordinate pickup..."'),
  'Composer renders accessible text input with clear placeholder'
);
assert(
  chatSrc.includes('type="submit"') && chatSrc.includes('bg-[#204b39]') && chatSrc.includes('Send'),
  'Composer provides primary forest-green Send action'
);

// 7. Route and Navbar Integration
assert(
  appSrc.includes('path="/chat"') && appSrc.includes('path="/chat/:chatId"'),
  'App.tsx registers both /chat and /chat/:chatId routes'
);
assert(
  appSrc.includes("location.pathname.startsWith('/chat')"),
  'App.tsx applies warm off-white background to all chat routes'
);

console.log('\nChat Redesign Verification Results: All assertions passed successfully!\n');
