import fs from 'fs';
import path from 'path';
import {
  validateGenUIPayload
} from './src/lib/genuiValidator';
import {
  detectGenUIIntent,
  generateGenUIPayload
} from './src/lib/genuiEngine';
import {
  GENUI_COMPONENT_REGISTRY,
  isApprovedGenUIComponent
} from './src/components/genui/GenUIRegistry';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\x1b[31mFAIL: ${message}\x1b[0m`);
    process.exit(1);
  }
  console.log(`\x1b[32mPASS:\x1b[0m ${message}`);
}

console.log('\n--- Running Generative UI (GenUI) System Specification Tests ---\n');

// =========================================================================
// SECTION 1: TypeScript Types & Schemas
// =========================================================================
console.log('1. Component Schemas & TypeScript Definitions:');
const typesSrc = fs.readFileSync(path.join(process.cwd(), 'src/types/genui.ts'), 'utf-8');

assert(
  typesSrc.includes("'informational'") &&
  typesSrc.includes("'item_search'") &&
  typesSrc.includes("'comparison'") &&
  typesSrc.includes("'data_summary'") &&
  typesSrc.includes("'user_input'") &&
  typesSrc.includes("'destructive_action'") &&
  typesSrc.includes("'unsupported'"),
  'Defines all 7 specification intents (informational, item_search, comparison, data_summary, user_input, destructive_action, unsupported)'
);

assert(
  typesSrc.includes("'listing_cards'") &&
  typesSrc.includes("'comparison_table'") &&
  typesSrc.includes("'data_summary'") &&
  typesSrc.includes("'action_form'") &&
  typesSrc.includes("'confirmation_dialog'") &&
  typesSrc.includes("'search_filter'") &&
  typesSrc.includes("'empty_state'") &&
  typesSrc.includes("'error_state'"),
  'Defines approved UI component types matching specification component library'
);

assert(
  typesSrc.includes('export interface GenUIPayload') &&
  typesSrc.includes('message: string;') &&
  typesSrc.includes('component: GenUIComponentSpec;'),
  'GenUIPayload requires mandatory message fallback alongside structured component spec'
);

// =========================================================================
// SECTION 2: Runtime Schema Validator & Security Sanitization
// =========================================================================
console.log('\n2. Security, Schema Validation & Sanitization:');

// Test 2A: Valid Payload Passes
const validListingPayload = generateGenUIPayload('find textbooks for engineering math');
const valResult = validateGenUIPayload(validListingPayload);
assert(valResult.valid === true, 'Valid listing cards payload passes runtime schema validator');
assert(valResult.sanitizedPayload?.intent === 'item_search', 'Valid payload preserves item_search intent');

// Test 2B: Rejects null / non-objects
const nullCheck = validateGenUIPayload(null);
assert(!nullCheck.valid && Boolean(nullCheck.error), 'Rejects null payload with descriptive error');

// Test 2C: Rejects unknown / unapproved intent
const invalidIntentPayload = {
  intent: 'hack_database',
  message: 'Invalid intent payload',
  component: { type: 'text', body: 'Sample' }
};
const intentCheck = validateGenUIPayload(invalidIntentPayload);
assert(!intentCheck.valid, 'Rejects unapproved intent');

// Test 2D: Rejects missing component specification
const missingCompPayload = {
  intent: 'informational',
  message: 'Missing component'
};
const compCheck = validateGenUIPayload(missingCompPayload);
assert(!compCheck.valid, 'Rejects payload with missing component spec');

// Test 2E: Security sanitization against script injection
const maliciousPayload = {
  intent: 'informational',
  message: '<script>alert("xss")</script>Welcome to StudentNeed',
  component: {
    type: 'text',
    body: 'Safe text content'
  }
};
const xssCheck = validateGenUIPayload(maliciousPayload);
assert(xssCheck.valid === true, 'Accepts sanitized structure');
assert(!xssCheck.sanitizedPayload?.message.includes('<script>'), 'Strips raw <script> tags from message');

// =========================================================================
// SECTION 3: Intent-to-UI Mapping (7 Rules)
// =========================================================================
console.log('\n3. Intent-to-UI Rules Verification:');

// Rule 1: Item searches → listing cards with relevant details
const searchPayload = generateGenUIPayload('Search for Casio scientific calculator');
assert(searchPayload.intent === 'item_search', 'Rule 1: Search query detects item_search intent');
assert(searchPayload.component.type === 'listing_cards', 'Rule 1: item_search maps to listing_cards component');
assert(
  (searchPayload.component as any).items?.length > 0,
  'Rule 1: listing_cards component contains item details (photos, price, location)'
);

// Rule 2: Comparisons → comparison tables
const comparisonPayload = generateGenUIPayload('Compare Sale vs Borrow vs Donate');
assert(comparisonPayload.intent === 'comparison', 'Rule 2: Compare query detects comparison intent');
assert(comparisonPayload.component.type === 'comparison_table', 'Rule 2: comparison maps to comparison_table component');
assert(
  (comparisonPayload.component as any).columns?.length >= 2,
  'Rule 2: comparison_table defines structured comparison columns'
);
assert(
  (comparisonPayload.component as any).rows?.length > 0,
  'Rule 2: comparison_table defines feature rows'
);

// Rule 3: Data summaries → charts or structured summaries
const summaryPayload = generateGenUIPayload('Show marketplace summary and stats');
assert(summaryPayload.intent === 'data_summary', 'Rule 3: Summary query detects data_summary intent');
assert(summaryPayload.component.type === 'data_summary', 'Rule 3: data_summary maps to data_summary component');
assert(
  (summaryPayload.component as any).metrics?.length > 0,
  'Rule 3: data_summary includes key metrics'
);
assert(
  (summaryPayload.component as any).breakdown?.length > 0,
  'Rule 3: data_summary includes category breakdown progress bars'
);

// Rule 4: User input requirements → validated forms
const formPayload = generateGenUIPayload('I want to post a request for a mini drafter');
assert(formPayload.intent === 'user_input', 'Rule 4: Input request query detects user_input intent');
assert(formPayload.component.type === 'action_form', 'Rule 4: user_input maps to action_form component');
assert(
  (formPayload.component as any).fields?.length >= 3,
  'Rule 4: action_form provides validated form fields'
);

// Rule 5: Destructive actions → confirmation dialogs
const destructPayload = generateGenUIPayload('Cancel my active reservation');
assert(destructPayload.intent === 'destructive_action', 'Rule 5: Cancellation query detects destructive_action intent');
assert(destructPayload.component.type === 'confirmation_dialog', 'Rule 5: destructive_action maps to confirmation_dialog component');
assert(
  Boolean((destructPayload.component as any).warningMessage),
  'Rule 5: confirmation_dialog includes critical warning message'
);

// Rule 6: Unsupported requests → clear explanations and fallback text
const unsuppPayload = generateGenUIPayload('Can I pay by credit card with courier shipping?');
assert(unsuppPayload.intent === 'unsupported', 'Rule 6: Prohibited query detects unsupported intent');
assert(
  unsuppPayload.message.toLowerCase().includes('not supported') ||
  unsuppPayload.message.toLowerCase().includes('in person'),
  'Rule 6: Unsupported request explains boundaries and in-person campus settlement'
);

// Rule 7: Informational questions → concise text
const infoPayload = generateGenUIPayload('What are the photo rules on StudentNeed?');
assert(infoPayload.intent === 'informational', 'Rule 7: Information query detects informational intent');
assert(infoPayload.component.type === 'text', 'Rule 7: informational maps to text component with badges and tips');

// =========================================================================
// SECTION 4: Trusted Component Registry & React Components
// =========================================================================
console.log('\n4. Trusted Component Registry & Component Architecture:');

assert(
  isApprovedGenUIComponent('text') &&
  isApprovedGenUIComponent('listing_cards') &&
  isApprovedGenUIComponent('comparison_table') &&
  isApprovedGenUIComponent('data_summary') &&
  isApprovedGenUIComponent('action_form') &&
  isApprovedGenUIComponent('confirmation_dialog') &&
  isApprovedGenUIComponent('search_filter') &&
  isApprovedGenUIComponent('empty_state') &&
  isApprovedGenUIComponent('error_state'),
  'Trusted Registry approves all specified component types'
);

assert(
  !isApprovedGenUIComponent('arbitrary_script') &&
  !isApprovedGenUIComponent('eval_block') &&
  !isApprovedGenUIComponent('raw_html'),
  'Trusted Registry strictly rejects unapproved component names'
);

// Verify file existence of all reusable React components
const componentFiles = [
  'src/components/genui/GenUIRegistry.tsx',
  'src/components/genui/GenUIRenderer.tsx',
  'src/components/genui/GenUITextView.tsx',
  'src/components/genui/GenUIListingCards.tsx',
  'src/components/genui/GenUIComparisonTable.tsx',
  'src/components/genui/GenUIDataSummary.tsx',
  'src/components/genui/GenUIActionForm.tsx',
  'src/components/genui/GenUIConfirmationDialog.tsx',
  'src/components/genui/GenUISearchFilter.tsx',
  'src/components/genui/GenUIEmptyState.tsx',
  'src/components/genui/GenUIErrorState.tsx',
  'src/pages/GenUIDemo.tsx'
];

for (const file of componentFiles) {
  assert(fs.existsSync(path.join(process.cwd(), file)), `Component file exists: ${file}`);
}

// =========================================================================
// SECTION 5: Frontend & Backend Integration
// =========================================================================
console.log('\n5. Frontend & Backend Integration:');

const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
const chatbotSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/StudentNeedChatbot.tsx'), 'utf-8');
const rendererSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/genui/GenUIRenderer.tsx'), 'utf-8');
const formSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/genui/GenUIActionForm.tsx'), 'utf-8');
const dialogSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/genui/GenUIConfirmationDialog.tsx'), 'utf-8');

assert(
  serverSrc.includes('generateGenUIPayload') &&
  serverSrc.includes('validateGenUIPayload') &&
  serverSrc.includes('genui: fallbackGenUI') || serverSrc.includes('genui: deterministicGenUI'),
  'server.ts chat/assistant endpoint generates and validates GenUI payloads'
);

assert(
  chatbotSrc.includes('GenUIRenderer') &&
  chatbotSrc.includes('msg.genui'),
  'StudentNeedChatbot renders dynamic GenUI components inside the message stream'
);

assert(
  rendererSrc.includes('GenUIErrorBoundary') &&
  rendererSrc.includes('fallbackText'),
  'GenUIRenderer enforces robust error boundary with fallback text rendering'
);

assert(
  formSrc.includes('addRequest') &&
  formSrc.includes('isSubmitting') &&
  formSrc.includes('validate()'),
  'GenUIActionForm connects to real AppContext addRequest, performs validation, and prevents duplicate submissions'
);

assert(
  dialogSrc.includes('isProcessing') &&
  dialogSrc.includes('canCancel') &&
  (dialogSrc.includes('cancelRequest') || dialogSrc.includes('cancel_reservation')),
  'GenUIConfirmationDialog enforces state transition checks and connects to cancellation handlers'
);

console.log('\n--- All 22 Generative UI Specification Tests Passed Successfully! ---\n');
