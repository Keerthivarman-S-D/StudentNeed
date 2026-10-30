import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Search,
  MessageSquare,
  Handshake,
  MapPin,
  Tag,
  Clock,
  HeartHandshake,
  Repeat,
  HelpCircle,
  CheckCircle2,
  Building2,
  Users,
  Heart,
  Sparkles,
  Mail,
  Globe
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { LaunchHeader } from '../components/LaunchHeader';
import { LaunchFooter } from '../components/LaunchFooter';

const LiveShowcaseSection = lazy(() => import('../components/LiveShowcaseSection'));

export interface SampleItem {
  id: string;
  title: string;
  category: string;
  condition: string;
  campusInfo: string;
  type: 'For Sale' | 'Donate' | 'Exchange';
  price: string;
  image: string;
}

export function Launch() {
  
  // Local state for sample cards wishlist
  const [sampleWishlist, setSampleWishlist] = useState<Record<string, boolean>>({});
  
  // Active campus spot for the meetup section
  const [selectedSpot, setSelectedSpot] = useState<string>('Main Gate');

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleSampleWishlist = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSampleWishlist(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Exact 4 featured items matching the reference screenshot
  const sampleItems: SampleItem[] = [
    {
      id: 'sample-calc',
      title: 'Casio Scientific Calculator',
      category: 'Electronics',
      condition: 'Like New',
      campusInfo: 'Hostel 3 • Library Foyer',
      type: 'For Sale',
      price: '₹450',
      image: '/images/landing/casio-calculator.webp',
    },
    {
      id: 'sample-math',
      title: 'Engineering Mathematics',
      category: 'Textbooks',
      condition: 'Good',
      campusInfo: 'Mechanical Dept',
      type: 'For Sale',
      price: '₹300',
      image: '/images/landing/engineering-math.webp',
    },
    {
      id: 'sample-coat',
      title: 'Lab Coat (Size M)',
      category: 'Lab Essentials',
      condition: 'Good',
      campusInfo: 'Chemistry Lab',
      type: 'Donate',
      price: 'Free',
      image: '/images/landing/lab-coat.webp',
    },
    {
      id: 'sample-arduino',
      title: 'Arduino Kit',
      category: 'Electronics',
      condition: 'Like New',
      campusInfo: 'ECE Department',
      type: 'Exchange',
      price: 'Exchange',
      image: '/images/landing/arduino-kit.webp',
    },
  ];

  // 5 Flexible exchange options matching the reference screenshot
  const studentActions = [
    {
      title: 'Sell',
      icon: Tag,
      description: 'Sell items you no longer need at fair student prices.',
    },
    {
      title: 'Borrow',
      icon: Clock,
      description: 'Borrow items for short-term lab, exam, or course needs.',
    },
    {
      title: 'Donate',
      icon: HeartHandshake,
      description: 'Pass forward notes, books, or supplies to junior students.',
    },
    {
      title: 'Exchange',
      icon: Repeat,
      description: 'Swap course materials or equipment directly with peers.',
    },
    {
      title: 'Request',
      icon: HelpCircle,
      description: "Post what you're looking for and let campus peers find it.",
    },
  ];

  // Exactly 8 campus meetup locations in order
  const campusSpots = [
    { name: 'Main Gate', tip: 'Prominent campus entrance, well-staffed and easily accessible for day scholars and hostellers.' },
    { name: 'Hostel Gate', tip: 'Convenient gate near hostel blocks, ideal for evening and resident handoffs.' },
    { name: 'Back Gate', tip: 'Quiet campus exit point with easy access for quick transit and nearby student housing.' },
    { name: 'MIT Library', tip: 'Air-conditioned entrance foyer with quiet surroundings, convenient between lectures.' },
    { name: 'Canteen', tip: 'Central campus dining area with high foot traffic and active seating during breaks.' },
    { name: 'Hanger 1', tip: 'Historic aeronautical hangar landmark, spacious and easily recognizable across campus.' },
    { name: 'Hanger 2', tip: 'Open aerospace engineering hangar area, prominent and convenient between lab sessions.' },
    { name: 'MIT Connect', tip: 'Central student activity and connectivity hub, lively and safe for daytime meetups.' },
  ];

  // 4 Community values matching the reference screenshot
  const communityValues = [
    {
      title: 'Campus-focused',
      icon: Building2,
      description: 'Exclusively for students with verified college emails.',
    },
    {
      title: 'Student-to-student',
      icon: Users,
      description: 'Direct exchanges between peers without commercial sellers.',
    },
    {
      title: 'Local meetups',
      icon: MapPin,
      description: 'Zero shipping fees. Quick handoffs between classes.',
    },
    {
      title: 'Simple exchange',
      icon: Repeat,
      description: 'Sell, donate, borrow or swap what you need with ease.',
    },
  ];

  const activeSpotDetail = campusSpots.find(s => s.name === selectedSpot) || campusSpots[0];

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#252b27] flex flex-col font-sans selection:bg-[#204b39] selection:text-white">
      {/* 1. Header */}
      <LaunchHeader />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="relative overflow-hidden bg-[#f7f6f2] pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24 border-b border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Left Column: Headline and CTA */}
              <div className="lg:col-span-7 space-y-6 sm:space-y-7 text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-[#dedcd4] bg-[#edf1ec] px-3.5 py-1 text-xs font-semibold text-[#204b39]">
                  <span className="h-2 w-2 rounded-full bg-[#204b39]" />
                  Anna University • MIT Campus
                </div>

                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-[#252b27] leading-[1.12]">
                  What you need might<br className="hidden sm:inline" /> already be on campus.
                </h1>

                {/* Subtitle */}
                <p className="text-base sm:text-lg text-[#555d56] max-w-xl leading-relaxed">
                  StudentNeed connects students who need something with students who already have it. Buy, donate, borrow or exchange securely on campus.
                </p>

                {/* Compact process indicator */}
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#252b27]">
                  <span>Find</span>
                  <span className="text-[#204b39]">→</span>
                  <span>Connect</span>
                  <span className="text-[#204b39]">→</span>
                  <span>Meet</span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center rounded-full bg-[#204b39] px-7 py-3 text-sm font-semibold text-white shadow-xs hover:bg-[#183a2c] transition-all active:scale-95 cursor-pointer"
                  >
                    Get Started
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="inline-flex items-center justify-center rounded-full border border-[#dedcd4] bg-white px-7 py-3 text-sm font-semibold text-[#252b27] shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer"
                  >
                    How It Works
                  </button>
                </div>

                {/* Footnote */}
                <p className="text-xs text-[#555d56] pt-0.5">
                  Campus-verified students only • Safe meetups on campus
                </p>
              </div>

              {/* Right Column: Campus handoff photograph and floating calculator listing card */}
              <div className="lg:col-span-5 relative flex justify-center">
                <div className="relative w-full max-w-md mx-auto lg:max-w-none">
                  {/* Hero photograph container */}
                  <div className="overflow-hidden rounded-3xl border border-[#dedcd4] bg-zinc-100 shadow-md aspect-[4/3] relative">
                    <img
                      src="/images/landing/hero-handoff.webp"
                      srcSet="/images/landing/hero-handoff-640.webp 640w, /images/landing/hero-handoff.webp 1200w"
                      sizes="(max-width: 640px) 100vw, 600px"
                      alt="Students exchanging study materials on campus"
                      className="h-full w-full object-cover"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      width={1200}
                      height={896}
                    />
                  </div>

                  {/* Calculator Listing Card overlapping photo at bottom */}
                  <div className="mt-4 sm:-mt-12 sm:relative sm:z-10 rounded-2xl border border-[#dedcd4] bg-white p-5 shadow-lg space-y-3 transition-transform hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf1ec] border border-[#dedcd4] px-2.5 py-0.5 text-[11px] font-semibold text-[#204b39]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#204b39]" />
                        Available nearby on campus
                      </span>
                      <button
                        type="button"
                        onClick={(e) => toggleSampleWishlist('hero-calc', e)}
                        className="rounded-full p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-50 transition-colors cursor-pointer"
                        aria-label="Wishlist calculator"
                      >
                        <Heart
                          className={`h-4 w-4 ${sampleWishlist['hero-calc'] ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`}
                        />
                      </button>
                    </div>

                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-[#252b27] leading-snug">
                        Casio Scientific Calculator
                      </h2>
                      <p className="text-xs text-[#555d56]">fx-991EX • Electronics</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#dedcd4]/60 text-xs">
                      <div className="flex items-center gap-1.5 text-[#555d56]">
                        <MapPin className="h-3.5 w-3.5 text-[#204b39] shrink-0" />
                        <span>Library Foyer / Main Gate</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-base text-[#252b27]">₹450</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 3. How StudentNeed Works */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-white border-b border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-left space-y-2 mb-12">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#555d56]">
                Simple Three-Step Process
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
                How StudentNeed works
              </h2>
              <p className="text-sm sm:text-base text-[#555d56]">
                Exchange items in 3 simple steps without shipping or waiting.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Find */}
              <div className="rounded-2xl border border-[#dedcd4] bg-white p-7 space-y-4 hover:border-[#204b39]/40 transition-colors shadow-2xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf1ec] text-[#204b39]">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#252b27]">Find</h3>
                <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
                  Search campus listings for textbooks, calculators, lab coats, and essentials.
                </p>
              </div>

              {/* Card 2: Connect */}
              <div className="rounded-2xl border border-[#dedcd4] bg-white p-7 space-y-4 hover:border-[#204b39]/40 transition-colors shadow-2xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf1ec] text-[#204b39]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#252b27]">Connect</h3>
                <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
                  Chat directly with the student offering the item. Agree on exchange terms.
                </p>
              </div>

              {/* Card 3: Meet */}
              <div className="rounded-2xl border border-[#dedcd4] bg-white p-7 space-y-4 hover:border-[#204b39]/40 transition-colors shadow-2xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf1ec] text-[#204b39]">
                  <Handshake className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#252b27]">Meet</h3>
                <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
                  Arrange a convenient campus meetup at familiar spots for safe handoffs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. What Students Can Do (Flexible Campus Exchanges) */}
        <section id="campus-exchange" className="py-16 sm:py-20 bg-[#f7f6f2] border-b border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-left space-y-2 mb-10">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#555d56]">
                Flexible Campus Exchanges
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
                What students can do
              </h2>
              <p className="text-sm sm:text-base text-[#555d56]">
                Choose the exchange type that works best for you.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {studentActions.map((action) => (
                <div
                  key={action.title}
                  className="rounded-2xl border border-[#dedcd4] bg-white p-5 flex flex-col justify-between shadow-2xs hover:border-[#204b39]/40 transition-all space-y-3"
                >
                  <div className="space-y-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf1ec] text-[#204b39]">
                      <action.icon className="h-4.5 w-4.5" />
                    </div>
                    <h3 className="text-base font-bold text-[#252b27]">{action.title}</h3>
                    <p className="text-xs text-[#555d56] leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#555d56] mt-6 text-left">
              * Borrow listings are currently informational and handled through student agreement.
            </p>
          </div>
        </section>

        {/* 5. What Can You Find? (Featured Campus Items) */}
        <section id="featured-items" className="py-16 sm:py-20 bg-white border-b border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-left space-y-2 mb-10">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#555d56]">
                Campus Marketplace
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
                What can you find?
              </h2>
              <p className="text-sm sm:text-base text-[#555d56]">
                Textbooks, lab gear, calculators, electronics, and study essentials.
              </p>
            </div>

            {/* Live marketplace listings or curated campus showcase items */}
            <Suspense
              fallback={
                <SampleItemsGrid
                  sampleItems={sampleItems}
                  sampleWishlist={sampleWishlist}
                  toggleSampleWishlist={toggleSampleWishlist}
                />
              }
            >
              <LiveShowcaseSection
                sampleItems={sampleItems}
                sampleWishlist={sampleWishlist}
                toggleSampleWishlist={toggleSampleWishlist}
              />
            </Suspense>

            {/* Bottom link to marketplace */}
            <div className="mt-8 text-center sm:text-left">
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#204b39] hover:text-[#183a2c] hover:underline"
              >
                <span>Browse more listings or post what you need once you've joined with your student email.</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* 6. Built for Campus, Not Shipping (Campus Meetup Section) */}
        <section id="campus-meetup" className="py-16 sm:py-20 bg-[#f7f6f2] border-b border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              {/* Left Column: Campus benefits */}
              <div className="lg:col-span-6 space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-semibold tracking-wider uppercase text-[#555d56]">
                    Campus Meetups
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
                    Built for campus, not shipping.
                  </h2>
                  <p className="text-sm sm:text-base text-[#555d56] leading-relaxed">
                    All exchanges happen in person at familiar campus locations. No courier charges, no delivery delays, no strangers.
                  </p>
                </div>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3 rounded-xl border border-[#dedcd4] bg-white p-3.5 shadow-2xs">
                    <CheckCircle2 className="h-5 w-5 text-[#204b39] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-[#252b27]">Meet at designated, well-lit campus spots</h3>
                      <p className="text-xs text-[#555d56] mt-0.5">
                        Libraries, canteens, and department foyers provide safe environments.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-[#dedcd4] bg-white p-3.5 shadow-2xs">
                    <CheckCircle2 className="h-5 w-5 text-[#204b39] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-[#252b27]">Inspect items before completing exchange</h3>
                      <p className="text-xs text-[#555d56] mt-0.5">
                        Verify condition, working state, and completeness on the spot.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-[#dedcd4] bg-white p-3.5 shadow-2xs">
                    <CheckCircle2 className="h-5 w-5 text-[#204b39] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-[#252b27]">Zero platform commission or hidden fees</h3>
                      <p className="text-xs text-[#555d56] mt-0.5">
                        100% student-to-student. You keep the full value of your items.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Campus spot selector card */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-xs space-y-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#252b27]">
                      Choose a familiar campus spot
                    </h3>
                    <p className="text-xs text-[#555d56] mt-0.5">
                      Select an example campus meetup location:
                    </p>
                  </div>

                  {/* Spot selector chips */}
                  <div className="flex flex-wrap gap-2">
                    {campusSpots.map((spot) => {
                      const isSelected = selectedSpot === spot.name;
                      return (
                        <button
                          key={spot.name}
                          type="button"
                          onClick={() => setSelectedSpot(spot.name)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#204b39] text-white shadow-xs'
                              : 'bg-[#faf9f5] text-[#252b27] border border-[#dedcd4] hover:bg-[#edf1ec]'
                          }`}
                        >
                          <span>{spot.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Spot Details */}
                  <div className="rounded-xl bg-[#edf1ec] border border-[#dedcd4] p-3.5 text-xs space-y-1">
                    <p className="font-semibold text-[#204b39] flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Selected meetup spot: {activeSpotDetail.name}
                    </p>
                    <p className="text-[#555d56]">
                      {activeSpotDetail.tip}
                    </p>
                  </div>

                  <p className="text-xs text-[#555d56]">
                    Students agree on convenient meetup spots within Anna University MIT campus grounds for quick, safe handoffs.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 7. Student Requests Section ("Can't find what you need?") */}
        <section id="requests" className="py-16 sm:py-20 bg-white border-b border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

              {/* Left pitch */}
              <div className="lg:col-span-7 space-y-4">
                <span className="text-xs font-semibold tracking-wider uppercase text-[#555d56]">
                  Student Requests
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
                  Can't find what you need?
                </h2>
                <p className="text-sm sm:text-base text-[#555d56] leading-relaxed max-w-lg">
                  Post a request to the campus board. Fellow students who have the item can message you directly.
                </p>
                <div className="pt-2">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center rounded-full bg-[#204b39] px-7 py-3 text-sm font-semibold text-white shadow-xs hover:bg-[#183a2c] transition-all cursor-pointer"
                  >
                    Get Started
                  </Link>
                </div>
              </div>

              {/* Right sample request preview card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-[#dedcd4] bg-white p-5 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf1ec] border border-[#dedcd4] px-2.5 py-0.5 text-[11px] font-semibold text-[#204b39]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#204b39]" />
                      Active Request
                    </span>
                    <span className="text-[11px] text-[#555d56]">Sample request</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#252b27]">
                      Scientific Calculator
                    </h3>
                    <p className="text-xs text-[#555d56] mt-0.5">
                      Needed by Friday for Semester Exam
                    </p>
                  </div>

                  <div className="text-xs text-[#204b39] font-medium">
                    Willing to pay ₹300–₹400
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#555d56]">
                    <MapPin className="h-3.5 w-3.5 text-[#204b39]" />
                    <span>Hostel 2 • 2nd Year ECE</span>
                  </div>

                  <Link
                    to="/register"
                    className="w-full flex items-center justify-center rounded-xl bg-[#204b39] py-2.5 text-xs font-semibold text-white hover:bg-[#183a2c] transition-colors"
                  >
                    I have this item — Message student
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 8. A Marketplace Made for Students, by Students */}
        <section id="about" className="py-16 sm:py-20 bg-[#f7f6f2] border-b border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-left space-y-2 mb-10">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#555d56]">
                Student Community
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
                A marketplace made for students, by students.
              </h2>
              <p className="text-sm sm:text-base text-[#555d56]">
                Built specifically for university campuses, starting with Anna University.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {communityValues.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#dedcd4] bg-white p-6 space-y-3 shadow-2xs hover:border-[#204b39]/40 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf1ec] text-[#204b39]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#252b27]">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Prominent Deep-Green CTA Banner */}
        <section className="py-16 sm:py-20 bg-[#204b39] text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-balance">
              Your next useful item could be one student away.
            </h2>
            <p className="text-sm sm:text-base text-zinc-200 max-w-xl mx-auto leading-relaxed">
              Join fellow Anna University students on the campus exchange network.
            </p>
            <div className="pt-2">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#204b39] shadow-sm hover:bg-zinc-100 transition-all active:scale-95 cursor-pointer"
              >
                Get Started
              </Link>
            </div>
            <p className="text-xs text-zinc-300">
              Free to use • Anna University student email required
            </p>
          </div>
        </section>

        {/* 10. Contact Information Panel */}
        <section id="contact" className="py-16 sm:py-20 lg:py-24 bg-[#f7f6f2] border-t border-[#dedcd4]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="text-center space-y-2 mb-8 sm:mb-10 max-w-2xl mx-auto">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#555d56] block">
                Contact
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
                Get in touch
              </h2>
              <p className="text-sm sm:text-base text-[#555d56]">
                Have questions, feedback, or need support? We're here for the campus community.
              </p>
            </div>

            <div className="w-full max-w-[900px] mx-auto rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 lg:p-10 shadow-2xs space-y-4 text-center">
              <p className="text-sm sm:text-base text-[#555d56]">
                <strong className="text-[#252b27] font-semibold">For general inquiries:</strong>{' '}
                <a href="mailto:support@studentneed.me" className="text-[#204b39] hover:underline font-medium break-all sm:break-normal">
                  support@studentneed.me
                </a>
              </p>
              <p className="text-sm sm:text-base text-[#555d56]">
                <strong className="text-[#252b27] font-semibold">Campus location:</strong> MIT Campus, Chromepet, Chennai
              </p>
              <p className="text-sm sm:text-base text-[#555d56]">
                <strong className="text-[#252b27] font-semibold">Student moderators:</strong> Active daily
              </p>
              <p className="text-xs sm:text-sm text-[#555d56] pt-4 border-t border-[#dedcd4]/60">
                Notice: StudentNeed is an independent student platform built for campus exchanges.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 11. Footer */}
      <LaunchFooter />
    </div>
  );
}

function SampleItemsGrid({
  sampleItems,
  sampleWishlist,
  toggleSampleWishlist,
}: {
  sampleItems: SampleItem[];
  sampleWishlist: Record<string, boolean>;
  toggleSampleWishlist: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {sampleItems.map((item) => (
        <div
          key={item.id}
          className="group flex flex-col overflow-hidden rounded-2xl border border-[#dedcd4] bg-white shadow-2xs hover:shadow-md hover:border-[#204b39]/40 transition-all"
        >
          <div className="relative aspect-4/3 overflow-hidden bg-zinc-100">
            <img
              src={item.image}
              alt={item.title}
              width={600}
              height={450}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
            <span className="absolute left-3 top-3 inline-block rounded-md bg-[#edf1ec] border border-[#dedcd4] px-2 py-0.5 text-[10px] font-bold text-[#204b39] shadow-2xs">
              {item.type}
            </span>
            <button
              type="button"
              onClick={(e) => toggleSampleWishlist(item.id, e)}
              className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-zinc-400 backdrop-blur-xs transition-colors hover:text-red-500 hover:bg-white cursor-pointer shadow-xs"
              aria-label={`Wishlist ${item.title}`}
            >
              <Heart
                className={`h-4 w-4 ${sampleWishlist[item.id] ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`}
              />
            </button>
          </div>
          <div className="flex flex-1 flex-col p-4 justify-between space-y-3">
            <div>
              <h3 className="line-clamp-2 text-sm font-bold text-[#252b27] group-hover:text-[#204b39] transition-colors leading-snug">
                {item.title}
              </h3>
              <p className="text-xs text-[#555d56] mt-1">
                {item.category} • {item.condition}
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-[#dedcd4]/60 pt-2.5">
              <span className="text-sm font-bold text-[#252b27]">{item.price}</span>
              <span className="text-xs text-[#555d56]">{item.campusInfo}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
