import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { GenUIErrorStateComponent } from '../../types/genui';

interface GenUIErrorStateProps {
  spec: GenUIErrorStateComponent;
  onRetry?: () => void;
}

export function GenUIErrorState({ spec, onRetry }: GenUIErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-center space-y-2">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700">
        <AlertOctagon className="h-5 w-5" />
      </div>

      <div className="space-y-0.5">
        <h5 className="text-xs font-bold text-red-900">{spec.title || 'Generation Notice'}</h5>
        <p className="text-[11px] text-red-800 leading-relaxed max-w-sm mx-auto">
          {spec.message}
        </p>
      </div>

      {spec.canRetry && onRetry && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 transition shadow-2xs"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  );
}
