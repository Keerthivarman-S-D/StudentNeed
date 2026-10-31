import {
  GenUIIntent,
  GenUIComponentType,
  GenUIPayload,
  GenUIComponentSpec
} from '../types/genui';

const VALID_INTENTS: Set<GenUIIntent> = new Set([
  'informational',
  'item_search',
  'comparison',
  'data_summary',
  'user_input',
  'destructive_action',
  'unsupported'
]);

const VALID_COMPONENT_TYPES: Set<GenUIComponentType> = new Set([
  'text',
  'listing_cards',
  'comparison_table',
  'data_summary',
  'action_form',
  'confirmation_dialog',
  'search_filter',
  'empty_state',
  'error_state'
]);

export interface ValidationResult {
  valid: boolean;
  sanitizedPayload?: GenUIPayload;
  error?: string;
}

/**
 * Sanitizes strings to prevent raw script injections or unsafe links
 */
function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Strict schema validator for model-generated or server-generated GenUI payloads.
 * Protects frontend by rejecting invalid structures, missing fields, or unsafe strings.
 */
export function validateGenUIPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'Payload must be a non-null JSON object.' };
  }

  const raw = payload as Record<string, any>;

  // 1. Validate intent
  if (!raw.intent || typeof raw.intent !== 'string' || !VALID_INTENTS.has(raw.intent as GenUIIntent)) {
    return {
      valid: false,
      error: `Invalid or missing intent. Must be one of: ${Array.from(VALID_INTENTS).join(', ')}`
    };
  }

  // 2. Validate fallback message (critical for reliability)
  const message = typeof raw.message === 'string' ? sanitizeString(raw.message) : '';
  if (!message) {
    return { valid: false, error: 'Payload must provide a non-empty text message fallback.' };
  }

  // 3. Validate component object
  if (!raw.component || typeof raw.component !== 'object' || Array.isArray(raw.component)) {
    return { valid: false, error: 'Payload missing valid component specification object.' };
  }

  const comp = raw.component as Record<string, any>;
  const compType = comp.type as GenUIComponentType;

  if (!compType || typeof compType !== 'string' || !VALID_COMPONENT_TYPES.has(compType)) {
    return {
      valid: false,
      error: `Invalid component type "${compType}". Must be one of: ${Array.from(VALID_COMPONENT_TYPES).join(', ')}`
    };
  }

  // 4. Validate component-specific schema
  switch (compType) {
    case 'text': {
      if (typeof comp.body !== 'string' || !comp.body.trim()) {
        return { valid: false, error: 'Text component requires a non-empty body string.' };
      }
      break;
    }

    case 'listing_cards': {
      if (!Array.isArray(comp.items)) {
        return { valid: false, error: 'Listing cards component requires an "items" array.' };
      }
      for (const item of comp.items) {
        if (!item || typeof item !== 'object') {
          return { valid: false, error: 'Each listing card item must be a valid object.' };
        }
        if (!item.id || typeof item.id !== 'string') {
          return { valid: false, error: 'Listing item requires a valid "id" string.' };
        }
        if (!item.title || typeof item.title !== 'string') {
          return { valid: false, error: 'Listing item requires a valid "title" string.' };
        }
        if (!item.type || typeof item.type !== 'string') {
          return { valid: false, error: 'Listing item requires a valid "type" string.' };
        }
      }
      break;
    }

    case 'comparison_table': {
      if (!comp.title || typeof comp.title !== 'string') {
        return { valid: false, error: 'Comparison table requires a valid "title".' };
      }
      if (!Array.isArray(comp.columns) || comp.columns.length < 2) {
        return { valid: false, error: 'Comparison table requires at least 2 columns.' };
      }
      for (const col of comp.columns) {
        if (!col || typeof col.key !== 'string' || typeof col.label !== 'string') {
          return { valid: false, error: 'Each column must define "key" and "label".' };
        }
      }
      if (!Array.isArray(comp.rows) || comp.rows.length === 0) {
        return { valid: false, error: 'Comparison table requires a non-empty "rows" array.' };
      }
      for (const row of comp.rows) {
        if (!row || typeof row.feature !== 'string' || typeof row.values !== 'object') {
          return { valid: false, error: 'Each row must define "feature" and a "values" map.' };
        }
      }
      break;
    }

    case 'data_summary': {
      if (!comp.title || typeof comp.title !== 'string') {
        return { valid: false, error: 'Data summary component requires a valid "title".' };
      }
      if (!Array.isArray(comp.metrics) || comp.metrics.length === 0) {
        return { valid: false, error: 'Data summary requires a non-empty "metrics" array.' };
      }
      for (const m of comp.metrics) {
        if (!m || typeof m.label !== 'string' || (typeof m.value !== 'string' && typeof m.value !== 'number')) {
          return { valid: false, error: 'Each metric must have a "label" and "value".' };
        }
      }
      break;
    }

    case 'action_form': {
      if (!comp.formId || typeof comp.formId !== 'string') {
        return { valid: false, error: 'Action form requires a valid "formId".' };
      }
      if (!comp.title || typeof comp.title !== 'string') {
        return { valid: false, error: 'Action form requires a valid "title".' };
      }
      if (!Array.isArray(comp.fields) || comp.fields.length === 0) {
        return { valid: false, error: 'Action form requires at least one field.' };
      }
      for (const field of comp.fields) {
        if (!field || typeof field.name !== 'string' || typeof field.label !== 'string' || typeof field.type !== 'string') {
          return { valid: false, error: 'Each field must have "name", "label", and "type".' };
        }
      }
      break;
    }

    case 'confirmation_dialog': {
      if (!comp.dialogId || typeof comp.dialogId !== 'string') {
        return { valid: false, error: 'Confirmation dialog requires a valid "dialogId".' };
      }
      if (!comp.title || typeof comp.title !== 'string') {
        return { valid: false, error: 'Confirmation dialog requires a valid "title".' };
      }
      if (!comp.warningMessage || typeof comp.warningMessage !== 'string') {
        return { valid: false, error: 'Confirmation dialog requires a "warningMessage".' };
      }
      if (!comp.itemDetails || typeof comp.itemDetails !== 'object' || !comp.itemDetails.id || !comp.itemDetails.title) {
        return { valid: false, error: 'Confirmation dialog requires "itemDetails" with id and title.' };
      }
      if (!comp.actionType || typeof comp.actionType !== 'string') {
        return { valid: false, error: 'Confirmation dialog requires an "actionType".' };
      }
      break;
    }

    case 'search_filter': {
      if (!Array.isArray(comp.availableCategories) || !Array.isArray(comp.availableTypes)) {
        return { valid: false, error: 'Search filter requires availableCategories and availableTypes arrays.' };
      }
      break;
    }

    case 'empty_state':
    case 'error_state': {
      if (!comp.title || typeof comp.title !== 'string' || !comp.message || typeof comp.message !== 'string') {
        return { valid: false, error: `${compType} requires "title" and "message" strings.` };
      }
      break;
    }
  }

  // 5. Construct sanitized safe payload
  const sanitizedPayload: GenUIPayload = {
    intent: raw.intent as GenUIIntent,
    message,
    component: comp as GenUIComponentSpec,
    suggestions: Array.isArray(raw.suggestions)
      ? raw.suggestions.map((s: unknown) => sanitizeString(s)).filter(Boolean)
      : undefined,
    timestamp: raw.timestamp ? sanitizeString(raw.timestamp) : new Date().toISOString()
  };

  return {
    valid: true,
    sanitizedPayload
  };
}
