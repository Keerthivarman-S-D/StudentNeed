import React, { Component, ErrorInfo, ReactNode } from 'react';
import { GenUIPayload } from '../../types/genui';
import { validateGenUIPayload } from '../../lib/genuiValidator';
import { GENUI_COMPONENT_REGISTRY, isApprovedGenUIComponent } from './GenUIRegistry';

interface ErrorBoundaryProps {
  fallbackText: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Robust Error Boundary: If a structured component encounters an unexpected runtime error,
 * catch it gracefully and render the fallback text message.
 */
class GenUIErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[GenUI ErrorBoundary Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-[#dedcd4] bg-white p-3.5 text-xs text-[#252b27] space-y-1.5">
          <p className="leading-relaxed whitespace-pre-wrap">{this.props.fallbackText}</p>
          <span className="text-[10px] text-[#555d56] italic">
            (Structured view unavailable; displayed verified text fallback)
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

interface GenUIRendererProps {
  payload?: GenUIPayload | unknown;
  fallbackText?: string;
  onSuccess?: (...args: any[]) => void;
  onDismiss?: () => void;
}

/**
 * GenUIRenderer: Strict Security & Runtime Validation Pipeline
 * 1. Checks payload validity with validateGenUIPayload()
 * 2. If invalid or malicious, drops structured rendering and shows safe fallback text
 * 3. Resolves component from trusted GENUI_COMPONENT_REGISTRY
 * 4. Protects with ErrorBoundary against unexpected exceptions
 */
export function GenUIRenderer({ payload, fallbackText, onSuccess, onDismiss }: GenUIRendererProps) {
  // If no payload was provided, render plain text fallback if present
  if (!payload) {
    if (!fallbackText) return null;
    return <p className="text-xs text-[#252b27] whitespace-pre-wrap">{fallbackText}</p>;
  }

  // 1. Strict Schema Validation
  const validation = validateGenUIPayload(payload);

  if (!validation.valid || !validation.sanitizedPayload) {
    console.warn('[GenUI Schema Validation Warning]:', validation.error);
    const safeText = fallbackText || (payload as any)?.message || 'Information is currently unavailable.';
    return (
      <div className="text-xs text-[#252b27] space-y-1">
        <p className="whitespace-pre-wrap leading-relaxed">{safeText}</p>
      </div>
    );
  }

  const { sanitizedPayload } = validation;
  const compSpec = sanitizedPayload.component;

  // 2. Check Trusted Registry
  if (!isApprovedGenUIComponent(compSpec.type)) {
    console.warn(`[GenUI Security Notice]: Unapproved component type "${(compSpec as any)?.type}". Dropping to text fallback.`);
    return <p className="text-xs text-[#252b27] whitespace-pre-wrap">{sanitizedPayload.message}</p>;
  }

  const ComponentToRender = GENUI_COMPONENT_REGISTRY[compSpec.type];

  // 3. Render inside ErrorBoundary
  return (
    <GenUIErrorBoundary fallbackText={sanitizedPayload.message}>
      <div className="genui-component-wrapper mt-2 mb-1 animate-in fade-in duration-200">
        <ComponentToRender
          spec={compSpec}
          onSuccess={onSuccess}
          onDismiss={onDismiss}
        />
      </div>
    </GenUIErrorBoundary>
  );
}
