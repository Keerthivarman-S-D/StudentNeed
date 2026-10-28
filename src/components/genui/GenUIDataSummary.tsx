import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart2, ShieldCheck, ArrowRight, Layers } from 'lucide-react';
import { GenUIDataSummaryComponent } from '../../types/genui';

interface GenUIDataSummaryProps {
  spec: GenUIDataSummaryComponent;
}

export function GenUIDataSummary({ spec }: GenUIDataSummaryProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3.5 rounded-2xl border border-[#dedcd4] bg-white p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#dedcd4]/60 pb-2.5">
        <div>
          <h4 className="text-sm font-bold text-[#252b27] tracking-tight">{spec.title}</h4>
          {spec.subtitle && (
            <p className="text-[11px] text-[#555d56] mt-0.5">{spec.subtitle}</p>
          )}
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf1ec] text-[#204b39]">
          <BarChart2 className="h-4 w-4" />
        </div>
      </div>

      {/* Metrics Counter Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {spec.metrics.map((metric, idx) => (
          <div
            key={idx}
            className="flex flex-col rounded-xl border border-[#dedcd4]/80 bg-[#faf9f5] p-2.5 transition hover:bg-[#f7f6f2]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#555d56] line-clamp-1">{metric.label}</span>
              {metric.badge && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                  {metric.badge}
                </span>
              )}
            </div>

            <div className="mt-1 text-base font-black text-[#204b39]">
              {metric.value}
            </div>

            {metric.subtext && (
              <span className="text-[9px] text-[#717870] mt-0.5">{metric.subtext}</span>
            )}
            {metric.change && (
              <span className="text-[9px] font-semibold text-emerald-700 mt-0.5 flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5" />
                {metric.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Category Breakdown Progress Bars */}
      {spec.breakdown && spec.breakdown.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[#dedcd4]/70 bg-zinc-50/50 p-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#252b27]">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#204b39]" />
              {spec.breakdownTitle || 'Distribution by Category'}
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {spec.breakdown.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium text-[#252b27]">{item.label}</span>
                  <span className="text-[#555d56] font-semibold">
                    {item.count} items ({item.percentage}%)
                  </span>
                </div>
                {/* Progress bar indicator */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#dedcd4]/60">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.colorHex || '#204b39'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Navigation Buttons */}
      {spec.quickActions && spec.quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {spec.quickActions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (action.url) navigate(action.url);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#dedcd4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#204b39] hover:bg-[#edf1ec] transition active:scale-95 shadow-2xs"
            >
              <span>{action.label}</span>
              <ArrowRight className="h-2.5 w-2.5 text-[#204b39]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
