import React from 'react';
import { Link } from 'react-router-dom';
import { Info, CheckCircle2, AlertTriangle, ArrowRight, Lightbulb } from 'lucide-react';
import { GenUITextComponent } from '../../types/genui';

interface GenUITextViewProps {
  spec: GenUITextComponent;
}

export function GenUITextView({ spec }: GenUITextViewProps) {
  const renderFormattedBody = (content: string) => {
    return content.split('\n').map((line, idx) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <React.Fragment key={idx}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-semibold text-[#252b27]">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
          {idx < content.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#dedcd4] bg-white p-4 shadow-xs">
      {/* Optional Headline */}
      {spec.headline && (
        <div className="flex items-center gap-2 border-b border-[#dedcd4]/60 pb-2.5">
          <Info className="h-4 w-4 text-[#204b39] shrink-0" />
          <h4 className="text-sm font-bold text-[#252b27] tracking-tight">{spec.headline}</h4>
        </div>
      )}

      {/* Badges */}
      {spec.badges && spec.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {spec.badges.map((b, i) => {
            let badgeStyle = "bg-[#edf1ec] text-[#204b39] border-[#204b39]/20";
            if (b.variant === 'warning') badgeStyle = "bg-amber-50 text-amber-800 border-amber-200";
            if (b.variant === 'success') badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
            if (b.variant === 'info') badgeStyle = "bg-blue-50 text-blue-800 border-blue-200";

            return (
              <span
                key={i}
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeStyle}`}
              >
                {b.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Body Content */}
      <div className="text-xs leading-relaxed text-[#404642] whitespace-pre-wrap">
        {renderFormattedBody(spec.body)}
      </div>

      {/* Tips */}
      {spec.tips && spec.tips.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-emerald-700" />
            <span>Campus Tip</span>
          </div>
          <ul className="space-y-1 text-emerald-800 pl-4 list-disc">
            {spec.tips.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Links */}
      {spec.actionLinks && spec.actionLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-[#dedcd4]/50">
          {spec.actionLinks.map((link, idx) => (
            <Link
              key={idx}
              to={link.url}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#204b39] hover:text-[#183a2c] hover:underline transition"
            >
              <span>{link.label}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
