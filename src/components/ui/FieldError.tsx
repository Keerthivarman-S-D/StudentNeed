import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  error?: string | null;
  id?: string;
  className?: string;
}

export function FieldError({ error, id, className = '' }: FieldErrorProps) {
  if (!error) return null;

  return (
    <p
      id={id}
      role="alert"
      className={`mt-1 text-xs text-red-600 font-medium flex items-center gap-1 animate-in fade-in duration-150 ${className}`}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
      <span>{error}</span>
    </p>
  );
}
