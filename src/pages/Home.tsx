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
    <div className="flex flex-col min-h-screen bg-[#f7f6f2] text-[#252b27]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#173e2d] px-4 pt-14 pb-16 sm:px-6 lg:px-8 text-white shadow-xs">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-300 via-zinc-900 to-black pointer-events-none"
        />

        <div className="relative mx-auto max-w-4xl text-center space-y-7">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800/80 bg-[#113023]/80 px-3.5 py-1 text-xs font-medium text-emerald-200 backdrop-blur-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>MIT Campus Verified Network • @student.annauniv.edu</span>
          </div>

          {/* Value proposition heading */}
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-balance leading-tight">
              Everything students need.<br />
              <span className="text-emerald-300">From students who have it.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-zinc-200 sm:text-base leading-relaxed">
              Buy, donate, borrow or exchange college essentials securely within the MIT campus.
              Zero courier fees, zero waiting—just quick on-campus meetups.
            </p>
          </div>

          {/* Prominent Hero Search Bar */}
          <form
            onSubmit={handleHeroSearch}
            className="mx-auto max-w-2xl"
          >
            <div className="relative flex items-center rounded-2xl bg-white p-1.5 shadow-md border border-[#dedcd4] transition-all focus-within:ring-2 focus-within:ring-[#204b39]">
              <Search className="ml-3 h-5 w-5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search textbooks, calculators, lab coats, components..."
                className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-[#252b27] placeholder:text-zinc-400 outline-none"
                aria-label="Search campus marketplace items"
              />
              <button
                type="submit"
                className="shrink-0 bg-[#204b39] text-white hover:bg-[#183a2c] font-semibold px-5 h-11 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Find Item
              </button>
            </div>
          </form>

          {/* Primary Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link to="/marketplace">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 py-2.5 text-sm transition-colors cursor-pointer"
              >
                Browse All Marketplace Items
              </button>
            </Link>
            <Link to="/create-listing">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#173e2d] hover:bg-zinc-100 font-semibold px-5 py-2.5 text-sm shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Post an Item
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Six Curated Campus Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#204b39] bg-[#edf1ec] px-3 py-1 rounded-full border border-[#dedcd4] mb-2">
              <Sparkles className="h-3 w-3 text-[#204b39]" />
              Campus Essentials
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#252b27] sm:text-3xl">
              Popular Categories
            </h2>
            <p className="text-sm text-[#555d56] mt-1">
              Find course materials, lab gear, and hostel items shared by fellow students.
            </p>
          </div>

          <Link 
            to="/marketplace" 
            className="group flex items-center gap-1.5 text-sm font-semibold text-[#204b39] hover:underline transition-colors shrink-0"
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
              className="group flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-[#dedcd4] bg-white shadow-2xs transition-all duration-200 hover:border-[#204b39]/40 hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39]"
            >
              <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border ${category.color} motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105 shadow-2xs`}>
                <category.icon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#252b27] group-hover:text-[#204b39] transition-colors">
                {category.name}
              </h3>
              <p className="mt-1 text-[11px] text-[#717870] line-clamp-1 hidden sm:block">
                {category.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Fresh Finds (Recent Listings) */}
      <section className="bg-white py-16 border-y border-[#dedcd4]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#252b27] sm:text-3xl">
                Fresh Finds
              </h2>
              <p className="text-sm text-[#555d56] mt-1">
                Recently added items available for sale, donation, or swap on campus.
              </p>
            </div>
            
            <Link 
              to="/marketplace" 
              className="group flex items-center gap-1.5 text-sm font-semibold text-[#204b39] hover:underline transition-colors"
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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedcd4] bg-[#faf9f5] p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-400 mb-3 border border-[#dedcd4]">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-[#252b27]">No active listings yet today</h3>
              <p className="text-sm text-[#555d56] mt-1 max-w-sm">
                Be the first student to post an item for sale, donation, or exchange!
              </p>
              <Link to="/create-listing" className="mt-5">
                <Button className="bg-[#204b39] text-white hover:bg-[#183a2c] font-semibold">
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
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#204b39] bg-[#edf1ec] px-3 py-1 rounded-full border border-[#dedcd4] mb-3">
            Campus-First Workflow
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#252b27] sm:text-4xl">
            How StudentNeed Works
          </h2>
          <p className="mt-3 text-base text-[#555d56]">
            A safe, transparent 3-step loop designed specifically for campus exchanges.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 relative">
          {/* Step 1 */}
          <div className="relative flex flex-col items-center text-center p-8 rounded-2xl border border-[#dedcd4] bg-white shadow-2xs hover:border-[#204b39]/30 transition-all">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#252b27] text-white text-xl font-bold shadow-xs">
              1
            </div>
            <h3 className="text-xl font-bold text-[#252b27] mb-2">Find</h3>
            <p className="text-sm text-[#555d56] leading-relaxed">
              Search for textbooks, equipment, and lab gear or browse categories to discover what peers are offering.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col items-center text-center p-8 rounded-2xl border border-[#dedcd4] bg-white shadow-2xs hover:border-[#204b39]/30 transition-all">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#204b39] text-white text-xl font-bold shadow-xs">
              2
            </div>
            <h3 className="text-xl font-bold text-[#252b27] mb-2">Connect</h3>
            <p className="text-sm text-[#555d56] leading-relaxed">
              Message the student directly through secure in-app chat. Agree on terms, reserve the item, or arrange a swap.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col items-center text-center p-8 rounded-2xl border border-[#dedcd4] bg-white shadow-2xs hover:border-[#204b39]/30 transition-all">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173e2d] text-white text-xl font-bold shadow-xs">
              3
            </div>
            <h3 className="text-xl font-bold text-[#252b27] mb-2">Meet</h3>
            <p className="text-sm text-[#555d56] leading-relaxed">
              Meet up on campus at designated spots like the Central Library, Food Court, or department blocks to inspect and exchange.
            </p>
          </div>
        </div>
      </section>

      {/* Why StudentNeed / Campus Trust Points */}
      <section className="bg-[#faf9f5] border-t border-[#dedcd4] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-8 border border-[#dedcd4] shadow-2xs hover:border-[#204b39]/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] border border-[#dedcd4]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#252b27]">Campus-Only Trust</h3>
              <p className="text-[#555d56] text-sm leading-relaxed">
                Exclusively accessible to verified MIT students with Anna University email authentication. No anonymous outsiders.
              </p>
            </div>

            <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-8 border border-[#dedcd4] shadow-2xs hover:border-[#204b39]/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] border border-[#dedcd4]">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#252b27]">Safe Meetup Spots</h3>
              <p className="text-[#555d56] text-sm leading-relaxed">
                Coordinate meetups at approved campus landmarks: Central Library, Food Court, CSE Block, ECE Block, or Main Gate.
              </p>
            </div>

            <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-8 border border-[#dedcd4] shadow-2xs hover:border-[#204b39]/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] border border-[#dedcd4]">
                <Handshake className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#252b27]">Sustainable Campus</h3>
              <p className="text-[#555d56] text-sm leading-relaxed">
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
