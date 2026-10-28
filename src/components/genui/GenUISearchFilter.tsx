import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowRight, RotateCcw } from 'lucide-react';
import { GenUISearchFilterComponent } from '../../types/genui';

interface GenUISearchFilterProps {
  spec: GenUISearchFilterComponent;
  onApplyFilters?: (filters: { query: string; category: string; type: string }) => void;
}

export function GenUISearchFilter({ spec, onApplyFilters }: GenUISearchFilterProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(spec.initialQuery || '');
  const [category, setCategory] = useState(spec.selectedCategory || 'All');
  const [type, setType] = useState(spec.selectedType || 'All');

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (onApplyFilters) {
      onApplyFilters({ query, category, type });
    } else {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'All') params.set('category', category);
      if (type !== 'All') params.set('type', type);
      navigate(`/marketplace?${params.toString()}`);
    }
  };

  const handleReset = () => {
    setQuery('');
    setCategory('All');
    setType('All');
  };

  return (
    <form
      onSubmit={handleApply}
      className="space-y-3 rounded-2xl border border-[#dedcd4] bg-white p-4 shadow-xs"
    >
      <div className="flex items-center justify-between border-b border-[#dedcd4]/60 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-xs text-[#252b27]">
          <Filter className="h-3.5 w-3.5 text-[#204b39]" />
          <span>Campus Search & Filters</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-[10px] text-[#717870] hover:text-[#252b27] flex items-center gap-0.5"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#717870]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search textbooks, calculators, drafters..."
          className="w-full rounded-lg border border-[#dedcd4] bg-[#faf9f5] pl-8 pr-3 py-1.5 text-xs text-[#252b27] placeholder:text-[#717870] focus:outline-hidden focus:ring-2 focus:ring-[#204b39] focus:bg-white transition"
        />
      </div>

      {/* Listing Type Pills */}
      <div className="space-y-1">
        <label className="block text-[10px] font-bold text-[#555d56] uppercase tracking-wider">
          Listing Type
        </label>
        <div className="flex flex-wrap gap-1">
          {['All', ...spec.availableTypes].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                type === t
                  ? 'bg-[#204b39] text-white shadow-2xs'
                  : 'bg-[#faf9f5] text-[#555d56] hover:bg-[#edf1ec] border border-[#dedcd4]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Category Dropdown */}
      <div className="space-y-1">
        <label className="block text-[10px] font-bold text-[#555d56] uppercase tracking-wider">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-[#dedcd4] bg-white px-2.5 py-1.5 text-xs text-[#252b27] focus:outline-hidden focus:ring-2 focus:ring-[#204b39]"
        >
          <option value="All">All Categories</option>
          {spec.availableCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <div className="pt-1">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#204b39] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#183a2c] active:scale-98"
        >
          <span>Apply to Marketplace</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </form>
  );
}
