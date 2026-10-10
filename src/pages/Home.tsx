import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Search,
  BookOpen, 
  Laptop, 
  Beaker, 
  PenTool,
  Building2,
  Shirt,
  ShieldCheck, 
  Zap, 
  Handshake,
  MapPin,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ListingCard } from '../components/ListingCard';
import { ListingCardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { AppFooter } from '../components/AppFooter';

export function Home() {
  const navigate = useNavigate();
  const { listings, listingsLoading, listingsError } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      navigate(`/marketplace?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/marketplace');
    }
  };

  const recentListings = listings
    .filter(l => 
      (l.status === 'active' || l.status === 'available' || l.status === 'reserved') &&
      Boolean(l.expiresAt) &&
      new Date(l.expiresAt).getTime() > Date.now()
    )
    .slice(0, 4);

  // Six curated campus categories matching exact types.ts and marketplace filter definitions
  const curatedCategories = [
    { 
      name: 'Textbooks', 
      icon: BookOpen, 
      color: 'bg-blue-50 text-blue-700 border-blue-200 group-hover:border-blue-400',
      description: 'Coursebooks, syllabus notes & guides'
    },
    { 
      name: 'Electronics', 
      icon: Laptop, 
      color: 'bg-purple-50 text-purple-700 border-purple-200 group-hover:border-purple-400',
      description: 'Calculators, dev boards & gear'
    },
    { 
      name: 'Lab Essentials', 
      icon: Beaker, 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:border-emerald-400',
      description: 'Coats, drawing instruments & kits'
    },
    { 
      name: 'Stationery', 
      icon: PenTool, 
      color: 'bg-amber-50 text-amber-800 border-amber-200 group-hover:border-amber-400',
      description: 'Notebooks, folders & drafting pens'
    },
    { 
      name: 'Hostel Essentials', 
      icon: Building2, 
      color: 'bg-orange-50 text-orange-800 border-orange-200 group-hover:border-orange-400',
      description: 'Room gear, kettles & storage'
    },
    { 
      name: 'College Wear', 
      icon: Shirt, 
      color: 'bg-rose-50 text-rose-700 border-rose-200 group-hover:border-rose-400',
      description: 'Department tees & campus apparel'
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-charcoal px-4 pt-16 pb-20 sm:px-6 lg:px-8 text-white">
        <div 
          aria-hidden="true" 
          className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-400 via-zinc-900 to-black pointer-events-none" 
        />
        
        <div className="relative mx-auto max-w-4xl text-center space-y-8">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/80 px-3.5 py-1 text-xs font-medium text-zinc-200 backdrop-blur-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>MIT Campus Verified Network • @student.annauniv.edu</span>
          </div>

          {/* Value proposition heading */}
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-balance leading-tight">
              Everything students need.<br />
              <span className="text-emerald-400">From students who have it.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-base text-zinc-300 sm:text-lg leading-relaxed">
              Buy, donate, borrow or exchange college essentials securely within the MIT campus. 
              Zero courier fees, zero waiting—just quick on-campus meetups.
            </p>
          </div>

          {/* Prominent Hero Search Bar */}
          <form 
            onSubmit={handleHeroSearch}
            className="mx-auto max-w-2xl"
          >
            <div className="relative flex items-center rounded-2xl bg-white p-1.5 shadow-xl shadow-black/20 border border-zinc-200 transition-all focus-within:ring-3 focus-within:ring-emerald-500/40">
              <Search className="ml-3 h-5 w-5 text-zinc-400 shrink-0" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search textbooks, calculators, lab coats, components..."
                className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-zinc-900 placeholder:text-zinc-400 outline-none"
                aria-label="Search campus marketplace items"
              />
              <Button 
                type="submit"
                className="shrink-0 bg-brand-teal text-white hover:bg-brand-teal-hover font-semibold px-5 h-11 rounded-xl shadow-xs"
              >
                Find Item
              </Button>
            </div>
          </form>

          {/* Primary Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link to="/marketplace">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-zinc-700 bg-zinc-900/60 text-white hover:bg-zinc-800 hover:text-white hover:border-zinc-500 font-semibold"
              >
                Browse All Marketplace Items
              </Button>
            </Link>
            <Link to="/create-listing">
              <Button 
                size="lg" 
                className="bg-brand-teal text-white hover:bg-brand-teal-hover font-semibold gap-2 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Post an Item
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Six Curated Campus Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-2">
              <Sparkles className="h-3 w-3 text-emerald-700" />
              Campus Essentials
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-brand-charcoal sm:text-3xl">
              Popular Categories
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              Find course materials, lab gear, and hostel items shared by fellow students.
            </p>
          </div>

          <Link 
            to="/marketplace" 
            className="group flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900 transition-colors shrink-0"
          >
            <span>View All Categories</span>
            <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {curatedCategories.map((category) => (
            <Link
              key={category.name}
              to={`/marketplace?category=${encodeURIComponent(category.name)}`}
              className="group flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-brand-border bg-white shadow-2xs transition-all duration-200 hover:border-emerald-600/40 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
            >
              <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border ${category.color} motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105 shadow-2xs`}>
                <category.icon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-brand-charcoal group-hover:text-emerald-800 transition-colors">
                {category.name}
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500 line-clamp-1 hidden sm:block">
                {category.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Fresh Finds (Recent Listings) */}
      <section className="bg-white py-16 border-y border-brand-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-brand-charcoal sm:text-3xl">
                Fresh Finds
              </h2>
              <p className="text-sm text-zinc-600 mt-1">
                Recently added items available for sale, donation, or swap on campus.
              </p>
            </div>
            
            <Link 
              to="/marketplace" 
              className="group flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900 transition-colors"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Loading Skeletons */}
          {listingsLoading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </div>
          )}

          {/* Error State */}
          {!listingsLoading && listingsError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center max-w-lg mx-auto">
              <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-red-900 mb-1">Could not load campus listings</h3>
              <p className="text-sm text-red-700 mb-4">{listingsError}</p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.location.reload()}
                className="gap-2 border-red-300 text-red-800 hover:bg-red-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!listingsLoading && !listingsError && recentListings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900">No active listings yet today</h3>
              <p className="text-sm text-zinc-600 mt-1 max-w-sm">
                Be the first student to post an item for sale, donation, or exchange!
              </p>
              <Link to="/create-listing" className="mt-5">
                <Button className="bg-brand-teal text-white hover:bg-brand-teal-hover font-semibold">
                  Post the First Item
                </Button>
              </Link>
            </div>
          )}

          {/* Product Cards Grid */}
          {!listingsLoading && !listingsError && recentListings.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {recentListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How StudentNeed Works: Find → Connect → Meet */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-3">
            Campus-First Workflow
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-brand-charcoal sm:text-4xl">
            How StudentNeed Works
          </h2>
          <p className="mt-3 text-base text-zinc-600">
            A safe, transparent 3-step loop designed specifically for campus exchanges.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 relative">
          {/* Step 1 */}
          <div className="relative flex flex-col items-center text-center p-8 rounded-3xl border border-brand-border bg-white shadow-2xs hover:border-emerald-600/30 transition-all">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-charcoal text-white text-xl font-bold shadow-md shadow-black/10">
              1
            </div>
            <h3 className="text-xl font-bold text-brand-charcoal mb-2">Find</h3>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Search for textbooks, equipment, and lab gear or browse categories to discover what peers are offering.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col items-center text-center p-8 rounded-3xl border border-brand-border bg-white shadow-2xs hover:border-emerald-600/30 transition-all">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal text-white text-xl font-bold shadow-md shadow-brand-teal/20">
              2
            </div>
            <h3 className="text-xl font-bold text-brand-charcoal mb-2">Connect</h3>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Message the student directly through secure in-app chat. Agree on terms, reserve the item, or arrange a swap.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col items-center text-center p-8 rounded-3xl border border-brand-border bg-white shadow-2xs hover:border-emerald-600/30 transition-all">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700 text-white text-xl font-bold shadow-md shadow-emerald-700/20">
              3
            </div>
            <h3 className="text-xl font-bold text-brand-charcoal mb-2">Meet</h3>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Meet up on campus at designated spots like the Central Library, Food Court, or department blocks to inspect and exchange.
            </p>
          </div>
        </div>
      </section>

      {/* Why StudentNeed / Campus Trust Points */}
      <section className="bg-zinc-50 border-t border-brand-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-3.5 rounded-3xl bg-white p-8 border border-brand-border shadow-2xs hover:border-emerald-600/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-brand-charcoal">Campus-Only Trust</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Exclusively accessible to verified MIT students with Anna University email authentication. No anonymous outsiders.
              </p>
            </div>

            <div className="flex flex-col gap-3.5 rounded-3xl bg-white p-8 border border-brand-border shadow-2xs hover:border-emerald-600/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 border border-teal-200">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-brand-charcoal">Safe Meetup Spots</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Coordinate meetups at approved campus landmarks: Central Library, Food Court, CSE Block, ECE Block, or Main Gate.
              </p>
            </div>

            <div className="flex flex-col gap-3.5 rounded-3xl bg-white p-8 border border-brand-border shadow-2xs hover:border-emerald-600/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-800 border border-purple-200">
                <Handshake className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-brand-charcoal">Sustainable Campus</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Save money on costly academic texts and reduce campus waste by circulating essentials between senior and junior batches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Professional App Footer */}
      <AppFooter />
    </div>
  );
}
