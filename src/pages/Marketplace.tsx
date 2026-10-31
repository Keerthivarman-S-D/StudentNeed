import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  AlertCircle,
  X,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { ActiveListingType, Category } from '../types';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ListingCard } from '../components/ListingCard';
import { ListingCardSkeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/utils';

export function Marketplace() {
  const { listings, listingsLoading, listingsError, hasMoreListings, isLoadingMoreListings, loadMoreListings } = useAppContext();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial parameters from URL
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = (searchParams.get('category') as Category) || 'All';

  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>(initialCategory);
  const [selectedType, setSelectedType] = useState<ActiveListingType | 'All'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');

  // Mobile filter drawer state & accessibility ref
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const mobileFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerCloseRef = useRef<HTMLButtonElement>(null);

  // 300ms debounce for search query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Synchronize internal state when URL changes externally
  useEffect(() => {
    const qFromUrl = searchParams.get('q') || '';
    const catFromUrl = (searchParams.get('category') as Category) || 'All';

    if (qFromUrl !== search) {
      setSearch(qFromUrl);
      setDebouncedSearch(qFromUrl);
    }
    if (catFromUrl !== selectedCategory) {
      setSelectedCategory(catFromUrl);
    }
  }, [searchParams]);

  // Synchronize URL search params when debounced search or category changes
  useEffect(() => {
    const currentQ = searchParams.get('q') || '';
    const currentCat = searchParams.get('category') || 'All';
    const newQ = debouncedSearch.trim();
    const newCat = selectedCategory;

    if (currentQ !== newQ || currentCat !== newCat) {
      const nextParams = new URLSearchParams(searchParams);
      if (newQ) {
        nextParams.set('q', newQ);
      } else {
        nextParams.delete('q');
      }
      if (newCat && newCat !== 'All') {
        nextParams.set('category', newCat);
      } else {
        nextParams.delete('category');
      }

      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [debouncedSearch, selectedCategory, searchParams, setSearchParams]);

  // Lock background scroll when mobile filter sheet is open
  useEffect(() => {
    if (showMobileFilters) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setTimeout(() => mobileDrawerCloseRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCloseMobileFilters();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showMobileFilters]);

  const handleCloseMobileFilters = () => {
    setShowMobileFilters(false);
    setTimeout(() => mobileFilterTriggerRef.current?.focus(), 50);
  };

  const types: (ActiveListingType | 'All')[] = ['All', 'Sale', 'Donate', 'Exchange'];

  const categories: (Category | 'All')[] = [
    'All',
    'Textbooks',
    'Electronics',
    'Stationery',
    'Lab Essentials',
    'Hostel Essentials',
    'Sports',
    'College Wear',
    'Other'
  ];

  // Filter and sort listings without mutating state
  const filteredListings = useMemo(() => {
    const now = Date.now();
    let result = listings.filter(l =>
      (l.status === 'active' || l.status === 'available' || l.status === 'reserved') &&
      Boolean(l.expiresAt) &&
      new Date(l.expiresAt).getTime() > now
    );

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        (l.location && l.location.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter(l => l.category === selectedCategory);
    }

    if (selectedType !== 'All') {
      result = result.filter(l => l.type === selectedType);
    }

    const sorted = [...result];
    switch (sortBy) {
      case 'price_low':
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_high':
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return sorted;
  }, [listings, debouncedSearch, selectedCategory, selectedType, sortBy]);

  // Active filter state
  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || selectedCategory !== 'All' || selectedType !== 'All'
  );

  const activeFilterCount =
    (selectedCategory !== 'All' ? 1 : 0) +
    (selectedType !== 'All' ? 1 : 0) +
    (debouncedSearch.trim() ? 1 : 0);

  const handleClearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedCategory('All');
    setSelectedType('All');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('q');
    nextParams.delete('category');
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#252b27]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Page Title & Subtitle */}
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
            Campus Marketplace
          </h1>
          <p className="text-sm sm:text-base text-[#555d56]">
            Discover, buy, borrow, or swap essentials with verified peers across MIT campus.
          </p>
        </div>

        {/* Campus Verification Banner for Logged-Out Users */}
        {!currentUser && (
          <div className="mb-8 rounded-2xl bg-[#204b39] p-6 sm:p-8 text-white shadow-xs">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl space-y-2">
                <div className="text-xs font-semibold text-[#a3c9b8] tracking-wide">
                  Anna University Verified Network
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Access exclusive campus listings &amp; student exchanges
                </h2>
                <p className="text-sm text-[#d2ded8] leading-relaxed">
                  Sign in with your verified @student.annauniv.edu email to reserve items, chat directly with peers, and coordinate secure campus meetups.
                </p>
              </div>
              <div className="shrink-0">
                <Link to="/login">
                  <button
                    type="button"
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#204b39] shadow-xs hover:bg-[#edf1ec] transition-colors cursor-pointer"
                  >
                    Sign In with Student Email
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Top Controls: Search Field and Sorting Control */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end">
          {/* Search field */}
          <div className="sm:col-span-8 lg:col-span-9 flex flex-col gap-1.5">
            <label htmlFor="marketplace-search" className="text-xs font-semibold text-[#252b27]">
              Search campus marketplace
            </label>
            <div className="relative">
              <input
                id="marketplace-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items, textbooks, equipment, calculators..."
                className="h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-4 pr-10 text-sm text-[#252b27] placeholder:text-[#8a918a] outline-none transition-colors focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]"
                aria-label="Search campus marketplace"
              />
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#555d56] hover:text-[#252b27] hover:bg-zinc-100 transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Sort listings */}
          <div className="sm:col-span-4 lg:col-span-3 flex flex-col gap-1.5">
            <label htmlFor="marketplace-sort" className="text-xs font-semibold text-[#252b27]">
              Sort listings
            </label>
            <div className="relative">
              <select
                id="marketplace-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-11 w-full appearance-none rounded-xl border border-[#dedcd4] bg-white pl-4 pr-10 text-sm font-medium text-[#252b27] outline-none transition-colors focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39] cursor-pointer"
                aria-label="Sort listings"
              >
                <option value="newest">Newest first</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555d56]" />
            </div>
          </div>
        </div>

        {/* Mobile Filters Trigger Bar */}
        <div className="md:hidden flex items-center justify-between mb-4">
          <button
            ref={mobileFilterTriggerRef}
            type="button"
            onClick={() => setShowMobileFilters(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dedcd4] bg-white px-4 py-2 text-sm font-semibold text-[#252b27] hover:border-[#204b39] cursor-pointer"
            aria-expanded={showMobileFilters}
            aria-label={`Open filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4 text-[#204b39]" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#204b39] text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs font-medium text-[#204b39] hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Main Content Layout: Left Sidebar + Two-Column Product Grid */}
        <div className="flex flex-col md:flex-row md:items-start gap-6">

          {/* Desktop Left Sidebar Filters */}
          <aside
            className="hidden md:block w-56 shrink-0 rounded-2xl border border-[#dedcd4] bg-white p-5 shadow-none"
            aria-label="Marketplace filters"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#252b27]">
                Filters
              </h2>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-medium text-[#204b39] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Listing Type Filter */}
            <div className="mb-6">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#555d56] mb-2.5">
                LISTING TYPE
              </h3>
              <div className="flex flex-col gap-2">
                {types.map((type) => {
                  const isSelected = selectedType === type;
                  const label = type === 'Sale' ? 'For Sale' : type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedType(isSelected && type !== 'All' ? 'All' : type)}
                      className={cn(
                        "w-fit rounded-full px-3.5 py-1 text-xs font-medium transition-all text-left cursor-pointer",
                        isSelected
                          ? "bg-[#edf1ec] text-[#204b39] border border-[#204b39]/40 font-semibold"
                          : "bg-white text-[#555d56] border border-[#dedcd4] hover:border-zinc-400 hover:text-[#252b27]"
                      )}
                      aria-pressed={isSelected}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#555d56] mb-2.5">
                CATEGORY
              </h3>
              <div className="flex flex-col gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(isSelected && cat !== 'All' ? 'All' : cat)}
                      className={cn(
                        "w-fit rounded-full px-3.5 py-1 text-xs font-medium transition-all text-left cursor-pointer",
                        isSelected
                          ? "bg-[#edf1ec] text-[#204b39] border border-[#204b39]/40 font-semibold"
                          : "bg-white text-[#555d56] border border-[#dedcd4] hover:border-zinc-400 hover:text-[#252b27]"
                      )}
                      aria-pressed={isSelected}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right Column: Available Items Area */}
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#252b27]">
                Available Items
              </h2>
            </div>

            {/* Loading Skeletons */}
            {listingsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <ListingCardSkeleton />
                <ListingCardSkeleton />
                <ListingCardSkeleton />
                <ListingCardSkeleton />
              </div>
            ) : listingsError ? (
              /* Error State */
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center max-w-lg mx-auto">
                <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-[#252b27] mb-1">Could not load campus listings</h3>
                <p className="text-sm text-[#555d56] max-w-md mx-auto mb-4">{listingsError}</p>
                {!currentUser && (
                  <Link to="/login">
                    <button
                      type="button"
                      className="rounded-xl bg-[#204b39] px-4 py-2 text-sm font-semibold text-white hover:bg-[#183a2c] cursor-pointer"
                    >
                      Sign In to Access
                    </button>
                  </Link>
                )}
              </div>
            ) : filteredListings.length > 0 ? (
              /* Two-Column Product Grid */
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {filteredListings.map(listing => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>

                {isLoadingMoreListings && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-5">
                    <ListingCardSkeleton />
                    <ListingCardSkeleton />
                  </div>
                )}

                {hasMoreListings && (
                  <div className="flex justify-center pt-4 pb-6">
                    <button
                      type="button"
                      onClick={loadMoreListings}
                      disabled={isLoadingMoreListings}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#dedcd4] bg-white px-8 py-2.5 text-sm font-semibold text-[#252b27] hover:border-[#204b39] hover:text-[#204b39] transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                    >
                      {isLoadingMoreListings ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-[#204b39]" />
                          <span>Loading more listings...</span>
                        </>
                      ) : (
                        <span>Load More Listings</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedcd4] bg-white py-16 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] mb-4">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-[#252b27]">No campus items found</h3>
                <p className="text-sm text-[#555d56] mt-1 max-w-md">
                  {listings.length === 0
                    ? "There are no campus listings yet. Be the first student to post an item!"
                    : "We couldn't find any items matching your active search or filters."}
                </p>
                {listings.length === 0 ? (
                  <Link to="/create-listing" className="mt-5">
                    <button
                      type="button"
                      className="rounded-xl bg-[#204b39] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#183a2c] cursor-pointer"
                    >
                      Post Item
                    </button>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="mt-5 rounded-xl border border-[#dedcd4] bg-white px-5 py-2 text-sm font-semibold text-[#204b39] hover:border-[#204b39] cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 pb-12 text-xs text-[#555d56]">
          StudentNeed · MIT Campus, Anna University · Campus meetups only
        </footer>

      </div>

      {/* Accessible Mobile Filter Drawer */}
      {showMobileFilters && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filter-heading"
        >
          <div
            className="fixed inset-0"
            onClick={handleCloseMobileFilters}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-xl border border-[#dedcd4] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#dedcd4]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4.5 w-4.5 text-[#204b39]" />
                <h3 id="mobile-filter-heading" className="text-base font-bold text-[#252b27]">
                  Filter Listings
                </h3>
              </div>
              <button
                ref={mobileDrawerCloseRef}
                type="button"
                onClick={handleCloseMobileFilters}
                className="rounded-full p-1.5 text-[#555d56] hover:text-[#252b27] hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Filter Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Type Filter */}
              <div>
                <h4 className="font-bold text-xs text-[#555d56] uppercase tracking-wider mb-3">
                  Listing Type
                </h4>
                <div className="flex flex-wrap gap-2">
                  {types.map((type) => {
                    const isSelected = selectedType === type;
                    const label = type === 'Sale' ? 'For Sale' : type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedType(isSelected && type !== 'All' ? 'All' : type)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all text-left cursor-pointer",
                          isSelected
                            ? "bg-[#edf1ec] text-[#204b39] border-[#204b39]/40 font-semibold shadow-2xs"
                            : "bg-white text-[#555d56] border-[#dedcd4] hover:bg-zinc-50"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <h4 className="font-bold text-xs text-[#555d56] uppercase tracking-wider mb-3">
                  Category
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(isSelected && cat !== 'All' ? 'All' : cat)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all text-left cursor-pointer",
                          isSelected
                            ? "bg-[#edf1ec] text-[#204b39] border-[#204b39]/40 font-semibold shadow-2xs"
                            : "bg-white text-[#555d56] border-[#dedcd4] hover:bg-zinc-50"
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#f7f6f2] border-t border-[#dedcd4] flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="flex-1 rounded-xl border border-[#dedcd4] bg-white py-2.5 text-xs font-semibold text-[#252b27] hover:border-zinc-400 cursor-pointer"
                >
                  Reset All
                </button>
              )}
              <button
                type="button"
                onClick={handleCloseMobileFilters}
                className="flex-1 rounded-xl bg-[#204b39] py-2.5 text-xs font-bold text-white hover:bg-[#183a2c] shadow-xs cursor-pointer"
              >
                Apply Filters ({filteredListings.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
