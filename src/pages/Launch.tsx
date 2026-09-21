import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Search, 
  MessageSquare, 
  Handshake, 
  BookOpen, 
  Laptop, 
  Beaker, 
  Backpack, 
  Tag, 
  Clock, 
  HeartHandshake, 
  Repeat, 
  HelpCircle, 
  MapPin, 
  Building2, 
  Library, 
  UtensilsCrossed, 
  DoorOpen, 
  Mail, 
  Globe, 
  Users, 
  CheckCircle2, 
  ShieldCheck,
  Sparkles,
  Zap,
  PackageCheck
} from 'lucide-react';
import { LaunchHeader } from '../components/LaunchHeader';
import { LaunchFooter } from '../components/LaunchFooter';
import { StudentNeedIcon } from '../components/StudentNeedLogo';

export function Launch() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const studentActions = [
    {
      title: 'Sell',
      icon: Tag,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'List textbooks, lab coats, calculators, or gadgets you no longer need at student-friendly prices.',
    },
    {
      title: 'Borrow',
      icon: Clock,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Connect with peers when you need an item or reference book temporarily for coursework.',
    },
    {
      title: 'Donate',
      icon: HeartHandshake,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Pass useful academic materials, completed notes, and supplies forward to juniors for free.',
    },
    {
      title: 'Exchange',
      icon: Repeat,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      description: 'Swap an item directly for something you need this semester with another student.',
    },
    {
      title: 'Request',
      icon: HelpCircle,
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      description: "Can't find something? Let other students know what you're looking for with an open request.",
    },
  ];

  const categories = [
    {
      title: 'Textbooks',
      icon: BookOpen,
      color: 'bg-blue-50 text-blue-700',
      border: 'hover:border-blue-300',
      description: 'Coursebooks, syllabus guides, semester notes, and reference materials.',
      tags: ['Engineering Mathematics', 'DSP', 'Data Structures', 'Semester Notes'],
    },
    {
      title: 'Electronics',
      icon: Laptop,
      color: 'bg-purple-50 text-purple-700',
      border: 'hover:border-purple-300',
      description: 'Essential gadgets, development boards, components, and study accessories.',
      tags: ['Scientific Calculators', 'Arduino', 'Raspberry Pi', 'Adapters', 'Cables'],
    },
    {
      title: 'Lab Essentials',
      icon: Beaker,
      color: 'bg-emerald-50 text-emerald-700',
      border: 'hover:border-emerald-300',
      description: 'Mandatory workshop gear, lab attire, and drawing instruments.',
      tags: ['Lab Coats', 'Drafting Instruments', 'Engineering Drawing Boards', 'Lab Equipment'],
    },
    {
      title: 'Hostel Essentials',
      icon: Backpack,
      color: 'bg-orange-50 text-orange-700',
      border: 'hover:border-orange-300',
      description: 'Everyday living supplies, room organizers, and student accommodation items.',
      tags: ['Study Lamps', 'Extension Cords', 'Storage Boxes', 'Room Gear'],
    },
  ];

  const meetupLocations = [
    { name: 'Central Library', icon: Library, hint: 'Quiet, central reference spot between lecture blocks' },
    { name: 'CSE Block', icon: Building2, hint: 'Ground floor atrium & department plaza' },
    { name: 'ECE Block', icon: Building2, hint: 'Electronics laboratory quad & corridors' },
    { name: 'Food Court', icon: UtensilsCrossed, hint: 'Open seating area during campus lunch breaks' },
    { name: 'Hostel', icon: Backpack, hint: 'Convenient hostel gates for resident students' },
    { name: 'Main Gate', icon: DoorOpen, hint: 'Accessible rendezvous before heading off-campus' },
  ];

  const trustPrinciples = [
    {
      title: 'Campus-focused',
      description: 'Designed around the MIT / Anna University student community and campus life.',
      icon: Building2,
    },
    {
      title: 'Student-to-student',
      description: 'Direct peer interactions without commercial intermediaries or retail markups.',
      icon: Users,
    },
    {
      title: 'Local meetups',
      description: 'Students can inspect and exchange items locally on familiar campus grounds.',
      icon: MapPin,
    },
    {
      title: 'Simple exchange',
      description: 'Students can coordinate directly through the platform before meeting.',
      icon: Handshake,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col selection:bg-zinc-900 selection:text-white">
      {/* 1. Launch Header */}
      <LaunchHeader />

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="relative overflow-hidden bg-white border-b border-zinc-200/80 pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-24 lg:pb-32">
          {/* Subtle ambient gradient mesh */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-tr from-zinc-200/40 via-emerald-100/30 to-blue-100/40 blur-3xl rounded-full" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Hero Content */}
              <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left">
                {/* Campus Status Badge */}
                <div className="inline-flex items-center gap-2.5 rounded-full border border-zinc-200/80 bg-zinc-50/80 px-3.5 py-1.5 text-xs font-medium text-zinc-700 shadow-xs backdrop-blur-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-semibold text-zinc-900">MIT Campus • Anna University</span>
                  <span className="text-zinc-400">|</span>
                  <span className="text-zinc-500">Student Marketplace</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl text-balance leading-[1.1]">
                  What you need might already be on campus.
                </h1>

                {/* Subtitle */}
                <p className="text-lg text-zinc-600 sm:text-xl max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                  StudentNeed connects students who need something with students who already have it — within the campus.
                </p>

                {/* Find -> Connect -> Meet Badge */}
                <div className="inline-flex items-center justify-center gap-2 sm:gap-3 rounded-xl border border-zinc-200 bg-zinc-100/70 px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-800">
                  <span className="flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 text-zinc-500" /> Find
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-zinc-500" /> Connect
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="flex items-center gap-1.5">
                    <Handshake className="h-3.5 w-3.5 text-zinc-500" /> Meet
                  </span>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <Link
                    to="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 text-base font-semibold text-white shadow-md hover:bg-zinc-800 transition-all hover:gap-3 active:scale-95"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => scrollToSection('how-it-works')}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-3.5 text-base font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
                  >
                    How It Works
                  </button>
                </div>

                {/* Campus note */}
                <p className="text-xs text-zinc-500 pt-1">
                  Exclusively for verified students at Anna University / MIT Campus
                </p>
              </div>

              {/* Right Column: Hero Visual (Lightweight CSS/SVG) */}
              <div className="lg:col-span-5 relative flex justify-center">
                <div className="relative w-full max-w-md">
                  {/* Decorative backdrop glow */}
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-zinc-200 to-zinc-300 opacity-50 blur-xl" />

                  {/* Main Exchange Showcase Card */}
                  <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl space-y-5">
                    {/* Card Header */}
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          Student-to-student exchange
                        </span>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                        Ready to meet
                      </span>
                    </div>

                    {/* Meetup location banner */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50 p-3 border border-zinc-100 text-xs">
                      <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-zinc-900">📍 Meetup at Central Library</p>
                        <p className="text-zinc-500 text-[11px]">Today • Between class hours</p>
                      </div>
                    </div>

                    {/* Item Details */}
                    <div className="flex items-start justify-between gap-3 p-3 rounded-xl border border-zinc-100 bg-white shadow-xs">
                      <div className="space-y-1">
                        <span className="inline-block text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                          Electronics
                        </span>
                        <h4 className="text-sm font-bold text-zinc-900">
                          Casio Scientific Calculator
                        </h4>
                        <p className="font-mono text-xs text-zinc-500">fx-991ES Plus</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-400 block">Offer</span>
                        <span className="text-base font-extrabold text-zinc-900">₹450</span>
                      </div>
                    </div>

                    {/* Peer Connection Graphic */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5 text-center">
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Offering</span>
                        <span className="text-xs font-bold text-zinc-800">Student A • CSE</span>
                      </div>
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5 text-center">
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Receiving</span>
                        <span className="text-xs font-bold text-zinc-800">Student B • ECE</span>
                      </div>
                    </div>

                    {/* Demo preview disclaimer banner */}
                    <div className="text-center pt-1">
                      <span className="text-[10px] font-medium text-zinc-400">
                        Illustrative preview • Demonstrates actual campus handoff flow
                      </span>
                    </div>
                  </div>

                  {/* Floating mini demo card 1 (Textbook) */}
                  <div className="absolute -top-4 -left-4 sm:-left-6 rounded-xl border border-zinc-200 bg-white/95 backdrop-blur-xs p-3 shadow-lg flex items-center gap-2.5 animate-bounce-slow max-w-[200px]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-zinc-900 truncate">Engineering Textbook</p>
                      <p className="text-[10px] text-zinc-500">₹300 • Handshake</p>
                    </div>
                  </div>

                  {/* Floating mini demo card 2 (Lab Coat) */}
                  <div className="absolute -bottom-4 -right-4 sm:-right-6 rounded-xl border border-zinc-200 bg-white/95 backdrop-blur-xs p-3 shadow-lg flex items-center gap-2.5 max-w-[200px]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                      <Beaker className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-zinc-900 truncate">Lab Coat (Size M)</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">Free • Donate</p>
                    </div>
                  </div>

                  {/* Floating mini demo card 3 (Arduino Kit) */}
                  <div className="hidden sm:flex absolute -bottom-6 -left-4 rounded-xl border border-zinc-200 bg-white/95 backdrop-blur-xs p-2.5 shadow-md items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="font-semibold text-zinc-800 text-[11px]">Arduino Kit • Exchange</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. How It Works Section */}
        <section id="how-it-works" className="py-20 sm:py-24 lg:py-28 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200/60 rounded-full px-3 py-1">
                Simple 3-Step Process
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                How StudentNeed works
              </h2>
              <p className="text-base sm:text-lg text-zinc-600">
                Built specifically for simple, in-person student exchanges on campus.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Step 01 - Find */}
              <div className="group rounded-2xl border border-zinc-200/90 bg-white p-8 shadow-xs transition-all hover:border-zinc-300 hover:shadow-md relative">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-2xl font-black text-zinc-300 group-hover:text-zinc-900 transition-colors">
                    01
                  </span>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                    <Search className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">Find</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Search or browse listings to find something you need — textbooks, calculators, lab coats, or electronics.
                </p>
                <div className="mt-6 pt-4 border-t border-zinc-100 text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Filter by campus & category
                </div>
              </div>

              {/* Step 02 - Connect */}
              <div className="group rounded-2xl border border-zinc-200/90 bg-white p-8 shadow-xs transition-all hover:border-zinc-300 hover:shadow-md relative">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-2xl font-black text-zinc-300 group-hover:text-zinc-900 transition-colors">
                    02
                  </span>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">Connect</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Contact another student and discuss the item directly through real-time peer chat to verify condition and terms.
                </p>
                <div className="mt-6 pt-4 border-t border-zinc-100 text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Direct in-app messaging
                </div>
              </div>

              {/* Step 03 - Meet */}
              <div className="group rounded-2xl border border-zinc-200/90 bg-white p-8 shadow-xs transition-all hover:border-zinc-300 hover:shadow-md relative">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-2xl font-black text-zinc-300 group-hover:text-zinc-900 transition-colors">
                    03
                  </span>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                    <Handshake className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">Meet</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Arrange a convenient campus meetup and exchange the item safely at the library, canteen, or department block.
                </p>
                <div className="mt-6 pt-4 border-t border-zinc-100 text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Inspect in person before trade
                </div>
              </div>
            </div>

            {/* Bottom visual indicator */}
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-white rounded-full px-4 py-2 border border-zinc-200 shadow-xs">
                <span>Find</span>
                <span>→</span>
                <span>Connect</span>
                <span>→</span>
                <span>Meet on Campus</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. What Students Can Do */}
        <section className="py-20 sm:py-24 bg-white border-y border-zinc-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 rounded-full px-3 py-1">
                Flexible Campus Exchange
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                What students can do
              </h2>
              <p className="text-base sm:text-lg text-zinc-600">
                Students can list items they no longer need or request items they are looking for.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {studentActions.map((action) => (
                <div
                  key={action.title}
                  className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 flex flex-col justify-between transition-all hover:bg-white hover:border-zinc-300 hover:shadow-sm"
                >
                  <div className="space-y-4">
                    <div className={`inline-flex p-3 rounded-xl border ${action.color}`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">{action.title}</h3>
                    <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-zinc-500 mt-8">
              All interactions occur directly between peer students on the MIT Anna University campus.
            </p>
          </div>
        </section>

        {/* 5. What Can You Find? (Category Showcase) */}
        <section className="py-20 sm:py-24 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-200/60 rounded-full px-3 py-1">
                Campus Essentials
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                What can you find?
              </h2>
              <p className="text-base sm:text-lg text-zinc-600">
                Discover semester essentials, electronics, and supplies available from fellow students.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((cat) => (
                <div
                  key={cat.title}
                  className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition-all hover:shadow-md ${cat.border} flex flex-col justify-between`}
                >
                  <div className="space-y-4">
                    <div className={`inline-flex p-3 rounded-xl ${cat.color}`}>
                      <cat.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">{cat.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">{cat.description}</p>
                    </div>

                    <div className="pt-2">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Common Items:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] font-medium bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Campus-First Section */}
        <section id="campus-first" className="py-20 sm:py-28 bg-white border-y border-zinc-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Campus First explanation */}
              <div className="lg:col-span-6 space-y-6">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 rounded-full px-3 py-1">
                  Local Student Exchange
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                  Built for campus, not shipping.
                </h2>
                <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
                  Traditional e-commerce involves high delivery charges, packaging delays, and uncertainty. StudentNeed is engineered around local student-to-student exchange on campus.
                </p>

                {/* 3 feature cards */}
                <div className="space-y-4 pt-2">
                  <div className="flex gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white font-bold text-sm">
                      01
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-zinc-900">No complicated delivery</h4>
                      <p className="text-xs sm:text-sm text-zinc-600 mt-0.5">
                        No shipping charges, packaging hassles, or tracking numbers to worry about.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white font-bold text-sm">
                      02
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-zinc-900">No waiting for shipping</h4>
                      <p className="text-xs sm:text-sm text-zinc-600 mt-0.5">
                        Students can coordinate exchanges between classes or at their hostel in minutes.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white font-bold text-sm">
                      03
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-zinc-900">Meet on campus</h4>
                      <p className="text-xs sm:text-sm text-zinc-600 mt-0.5">
                        Students can arrange convenient meetup locations at familiar, safe campus spots.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Campus Meetup Visual */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                    <div>
                      <h3 className="font-bold text-zinc-900 text-base sm:text-lg">
                        Campus Meetup Locations
                      </h3>
                      <p className="text-xs text-zinc-500">Popular student handoff reference spots</p>
                    </div>
                    <span className="rounded-md bg-zinc-200/70 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                      MIT Campus
                    </span>
                  </div>

                  {/* Grid of locations */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {meetupLocations.map((loc) => (
                      <div
                        key={loc.name}
                        className="rounded-xl border border-zinc-200 bg-white p-3.5 flex flex-col items-start gap-2 hover:border-zinc-300 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                          <loc.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900 leading-tight">{loc.name}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 leading-snug">
                            {loc.hint}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Explicit Disclaimer */}
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                    <span className="shrink-0 mt-0.5 text-sm">ℹ️</span>
                    <p className="leading-relaxed">
                      <strong>Note:</strong> Example student-chosen reference spots for convenient handoffs. These are suggested meetup landmarks, not official StudentNeed pickup locations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Request Section */}
        <section className="py-20 sm:py-24 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 p-8 sm:p-12 lg:p-16 shadow-xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                {/* Left: Request Pitch */}
                <div className="lg:col-span-7 space-y-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800 bg-rose-100/70 rounded-full px-3 py-1">
                    Student Requests
                  </span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                    Can't find what you need?
                  </h2>
                  <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
                    Post a request and let other students know what you're looking for. When someone on campus has the item, they can connect with you directly.
                  </p>

                  <div className="pt-2">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-zinc-800 transition-colors"
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* Right: Illustrative Request Card Preview */}
                <div className="lg:col-span-5">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-md space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
                        Open Request
                      </span>
                      <span className="text-xs text-zinc-400">UI Demo Preview</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase">Looking for</span>
                        <h4 className="text-lg font-bold text-zinc-900">Scientific Calculator</h4>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-100">
                          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Category</span>
                          <span className="text-xs font-bold text-zinc-800">Electronics</span>
                        </div>
                        <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-100">
                          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Budget</span>
                          <span className="text-xs font-bold text-zinc-800">₹500</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-100">
                          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Location</span>
                          <span className="text-xs font-bold text-zinc-800">MIT Campus</span>
                        </div>
                        <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-100">
                          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Requester</span>
                          <span className="text-xs font-bold text-zinc-800">Student A • 2nd Year</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Link
                        to="/login"
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
                      >
                        I Have This Item — Message Student
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Campus Community / Trust Section */}
        <section className="py-20 sm:py-24 bg-white border-b border-zinc-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 rounded-full px-3 py-1">
                Student Community
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                A marketplace made for students, by students.
              </h2>
              <p className="text-base sm:text-lg text-zinc-600">
                Built specifically around the practical reality of college life and peer sharing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {trustPrinciples.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 space-y-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Final CTA Section */}
        <section className="py-20 sm:py-24 bg-zinc-950 text-white text-center">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl text-balance">
              Your next useful item could be one student away.
            </h2>
            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Join StudentNeed and discover what's already available on your campus.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-zinc-950 shadow-md hover:bg-zinc-100 transition-all hover:gap-3 active:scale-95"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="text-xs text-zinc-500 pt-2">
              Sign in with your official college email address (@student.annauniv.edu)
            </p>
          </div>
        </section>

        {/* 10. Contact Section */}
        <section id="contact" className="py-20 sm:py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center space-y-4 mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 rounded-full px-3 py-1">
                Contact
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                Get in touch
              </h2>
              <p className="text-base text-zinc-600">
                Have questions or feedback about StudentNeed? Connect with the campus team.
              </p>
            </div>

            <div className="max-w-3xl mx-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-8 sm:p-10 shadow-xs space-y-8">
              <div className="flex items-center gap-3">
                <StudentNeedIcon size="xl" />
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-zinc-900">
                    Student<span className="text-[#19bf96]">Need</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Campus marketplace for students</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-zinc-200">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm">
                    <Mail className="h-4 w-4 text-zinc-500" /> Email
                  </div>
                  <a
                    href="mailto:auth@studentneed.me"
                    className="text-xs text-zinc-600 hover:text-zinc-900 underline block"
                  >
                    auth@studentneed.me
                  </a>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm">
                    <Globe className="h-4 w-4 text-zinc-500" /> Website
                  </div>
                  <a
                    href="https://studentneed.me"
                    className="text-xs text-zinc-600 hover:text-zinc-900 underline block"
                  >
                    studentneed.me
                  </a>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm">
                    <MapPin className="h-4 w-4 text-zinc-500" /> Campus
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Madras Institute of Technology (MIT Campus), Anna University, Chromepet, Chennai
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 11. Launch Footer */}
      <LaunchFooter />
    </div>
  );
}
