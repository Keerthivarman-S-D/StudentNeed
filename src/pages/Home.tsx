import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Laptop, Beaker, Backpack, ShieldCheck, Zap, Handshake } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ListingCard } from '../components/ListingCard';
import { Button } from '../components/ui/Button';

export function Home() {
  const { listings } = useAppContext();
  const recentListings = listings.slice(0, 4);

  const categories = [
    { name: 'Textbooks', icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
    { name: 'Electronics', icon: Laptop, color: 'bg-purple-100 text-purple-600' },
    { name: 'Lab Essentials', icon: Beaker, color: 'bg-green-100 text-green-600' },
    { name: 'Hostel', icon: Backpack, color: 'bg-orange-100 text-orange-600' },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-zinc-900 px-4 py-20 sm:px-6 lg:px-8 text-center text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-zinc-900 to-zinc-900"></div>
        <div className="relative mx-auto max-w-3xl space-y-8">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-balance">
            Everything students need. From students who have it.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400 sm:text-xl">
            Buy, borrow, donate, exchange or request college essentials securely within the MIT campus.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/marketplace">
              <Button size="lg" className="w-full sm:w-auto bg-white text-zinc-900 hover:bg-zinc-100">
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
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-8">Popular on Campus</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-8">
          {categories.map((category) => (
            <Link
              key={category.name}
              to={`/marketplace?category=${category.name}`}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center transition-all hover:border-zinc-300 hover:shadow-md"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${category.color}`}>
                <category.icon className="h-6 w-6" />
              </div>
              <span className="font-semibold text-zinc-900">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Listings */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Fresh Finds</h2>
            <Link to="/marketplace" className="flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
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
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">How StudentNeed Works</h2>
          <p className="mt-4 text-lg text-zinc-600">The easiest way to exchange items on campus.</p>
        </div>
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-2xl font-bold text-zinc-900">1</div>
            <h3 className="text-xl font-bold text-zinc-900">Find</h3>
            <p className="text-zinc-600">Search for what you need or browse categories to see what students are offering.</p>
          </div>
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-2xl font-bold text-zinc-900">2</div>
            <h3 className="text-xl font-bold text-zinc-900">Connect</h3>
            <p className="text-zinc-600">Message the student directly through the platform to agree on details.</p>
          </div>
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-2xl font-bold text-white">3</div>
            <h3 className="text-xl font-bold text-zinc-900">Meet</h3>
            <p className="text-zinc-600">Meet up securely on campus at the designated block or hostel to exchange.</p>
          </div>
        </div>
      </section>

      {/* Why StudentNeed */}
      <section className="bg-zinc-50 border-t border-zinc-200 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 border border-zinc-200">
              <ShieldCheck className="h-8 w-8 text-zinc-900" />
              <h3 className="text-lg font-bold text-zinc-900">Campus Only</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">Exclusive to verified MIT students. No strangers, no shipping, just safe campus meetups.</p>
            </div>
            <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 border border-zinc-200">
              <Zap className="h-8 w-8 text-zinc-900" />
              <h3 className="text-lg font-bold text-zinc-900">Fast & Affordable</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">Get things quickly without waiting for delivery. Student-friendly prices, always.</p>
            </div>
            <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 border border-zinc-200">
              <Handshake className="h-8 w-8 text-zinc-900" />
              <h3 className="text-lg font-bold text-zinc-900">Sustainable</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">Reduce waste by reusing textbooks, electronics, and essentials within the community.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
