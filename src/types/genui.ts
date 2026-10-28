import { Category, Condition, ListingType, CampusMeetupLocation } from '../types';

/**
 * 7 Defined User Intents according to the Generative UI Specification:
 * - informational: Informational questions → concise text
 * - item_search: Item searches → listing cards with relevant details
 * - comparison: Comparisons → comparison tables
 * - data_summary: Data summaries → charts or structured summaries
 * - user_input: User input requirements → validated forms
 * - destructive_action: Destructive actions → confirmation dialogs
 * - unsupported: Unsupported requests → clear explanations and fallback text
 */
export type GenUIIntent =
  | 'informational'
  | 'item_search'
  | 'comparison'
  | 'data_summary'
  | 'user_input'
  | 'destructive_action'
  | 'unsupported';

/**
 * Approved UI Component Types in the Trusted Registry
 */
export type GenUIComponentType =
  | 'text'
  | 'listing_cards'
  | 'comparison_table'
  | 'data_summary'
  | 'action_form'
  | 'confirmation_dialog'
  | 'search_filter'
  | 'empty_state'
  | 'error_state';

// 1. Text Component
export interface GenUITextComponent {
  type: 'text';
  headline?: string;
  body: string;
  badges?: Array<{
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'info';
  }>;
  tips?: string[];
  actionLinks?: Array<{
    label: string;
    url: string;
  }>;
}

// 2. Listing Cards Component
export interface GenUIListingCardItem {
  id: string;
  title: string;
  price?: number;
  type: ListingType;
  category: Category;
  condition?: Condition;
  location: string;
  images?: string[];
  sellerName?: string;
  isSaved?: boolean;
}

export interface GenUIListingCardsComponent {
  type: 'listing_cards';
  title?: string;
  query?: string;
  category?: Category;
  items: GenUIListingCardItem[];
  totalMatches: number;
  emptyFallbackText?: string;
  ctaAction?: {
    label: string;
    url: string;
  };
}

// 3. Comparison Table Component
export interface GenUIComparisonColumn {
  key: string;
  label: string;
  highlight?: boolean;
  badge?: string;
}

export interface GenUIComparisonRow {
  feature: string;
  description?: string;
  values: Record<string, string | boolean | number>;
}

export interface GenUIComparisonTableComponent {
  type: 'comparison_table';
  title: string;
  subtitle?: string;
  columns: GenUIComparisonColumn[];
  rows: GenUIComparisonRow[];
  recommendation?: string;
}

// 4. Data Summary Component
export interface GenUIMetricItem {
  label: string;
  value: string | number;
  change?: string;
  badge?: string;
  subtext?: string;
}

export interface GenUIProgressItem {
  label: string;
  count: number;
  percentage: number;
  colorHex?: string;
}

export interface GenUIDataSummaryComponent {
  type: 'data_summary';
  title: string;
  subtitle?: string;
  metrics: GenUIMetricItem[];
  breakdownTitle?: string;
  breakdown?: GenUIProgressItem[];
  quickActions?: Array<{
    label: string;
    actionType: string;
    payload?: any;
    url?: string;
  }>;
}

// 5. Action Form Component (User Input)
export type GenUIFormFieldType = 'text' | 'textarea' | 'select' | 'number';

export interface GenUIFormField {
  name: string;
  label: string;
  type: GenUIFormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string | number;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  helpText?: string;
}

export interface GenUIActionFormComponent {
  type: 'action_form';
  formId: string;
  title: string;
  description?: string;
  fields: GenUIFormField[];
  submitButtonText: string;
  actionEndpoint?: string;
  successMessage?: string;
  targetEntity?: 'request' | 'listing_filter' | 'inquiry';
}

// 6. Confirmation Dialog Component (Destructive Action)
export interface GenUIConfirmationDialogComponent {
  type: 'confirmation_dialog';
  dialogId: string;
  title: string;
  warningMessage: string;
  itemDetails: {
    id: string;
    title: string;
    currentStatus: string;
    type?: string;
  };
  confirmButtonText: string;
  cancelButtonText: string;
  actionType: 'cancel_reservation' | 'cancel_request' | 'delete_listing';
  requiresReason?: boolean;
  reasonOptions?: string[];
}

// 7. Search & Filter Component
export interface GenUISearchFilterComponent {
  type: 'search_filter';
  initialQuery?: string;
  selectedCategory?: string;
  selectedType?: string;
  availableCategories: string[];
  availableTypes: string[];
  maxPriceLimit?: number;
}

// 8. Empty State Component
export interface GenUIEmptyStateComponent {
  type: 'empty_state';
  title: string;
  message: string;
  suggestedAction?: {
    label: string;
    url: string;
  };
}

// 9. Error State Component
export interface GenUIErrorStateComponent {
  type: 'error_state';
  title: string;
  message: string;
  canRetry?: boolean;
}

/**
 * Union of all approved UI component specifications
 */
export type GenUIComponentSpec =
  | GenUITextComponent
  | GenUIListingCardsComponent
  | GenUIComparisonTableComponent
  | GenUIDataSummaryComponent
  | GenUIActionFormComponent
  | GenUIConfirmationDialogComponent
  | GenUISearchFilterComponent
  | GenUIEmptyStateComponent
  | GenUIErrorStateComponent;

/**
 * Validated GenUI Payload received from the AI or backend
 */
export interface GenUIPayload {
  intent: GenUIIntent;
  message: string; // Mandatory text fallback for accessibility & reliability
  component: GenUIComponentSpec;
  suggestions?: string[];
  timestamp?: string;
}

/**
 * Extended Chat message item with GenUI support
 */
export interface GenUIChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: 'ai' | 'knowledge_base' | 'user';
  genui?: GenUIPayload;
  error?: string;
}
