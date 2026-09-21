import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Laptop, Beaker, Backpack, ShieldCheck, Zap, Handshake } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ListingCard } from '../components/ListingCard';
import { Button } from '../components/ui/Button';
import { AppFooter } from '../components/AppFooter';

export function Home() {
  const { listings } = useAppContext();
  const recentListings = listings
    .filter(l => 
      (l.status === 'active' || l.status === 'available' || l.status === 'reserved') &&
      Boolean(l.expiresAt) &&
      new Date(l.expiresAt).getTime() > Date.now()
    )
    .slice(0, 4);

  const categories = [
    { name: 'Textbooks', icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
    { name: 'Electronics', icon: Laptop, color: 'bg-purple-100 text-purple-600' },
    { name: 'Lab Essentials', icon: Beaker, color: 'bg-green-100 text-green-600' },
    { name: 'Hostel', icon: Backpack, color: 'bg-orange-100 text-orange-600' },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-charcoal px-4 py-20 sm:px-6 lg:px-8 text-center text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-zinc-900 to-zinc-900"></div>
        <div className="relative mx-auto max-w-3xl space-y-8">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-balance">
            Everything students need. From students who have it.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-zinc-300 sm:text-xl">
            Buy, donate, exchange or request college essentials securely within the MIT campus.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/marketplace">
              <Button size="lg" className="w-full sm:w-auto bg-brand-teal text-white hover:bg-brand-teal-hover shadow-xs active:scale-[0.98]">
                Explore Marketplace
              </Button>
            </Link>
            <Link to="/create-listing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-zinc-700 bg-transparent text-white hover:bg-zinc-800 hover:text-white hover:border-zinc-600">
                Post an Item
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-brand-charcoal mb-8">Popular on Campus</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-8">
          {categories.map((category) => (
            <Link
              key={category.name}
              to={`/marketplace?category=${category.name}`}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-brand-border bg-white p-6 text-center transition-all hover:border-brand-teal/40 hover:shadow-md hover:shadow-brand-teal/5 group"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${category.color} transition-transform group-hover:scale-105`}>
                <category.icon className="h-6 w-6" />
              </div>
              <span className="font-semibold text-brand-charcoal group-hover:text-brand-teal-hover transition-colors">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Listings */}
      <section className="bg-white py-16 border-y border-brand-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-brand-charcoal">Fresh Finds</h2>
            <Link to="/marketplace" className="flex items-center gap-1 text-sm font-semibold text-brand-teal-hover hover:text-brand-teal transition-colors">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recentListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-brand-charcoal sm:text-4xl">How StudentNeed Works</h2>
          <p className="mt-4 text-lg text-brand-muted">The easiest way to exchange items on campus.</p>
        </div>
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal-light text-2xl font-bold text-brand-teal-hover border border-brand-teal-border shadow-xs">
              1
            </div>
            <h3 className="text-xl font-bold text-brand-charcoal">Find</h3>
            <p className="text-brand-muted">Search for what you need or browse categories to see what students are offering.</p>
          </div>
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal-light text-2xl font-bold text-brand-teal-hover border border-brand-teal-border shadow-xs">
              2
            </div>
            <h3 className="text-xl font-bold text-brand-charcoal">Connect</h3>
            <p className="text-brand-muted">Message the student directly through the platform to agree on details.</p>
          </div>
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal-light text-2xl font-bold text-brand-teal-hover border border-brand-teal-border shadow-xs">
              3
            </div>
            <h3 className="text-xl font-bold text-brand-charcoal">Meet</h3>
            <p className="text-brand-muted">Meet up securely on campus at the designated block or hostel to exchange.</p>
          </div>
        </div>
      </section>

      {/* Why StudentNeed */}
      <section className="bg-brand-bg border-t border-brand-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 border border-brand-border shadow-xs hover:border-brand-teal/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal-hover">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-brand-charcoal">Campus Only</h3>
              <p className="text-brand-muted text-sm leading-relaxed">Exclusive to verified MIT students. No strangers, no shipping, just safe campus meetups.</p>
            </div>
            <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 border border-brand-border shadow-xs hover:border-brand-teal/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal-hover">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-brand-charcoal">Fast & Affordable</h3>
              <p className="text-brand-muted text-sm leading-relaxed">Get things quickly without waiting for delivery. Student-friendly prices, always.</p>
            </div>
            <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 border border-brand-border shadow-xs hover:border-brand-teal/30 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal-hover">
                <Handshake className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-brand-charcoal">Sustainable</h3>
              <p className="text-brand-muted text-sm leading-relaxed">Reduce waste by reusing textbooks, electronics, and essentials within the community.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Professional App Footer */}
      <AppFooter />
    </div>
  );
}
