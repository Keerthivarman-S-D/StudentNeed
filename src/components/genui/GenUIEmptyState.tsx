import React from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ArrowRight } from 'lucide-react';
import { GenUIEmptyStateComponent } from '../../types/genui';

interface GenUIEmptyStateProps {
  spec: GenUIEmptyStateComponent;
}

export function GenUIEmptyState({ spec }: GenUIEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#dedcd4] bg-[#faf9f5] p-6 text-center space-y-2.5">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#edf1ec] text-[#204b39]">
        <Inbox className="h-5 w-5 opacity-80" />
      </div>

      <div className="space-y-1">
        <h5 className="text-xs font-bold text-[#252b27]">{spec.title}</h5>
        <p className="text-[11px] text-[#555d56] max-w-xs mx-auto leading-relaxed">
          {spec.message}
        </p>
      </div>

      {spec.suggestedAction && (
        <div className="pt-1">
          <Link
            to={spec.suggestedAction.url}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#204b39] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#183a2c] transition shadow-2xs"
          >
            <span>{spec.suggestedAction.label}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
