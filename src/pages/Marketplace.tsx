import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, 
  SlidersHorizontal, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight, 
  X, 
  RotateCcw,
  Tag,
  Check,
  ChevronDown,
  Layers
} from 'lucide-react';
import { ListingType, ActiveListingType, Category } from '../types';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ListingCard } from '../components/ListingCard';
import { ListingCardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

export function Marketplace() {
  const { listings, listingsLoading, listingsError, hasMoreListings, loadMoreListings } = useAppContext();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read initial parameters from URL
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = (searchParams.get('category') as Category) || 'All';

  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>(initialCategory);
  const [selectedType, setSelectedType] = useState<ListingType | 'All'>('All');
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

  // Synchronize internal state when URL changes externally (e.g., Home hero search or browser back/forward)
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

  // Synchronize URL search params when debounced search or category changes (preventing loops)
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
      // Focus close button on open
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
    // Restore focus to trigger button
    setTimeout(() => mobileFilterTriggerRef.current?.focus(), 50);
  };

  const categories: (Category | 'All')[] = [
    'All', 'Textbooks', 'Electronics', 'Stationery', 'Lab Essentials', 'Hostel Essentials', 'Sports', 'College Wear', 'Other'
  ];

  const types: (ActiveListingType | 'All')[] = ['All', 'Sale', 'Donate', 'Exchange'];

  // Filter and sort listings
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
        l.description.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter(l => l.category === selectedCategory);
    }

    if (selectedType !== 'All') {
      result = result.filter(l => l.type === selectedType);
    }

    switch (sortBy) {
      case 'price_low':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_high':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return result;
  }, [listings, debouncedSearch, selectedCategory, selectedType, sortBy]);

  // Active filter count and clear logic
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

  const handleClearCategory = () => {
    setSelectedCategory('All');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('category');
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearType = () => {
    setSelectedType('All');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Unauthenticated Verified Student Prompt */}
      {!currentUser && (
        <div className="mb-8 overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-r from-brand-charcoal via-zinc-900 to-brand-charcoal p-6 text-white shadow-md sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Anna University Verified Network
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Access exclusive campus listings & student exchanges
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Sign in with your verified <span className="font-mono text-emerald-300 font-semibold">@student.annauniv.edu</span> email to reserve items, chat directly with peers, and coordinate secure campus meetups.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link to="/login">
                <Button className="bg-brand-teal text-white hover:bg-brand-teal-hover font-semibold gap-1.5 shadow-sm h-11 px-6 rounded-xl">
                  Sign In with Student Email
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Page Header & Top Search Bar */}
      <div className="mb-8 space-y-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-charcoal">
            Campus Marketplace
          </h1>
          <p className="text-sm sm:text-base text-zinc-600">
            Discover, buy, borrow, or swap essentials with verified peers across MIT campus.
          </p>
        </div>

        {/* Top Search & Filter Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Prominent Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search items, textbooks, equipment, calculators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-brand-border bg-white pl-10 pr-10 text-sm text-brand-charcoal placeholder:text-zinc-400 transition-all focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 shadow-2xs"
              aria-label="Search campus marketplace"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                aria-label="Clear search text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Controls: Sort Dropdown & Mobile Filter Trigger */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Sort Dropdown */}
            <div className="relative flex-1 sm:flex-none">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-11 w-full sm:w-auto appearance-none rounded-xl border border-brand-border bg-white pl-3.5 pr-8 text-sm font-medium text-brand-charcoal outline-none transition-all focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 shadow-2xs cursor-pointer"
                aria-label="Sort listings"
              >
                <option value="newest">Newest first</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            </div>

            {/* Mobile Filter Button */}
            <Button 
              ref={mobileFilterTriggerRef}
              variant="outline" 
              className="h-11 md:hidden gap-2 px-3.5 rounded-xl border-brand-border bg-white text-brand-charcoal hover:border-brand-teal hover:bg-zinc-50"
              onClick={() => setShowMobileFilters(true)}
              aria-expanded={showMobileFilters}
              aria-haspopup="dialog"
              aria-label={`Open filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
            >
              <SlidersHorizontal className="h-4 w-4 text-emerald-700" />
              <span className="text-sm font-semibold">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-teal px-1.5 text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-200">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-1">
              Active:
            </span>

            {debouncedSearch.trim() && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800 border border-zinc-200">
                <span>&ldquo;{debouncedSearch}&rdquo;</span>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-full p-0.5 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                  aria-label="Remove search filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {selectedCategory !== 'All' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span>{selectedCategory}</span>
                <button
                  type="button"
                  onClick={handleClearCategory}
                  className="rounded-full p-0.5 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-900 transition-colors"
                  aria-label={`Remove category filter: ${selectedCategory}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {selectedType !== 'All' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
                <span>{selectedType === 'Sale' ? 'For Sale' : selectedType}</span>
                <button
                  type="button"
                  onClick={handleClearType}
                  className="rounded-full p-0.5 hover:bg-blue-100 text-blue-600 hover:text-blue-900 transition-colors"
                  aria-label={`Remove type filter: ${selectedType}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 underline ml-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col md:flex-row md:items-start gap-8">
        
        {/* Desktop Sidebar Filters */}
        <aside 
          className="hidden md:block w-64 shrink-0 rounded-2xl border border-brand-border bg-white p-5 shadow-2xs space-y-6"
          aria-label="Marketplace filters"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-emerald-700" />
              <h2 className="font-bold text-sm text-brand-charcoal uppercase tracking-wider">
                Filters
              </h2>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Listing Type Filter */}
          <div>
            <h3 className="font-semibold text-xs text-zinc-500 uppercase tracking-wider mb-3">
              Listing Type
            </h3>
            <div className="space-y-1.5">
              {types.map(type => (
                <label 
                  key={type} 
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                    selectedType === type
                      ? "bg-emerald-50 text-emerald-900 font-semibold"
                      : "text-zinc-700 hover:bg-zinc-50 hover:text-brand-charcoal"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="radio" 
                      name="desktop-type" 
                      checked={selectedType === type}
                      onChange={() => setSelectedType(type)}
                      className="accent-brand-teal text-brand-teal focus:ring-brand-teal h-4 w-4 border-brand-border"
                    />
                    <span>{type === 'Sale' ? 'For Sale' : type}</span>
                  </div>
                  {selectedType === type && (
                    <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <h3 className="font-semibold text-xs text-zinc-500 uppercase tracking-wider mb-3">
              Category
            </h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {categories.map(cat => (
                <label 
                  key={cat} 
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                    selectedCategory === cat
                      ? "bg-emerald-50 text-emerald-900 font-semibold"
                      : "text-zinc-700 hover:bg-zinc-50 hover:text-brand-charcoal"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="radio" 
                      name="desktop-category" 
                      checked={selectedCategory === cat}
                      onChange={() => setSelectedCategory(cat)}
                      className="accent-brand-teal text-brand-teal focus:ring-brand-teal h-4 w-4 border-brand-border"
                    />
                    <span className="truncate">{cat}</span>
                  </div>
                  {selectedCategory === cat && (
                    <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Listings Grid Area */}
        <div className="flex-1 min-w-0">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-charcoal">
              Available Items{' '}
              <span className="font-normal text-zinc-500 text-sm">
                ({listingsLoading ? '...' : filteredListings.length})
              </span>
            </h2>
          </div>

          {/* Loading Skeletons Grid */}
          {listingsLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </div>
          ) : listingsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center max-w-lg mx-auto">
              <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-red-900 mb-1">Could not load campus listings</h3>
              <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{listingsError}</p>
              {!currentUser && (
                <Link to="/login">
                  <Button size="sm">Sign In to Access</Button>
                </Link>
              )}
            </div>
          ) : filteredListings.length > 0 ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>

              {hasMoreListings && (
                <div className="flex justify-center pt-4 pb-6">
                  <Button
                    variant="outline"
                    onClick={loadMoreListings}
                    className="gap-2 px-8 h-11 border-brand-border text-brand-charcoal hover:border-brand-teal hover:text-emerald-800 hover:bg-emerald-50 font-semibold text-sm transition-all rounded-xl shadow-2xs"
                  >
                    Load More Listings
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white py-20 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-4">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-brand-charcoal">No campus items found</h3>
              <p className="text-sm text-zinc-600 mt-1 max-w-md">
                {listings.length === 0 
                  ? "There are no campus listings yet. Be the first student to post an item!"
                  : "We couldn't find any items matching your active search or filters."}
              </p>
              {listings.length === 0 ? (
                <Link to="/create-listing" className="mt-6">
                  <Button className="bg-brand-teal text-white hover:bg-brand-teal-hover font-semibold">
                    Post the First Item
                  </Button>
                </Link>
              ) : (
                <Button 
                  variant="outline" 
                  className="mt-6 rounded-xl border-brand-border font-semibold text-emerald-800 hover:bg-emerald-50"
                  onClick={handleClearAllFilters}
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Accessible Mobile Filter Drawer / Bottom Sheet */}
      {showMobileFilters && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filter-heading"
        >
          {/* Backdrop Click Dismiss */}
          <div 
            className="fixed inset-0"
            onClick={handleCloseMobileFilters}
            aria-hidden="true"
          />

          {/* Drawer Sheet Container */}
          <div className="relative z-10 w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-zinc-200 overflow-hidden animate-in slide-in-from-bottom duration-250">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4.5 w-4.5 text-emerald-700" />
                <h3 id="mobile-filter-heading" className="text-base font-bold text-brand-charcoal">
                  Filter Campus Listings
                </h3>
              </div>
              <button
                ref={mobileDrawerCloseRef}
                type="button"
                onClick={handleCloseMobileFilters}
                className="rounded-full p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Filter Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Type Filter */}
              <div>
                <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider mb-3">
                  Listing Type
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {types.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-all text-left",
                        selectedType === type
                          ? "bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs"
                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <span>{type === 'Sale' ? 'For Sale' : type}</span>
                      {selectedType === type && <Check className="h-4 w-4 text-emerald-700" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider mb-3">
                  Category
                </h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-all text-left",
                        selectedCategory === cat
                          ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold shadow-2xs"
                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <span className="truncate">{cat}</span>
                      {selectedCategory === cat && <Check className="h-4 w-4 text-emerald-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer with Apply & Reset */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center gap-3">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={handleClearAllFilters}
                  className="flex-1 font-semibold rounded-xl text-zinc-700 border-zinc-300"
                >
                  Reset All
                </Button>
              )}
              <Button
                onClick={handleCloseMobileFilters}
                className="flex-1 bg-brand-teal text-white hover:bg-brand-teal-hover font-bold rounded-xl shadow-xs"
              >
                Apply Filters ({filteredListings.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
