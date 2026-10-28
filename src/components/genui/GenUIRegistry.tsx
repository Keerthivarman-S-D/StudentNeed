import React from 'react';
import { GenUIComponentType, GenUIComponentSpec } from '../../types/genui';
import { GenUITextView } from './GenUITextView';
import { GenUIListingCards } from './GenUIListingCards';
import { GenUIComparisonTable } from './GenUIComparisonTable';
import { GenUIDataSummary } from './GenUIDataSummary';
import { GenUIActionForm } from './GenUIActionForm';
import { GenUIConfirmationDialog } from './GenUIConfirmationDialog';
import { GenUISearchFilter } from './GenUISearchFilter';
import { GenUIEmptyState } from './GenUIEmptyState';
import { GenUIErrorState } from './GenUIErrorState';

export type GenUIComponentRenderer<T extends GenUIComponentSpec = any> = React.ComponentType<{
  spec: T;
  [key: string]: any;
}>;

/**
 * Trusted Component Registry
 * Maps validated component types strictly to pre-compiled, audited React components.
 * Arbitrary strings, scripts, or unapproved component names are NEVER rendered.
 */
export const GENUI_COMPONENT_REGISTRY: Record<GenUIComponentType, GenUIComponentRenderer> = {
  text: GenUITextView,
  listing_cards: GenUIListingCards,
  comparison_table: GenUIComparisonTable,
  data_summary: GenUIDataSummary,
  action_form: GenUIActionForm,
  confirmation_dialog: GenUIConfirmationDialog,
  search_filter: GenUISearchFilter,
  empty_state: GenUIEmptyState,
  error_state: GenUIErrorState
};

/**
 * Helper to test if a component type is registered in the trusted registry
 */
export function isApprovedGenUIComponent(type: string): type is GenUIComponentType {
  return Object.prototype.hasOwnProperty.call(GENUI_COMPONENT_REGISTRY, type);
}
