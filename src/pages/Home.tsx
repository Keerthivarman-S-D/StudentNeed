import React, { useState, useMemo } from 'react';
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
  Handshake,
  MapPin,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Plus,
  MessageSquare,
  LayoutGrid
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

  // Live campus listings safely accommodating active, available, and reserved items
  const recentListings = useMemo(() => {
    const now = Date.now();
    return listings
      .filter((l) => {
        const isLive = l.status === 'active' || l.status === 'available' || l.status === 'reserved';
        if (!isLive) return false;
        if (!l.expiresAt) return true;
        return new Date(l.expiresAt).getTime() > now;
      })
      .slice(0, 10);
  }, [listings]);

  // Six curated campus categories matching exact types.ts and marketplace filter definitions
  const curatedCategories = [
    { 
      name: 'Textbooks', 
      icon: BookOpen, 
      description: 'Coursebooks, syllabus notes & guides'
    },
    { 
      name: 'Electronics', 
      icon: Laptop, 
      description: 'Calculators, dev boards & gear'
    },
    { 
      name: 'Lab Essentials', 
      icon: Beaker, 
      description: 'Coats, drawing instruments & kits'
    },
    { 
      name: 'Stationery', 
      icon: PenTool, 
      description: 'Notebooks, folders & drafting pens'
    },
    { 
      name: 'Hostel Essentials', 
      icon: Building2, 
      description: 'Room gear, kettles & storage'
    },
    { 
      name: 'College Wear', 
      icon: Shirt, 
      description: 'Department tees & campus apparel'
    },
  ];

  // How StudentNeed Works: 3-step loop with consistent matching icon containers
  const workflowSteps = [
    {
      step: '01',
      title: 'Find',
      icon: Search,
      description: 'Search for textbooks, equipment, and lab gear or browse categories to discover what peers are offering.'
    },
    {
      step: '02',
      title: 'Connect',
      icon: MessageSquare,
      description: 'Message the student directly through secure in-app chat. Agree on terms, reserve the item, or arrange a swap.'
    },
    {
      step: '03',
      title: 'Meet',
      icon: MapPin,
      description: 'Meet up on campus at designated spots like the MIT Library, Canteen, or Main Gate to inspect and exchange.'
    }
  ];

  // Campus Trust Points
  const trustPoints = [
    {
      icon: ShieldCheck,
      title: 'Campus-Only Trust',
      description: 'Exclusively accessible to verified MIT students with Anna University email authentication. No anonymous outsiders.'
    },
    {
      icon: MapPin,
      title: 'Safe Meetup Spots',
      description: 'Coordinate meetups at approved campus landmarks: Main Gate, Hostel Gate, Back Gate, MIT Library, or Canteen.'
    },
    {
      icon: Handshake,
      title: 'Sustainable Campus',
      description: 'Save money on costly academic texts and reduce campus waste by circulating essentials between senior and junior batches.'
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f7f6f2] text-[#252b27]">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-[#0a281e] px-4 py-16 sm:py-20 lg:py-24 text-white shadow-xs">
        {/* Layered Organic Forest-Green Background */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          {/* Base deep forest-green gradient canvas */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#09281e] via-[#0e3526] to-[#082219]" />

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1440 680"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Radial ambient glow left & right */}
              <radialGradient id="ambGlowLeft" cx="0%" cy="75%" r="65%">
                <stop offset="0%" stopColor="#257c5a" stopOpacity="0.45" />
                <stop offset="40%" stopColor="#17523b" stopOpacity="0.25" />
                <stop offset="80%" stopColor="#0e3526" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="ambGlowRight" cx="100%" cy="75%" r="65%">
                <stop offset="0%" stopColor="#257c5a" stopOpacity="0.40" />
                <stop offset="40%" stopColor="#17523b" stopOpacity="0.22" />
                <stop offset="80%" stopColor="#0e3526" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </radialGradient>

              {/* Left Curve Gradients */}
              <linearGradient id="gradLeftOuter" x1="0%" y1="20%" x2="70%" y2="80%">
                <stop offset="0%" stopColor="#2c8561" stopOpacity="0.40" />
                <stop offset="45%" stopColor="#1b5a41" stopOpacity="0.25" />
                <stop offset="85%" stopColor="#103c2b" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="gradLeftMid" x1="0%" y1="100%" x2="60%" y2="40%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.28" />
                <stop offset="30%" stopColor="#247857" stopOpacity="0.32" />
                <stop offset="70%" stopColor="#144632" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="gradLeftInner" x1="0%" y1="100%" x2="45%" y2="50%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.35" />
                <stop offset="35%" stopColor="#29845f" stopOpacity="0.25" />
                <stop offset="80%" stopColor="#134330" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="strokeLeft1" x1="0%" y1="20%" x2="50%" y2="80%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#3ebd8e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#55e6b4" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="strokeLeft2" x1="0%" y1="100%" x2="60%" y2="40%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.50" />
                <stop offset="50%" stopColor="#3ebd8e" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#55e6b4" stopOpacity="0" />
              </linearGradient>

              {/* Right Curve Gradients */}
              <linearGradient id="gradRightOuter" x1="100%" y1="15%" x2="30%" y2="80%">
                <stop offset="0%" stopColor="#2c8561" stopOpacity="0.38" />
                <stop offset="45%" stopColor="#1b5a41" stopOpacity="0.22" />
                <stop offset="85%" stopColor="#103c2b" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="gradRightMid" x1="100%" y1="100%" x2="40%" y2="40%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.25" />
                <stop offset="30%" stopColor="#247857" stopOpacity="0.28" />
                <stop offset="70%" stopColor="#144632" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="gradRightInner" x1="100%" y1="100%" x2="55%" y2="50%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.30" />
                <stop offset="35%" stopColor="#29845f" stopOpacity="0.22" />
                <stop offset="80%" stopColor="#134330" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="strokeRight1" x1="100%" y1="15%" x2="50%" y2="80%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.40" />
                <stop offset="60%" stopColor="#3ebd8e" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#55e6b4" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="strokeRight2" x1="100%" y1="100%" x2="40%" y2="40%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#3ebd8e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#55e6b4" stopOpacity="0" />
              </linearGradient>

              {/* Bottom Connecting Wave Gradient */}
              <linearGradient id="gradBottomWave" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.12" />
                <stop offset="50%" stopColor="#20694c" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#0e3526" stopOpacity="0.45" />
              </linearGradient>

              <linearGradient id="strokeBottomWave" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#55e6b4" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#55e6b4" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#55e6b4" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* Ambient Background Fields */}
            <rect width="1440" height="680" fill="url(#ambGlowLeft)" />
            <rect width="1440" height="680" fill="url(#ambGlowRight)" />

            {/* Left Side Layer 1: Upper-left graceful wave entering from y=160 */}
            <path
              d="M -40,160 C 130,190 270,320 320,470 C 360,590 320,650 240,680 L -40,680 Z"
              fill="url(#gradLeftOuter)"
            />
            <path
              d="M -40,160 C 130,190 270,320 320,470 C 360,590 320,650 240,680"
              stroke="url(#strokeLeft1)"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Left Side Layer 2: Broad lower-left swell */}
            <path
              d="M -40,380 C 80,360 220,430 300,530 C 370,620 420,650 480,680 L -40,680 Z"
              fill="url(#gradLeftMid)"
            />
            <path
              d="M -40,380 C 80,360 220,430 300,530 C 370,620 420,650 480,680"
              stroke="url(#strokeLeft2)"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Left Side Layer 3: Deep corner accent contour */}
            <path
              d="M -40,510 C 60,500 170,560 240,630 C 280,660 300,670 340,680 L -40,680 Z"
              fill="url(#gradLeftInner)"
            />

            {/* Right Side Layer 1: Upper-right graceful wave entering from y=150 */}
            <path
              d="M 1480,150 C 1310,180 1170,310 1120,460 C 1080,580 1120,640 1200,680 L 1480,680 Z"
              fill="url(#gradRightOuter)"
            />
            <path
              d="M 1480,150 C 1310,180 1170,310 1120,460 C 1080,580 1120,640 1200,680"
              stroke="url(#strokeRight1)"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Right Side Layer 2: Broad lower-right swell */}
            <path
              d="M 1480,370 C 1360,350 1220,420 1140,520 C 1070,610 1020,640 960,680 L 1480,680 Z"
              fill="url(#gradRightMid)"
            />
            <path
              d="M 1480,370 C 1360,350 1220,420 1140,520 C 1070,610 1020,640 960,680"
              stroke="url(#strokeRight2)"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Right Side Layer 3: Deep corner accent contour behind chatbot */}
            <path
              d="M 1480,500 C 1380,490 1270,550 1200,620 C 1160,650 1140,665 1100,680 L 1480,680 Z"
              fill="url(#gradRightInner)"
            />

            {/* Broad Connecting Bottom Wave across lower hero */}
            <path
              d="M -40,680 C 260,600 500,635 720,640 C 940,645 1180,605 1480,680 Z"
              fill="url(#gradBottomWave)"
            />
            <path
              d="M -40,680 C 260,600 500,635 720,640 C 940,645 1180,605 1480,680"
              stroke="url(#strokeBottomWave)"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </div>

        <div className="relative mx-auto max-w-4xl text-center space-y-7 sm:space-y-8">
          {/* Value proposition heading */}
          <div className="space-y-3.5 sm:space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-balance leading-[1.12]">
              <span className="block text-white">Everything students need.</span>
              <span className="block text-[#55e6b4]">From students who have it.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-zinc-200 leading-relaxed font-normal">
              Buy, donate, borrow or exchange college essentials securely within the MIT campus.
              Zero courier fees, zero waiting—just quick on-campus meetups.
            </p>
          </div>

          {/* Prominent Hero Search Bar */}
          <form
            onSubmit={handleHeroSearch}
            className="mx-auto max-w-2xl w-full"
          >
            <div className="relative flex items-center rounded-2xl bg-white p-2 sm:p-2.5 shadow-xl border border-white/20 transition-all focus-within:ring-2 focus-within:ring-[#55e6b4]/70">
              <Search className="ml-3 sm:ml-4 h-5 w-5 text-[#555d56] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search textbooks, calculators, lab coats, components..."
                className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-[#252b27] placeholder:text-[#555d56] outline-none"
                aria-label="Search campus marketplace items"
              />
              <button
                type="submit"
                className="shrink-0 bg-[#163f2e] text-white hover:bg-[#113325] font-semibold px-6 sm:px-7 h-11 sm:h-12 rounded-xl sm:rounded-2xl shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55e6b4]"
              >
                <span>Find Item</span>
              </button>
            </div>
          </form>

          {/* Primary Quick Links with consistent heights, icons, and states */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
            <Link to="/marketplace">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl sm:rounded-2xl bg-[#133928]/85 hover:bg-[#133928] border border-emerald-600/30 text-white font-semibold px-6 text-sm sm:text-base transition-all active:scale-[0.98] shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <LayoutGrid className="h-4.5 w-4.5 text-white shrink-0" />
                <span>Browse All Marketplace Items</span>
              </button>
            </Link>
            <Link to="/create-listing">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-white text-[#143c2e] hover:bg-zinc-100 font-semibold px-6 text-sm sm:text-base shadow-sm transition-all active:scale-[0.98] shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Plus className="h-4.5 w-4.5 text-[#143c2e]" />
                <span>Post an Item</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Popular Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:py-16 sm:px-6 lg:px-8">
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
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[#204b39] hover:underline transition-colors shrink-0"
          >
            <span>View All Categories</span>
            <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {curatedCategories.map((category) => (
            <Link
              key={category.name}
              to={`/marketplace?category=${encodeURIComponent(category.name)}`}
              className="group flex flex-col items-center text-center p-4 sm:p-5 rounded-2xl border border-[#dedcd4] bg-white shadow-2xs transition-all duration-200 hover:border-[#204b39]/50 hover:shadow-xs hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] h-full"
            >
              <div className="mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] border border-[#dedcd4] transition-colors group-hover:bg-[#55e6b4]/20 group-hover:text-[#143c2e] shadow-2xs shrink-0">
                <category.icon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-[#252b27] group-hover:text-[#204b39] transition-colors line-clamp-1">
                {category.name}
              </h3>
              <p className="mt-1 text-xs text-[#555d56] leading-snug line-clamp-2">
                {category.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Fresh Finds (Recent Listings) */}
      <section className="bg-white py-14 sm:py-16 border-y border-[#dedcd4]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#204b39] bg-[#edf1ec] px-3 py-1 rounded-full border border-[#dedcd4] mb-2">
                <Sparkles className="h-3 w-3 text-[#204b39]" />
                Recent Additions
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#252b27] sm:text-3xl">
                Fresh Finds
              </h2>
              <p className="text-sm text-[#555d56] mt-1">
                Recently added items available for sale, donation, or swap on campus.
              </p>
            </div>
            
            <Link 
              to="/marketplace" 
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[#204b39] hover:underline transition-colors shrink-0"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Loading Skeletons */}
          {listingsLoading && (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              <ListingCardSkeleton />
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

          {/* Responsive Product Cards Grid (4-5 cols wide, 3 med, 2 mobile) */}
          {!listingsLoading && !listingsError && recentListings.length > 0 && (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              {recentListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. How StudentNeed Works: Find → Connect → Meet */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#204b39] bg-[#edf1ec] px-3 py-1 rounded-full border border-[#dedcd4] mb-3">
            Campus-First Workflow
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#252b27] sm:text-4xl">
            How StudentNeed Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#555d56] max-w-lg mx-auto">
            A safe, transparent 3-step loop designed specifically for campus exchanges.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
          {/* Subtle desktop connector line */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-[88px] left-16 right-16 h-0.5 bg-[#dedcd4] pointer-events-none z-0"
          />

          {workflowSteps.map((item) => (
            <div
              key={item.step}
              className="relative z-10 flex flex-col items-center text-center p-7 sm:p-8 rounded-2xl border border-[#dedcd4] bg-white shadow-2xs hover:border-[#204b39]/40 hover:shadow-xs transition-all h-full"
            >
              <span className="inline-flex items-center rounded-full bg-[#edf1ec] border border-[#dedcd4]/60 px-2.5 py-0.5 text-xs font-bold text-[#204b39] mb-4">
                Step {item.step}
              </span>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] border border-[#dedcd4] transition-colors shadow-2xs shrink-0">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-[#252b27] mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-[#555d56] leading-relaxed max-w-xs">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Why StudentNeed / Campus Trust Points */}
      <section className="bg-white border-t border-[#dedcd4] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {trustPoints.map((point) => (
              <div
                key={point.title}
                className="flex flex-col gap-3.5 rounded-2xl bg-[#f7f6f2] p-7 sm:p-8 border border-[#dedcd4] shadow-2xs hover:border-[#204b39]/40 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#204b39] border border-[#dedcd4] shadow-2xs shrink-0">
                  <point.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#252b27]">
                  {point.title}
                </h3>
                <p className="text-[#555d56] text-sm leading-relaxed">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Professional App Footer */}
      <AppFooter />
    </div>
  );
}
