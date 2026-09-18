import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, AlertCircle, Loader2, GraduationCap, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ListingCard } from '../components/ListingCard';
import { Button } from '../components/ui/Button';
import { Category, ListingType } from '../types';

export function Marketplace() {
  const { listings, listingsLoading, listingsError } = useAppContext();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>(
    (searchParams.get('category') as Category) || 'All'
  );
  const [selectedType, setSelectedType] = useState<ListingType | 'All'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  
  const [showFilters, setShowFilters] = useState(false);

  const categories: (Category | 'All')[] = [
    'All', 'Textbooks', 'Electronics', 'Stationery', 'Lab Essentials', 'Hostel Essentials', 'Sports', 'College Wear', 'Other'
  ];

  const types: (ListingType | 'All')[] = ['All', 'Sale', 'Borrow', 'Donate', 'Exchange'];

  const filteredListings = useMemo(() => {
    // Only active listings in public marketplace discovery (completed, cancelled, and expired listings are strictly hidden)
    const now = Date.now();
    let result = listings.filter(l => 
      (l.status === 'active' || l.status === 'available' || l.status === 'reserved') &&
      l.status !== 'completed' &&
      l.status !== 'cancelled' &&
      Boolean(l.expiresAt) &&
      new Date(l.expiresAt).getTime() > now
    );

    if (search) {
      result = result.filter(l => 
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.description.toLowerCase().includes(search.toLowerCase())
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
  }, [listings, search, selectedCategory, selectedType, sortBy]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Unauthenticated Verified Student Prompt */}
      {!currentUser && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200 backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Anna University Verified Network
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Access exclusive campus listings & student exchanges
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Sign in with your verified <span className="font-mono text-white">@student.annauniv.edu</span> email to reserve items, chat directly with peers, and coordinate secure campus meetups.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link to="/login">
                <Button className="bg-white text-zinc-900 hover:bg-zinc-100 font-semibold gap-1.5 shadow-sm">
                  Sign In with Student Email
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        
        {/* Mobile Filter Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="What do you need?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters Sidebar */}
        <aside className={`w-full shrink-0 md:block md:w-64 space-y-8 ${showFilters ? 'block' : 'hidden'}`}>
          <div className="hidden md:block relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="What do you need?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 mb-3">Listing Type</h3>
            <div className="space-y-2">
              {types.map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="type" 
                    checked={selectedType === type}
                    onChange={() => setSelectedType(type)}
                    className="text-zinc-900 focus:ring-zinc-900 h-4 w-4 border-zinc-300"
                  />
                  <span className="text-sm text-zinc-700">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 mb-3">Category</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {categories.map(cat => (
                <label key={cat} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="category" 
                    checked={selectedCategory === cat}
                    onChange={() => {
                      setSelectedCategory(cat);
                      if (searchParams.get('category')) {
                        searchParams.delete('category');
                        setSearchParams(searchParams);
                      }
                    }}
                    className="text-zinc-900 focus:ring-zinc-900 h-4 w-4 border-zinc-300"
                  />
                  <span className="text-sm text-zinc-700">{cat}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900">
              Explore Campus <span className="text-zinc-500 font-normal text-lg">({filteredListings.length})</span>
            </h1>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 hidden sm:inline-block">Sort by:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="newest">Newest first</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>
          </div>

          {listingsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500 font-medium">Fetching real-time listings from Firestore...</p>
            </div>
          ) : listingsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-red-900 mb-1">Could not load campus listings</h3>
              <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{listingsError}</p>
              {!currentUser && (
                <Link to="/login">
                  <Button size="sm">Sign In to Access</Button>
                </Link>
              )}
            </div>
          ) : filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredListings.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-24 text-center">
              <Search className="h-12 w-12 text-zinc-300 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900">No items found</h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                {listings.length === 0 
                  ? "There are no campus listings yet. Be the first student to post an item!"
                  : "We couldn't find any items matching your filters. Try adjusting them or create a request!"}
              </p>
              {listings.length === 0 ? (
                <Link to="/create-listing">
                  <Button className="mt-6">Post the First Item</Button>
                </Link>
              ) : (
                <Button 
                  variant="outline" 
                  className="mt-6"
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('All');
                    setSelectedType('All');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

