import React from 'react';
import { Check, X, Award, HelpCircle } from 'lucide-react';
import { GenUIComparisonTableComponent } from '../../types/genui';

interface GenUIComparisonTableProps {
  spec: GenUIComparisonTableComponent;
}

export function GenUIComparisonTable({ spec }: GenUIComparisonTableProps) {
  const renderValue = (val: string | boolean | number) => {
    if (typeof val === 'boolean') {
      return val ? (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-800">
          <Check className="h-3 w-3" />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-800">
          <X className="h-3 w-3" />
        </span>
      );
    }
    return <span className="text-xs text-[#252b27] font-medium leading-tight">{String(val)}</span>;
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#dedcd4] bg-white p-4 shadow-xs overflow-hidden">
      {/* Title & Subtitle */}
      <div>
        <h4 className="text-sm font-bold text-[#252b27] tracking-tight">{spec.title}</h4>
        {spec.subtitle && (
          <p className="text-[11px] text-[#555d56] mt-0.5">{spec.subtitle}</p>
        )}
      </div>

      {/* Responsive Table Wrapper */}
      <div className="overflow-x-auto rounded-xl border border-[#dedcd4] bg-[#faf9f5]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#dedcd4] bg-[#f7f6f2]">
              <th className="p-2.5 font-bold text-[#555d56] text-[11px] uppercase tracking-wider min-w-[110px]">
                Feature
              </th>
              {spec.columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-2.5 font-bold text-xs min-w-[130px] ${
                    col.highlight
                      ? 'bg-[#edf1ec] text-[#204b39] border-x border-[#dedcd4]/80'
                      : 'text-[#252b27]'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{col.label}</span>
                    {col.badge && (
                      <span className={`inline-block w-fit rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${
                        col.highlight ? 'bg-[#204b39] text-white' : 'bg-[#dedcd4] text-[#555d56]'
                      }`}>
                        {col.badge}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dedcd4]/70 bg-white">
            {spec.rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-[#faf9f5]' : 'bg-white'}>
                <td className="p-2.5 text-[11px] font-semibold text-[#555d56] align-top bg-zinc-50/50">
                  {row.feature}
                </td>
                {spec.columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-2.5 align-top ${
                      col.highlight ? 'bg-[#edf1ec]/40 border-x border-[#dedcd4]/60' : ''
                    }`}
                  >
                    {renderValue(row.values[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recommendation Callout */}
      {spec.recommendation && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-[11px]">
          <Award className="h-4 w-4 text-[#204b39] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-[#204b39]">Recommendation</span>
            <p className="text-emerald-900 leading-relaxed">{spec.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
