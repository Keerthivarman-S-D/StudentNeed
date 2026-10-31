import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface FormAlertProps {
  error?: string | null;
  success?: string | null;
  onDismiss?: () => void;
  className?: string;
}

export function FormAlert({ error, success, onDismiss, className = '' }: FormAlertProps) {
  if (!error && !success) return null;

  const isError = Boolean(error);
  const message = error || success;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className={`p-3 rounded-xl text-xs sm:text-sm font-medium border flex items-center justify-between gap-2.5 transition-all animate-in fade-in duration-150 ${
        isError
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-[#edf1ec] text-[#204b39] border-[#e0e6df]'
      } ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isError ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#204b39]" aria-hidden="true" />
        )}
        <span className="leading-snug break-words">{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-inherit opacity-70 hover:opacity-100 hover:bg-black/5 transition-opacity shrink-0 cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
