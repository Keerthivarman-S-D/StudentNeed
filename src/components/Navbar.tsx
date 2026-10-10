import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, UserCircle2, MessageSquare, LayoutGrid, ShieldAlert } from 'lucide-react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { StudentNeedLogo } from './StudentNeedLogo';
import { NotificationBell } from './NotificationBell';

export function Navbar() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasActiveReservation, setHasActiveReservation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@student.annauniv.edu';

  // Desktop search handler connecting directly to Marketplace discovery
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate(`/marketplace?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/marketplace');
    }
  };

  // Lightweight active reservation listener strictly limited to 1 doc each
  useEffect(() => {
    if (!currentUser?.id) {
      setHasActiveReservation(false);
      return;
    }

    const qBuyer = query(
      collection(db, 'reservations'),
      where('buyerId', '==', currentUser.id),
      where('status', 'in', ['pending', 'accepted']),
      limit(1)
    );

    const qSeller = query(
      collection(db, 'reservations'),
      where('sellerId', '==', currentUser.id),
      where('status', 'in', ['pending', 'accepted']),
      limit(1)
    );

    let buyerActive = false;
    let sellerActive = false;

    const unsubBuyer = onSnapshot(qBuyer, (snap) => {
      buyerActive = !snap.empty;
      setHasActiveReservation(buyerActive || sellerActive);
    }, (err) => console.warn('Navbar buyer res indicator query:', err));

    const unsubSeller = onSnapshot(qSeller, (snap) => {
      sellerActive = !snap.empty;
      setHasActiveReservation(buyerActive || sellerActive);
    }, (err) => console.warn('Navbar seller res indicator query:', err));

    return () => {
      unsubBuyer();
      unsubSeller();
    };
  }, [currentUser?.id]);

  const navLinks = [
    { name: 'Marketplace', path: '/marketplace', icon: LayoutGrid },
    { name: 'Requests', path: '/requests', icon: MessageSquare },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: ShieldAlert }] : []),
  ];

  return (
    <>
      {/* Desktop Navbar */}
      <header className="sticky top-0 z-50 hidden border-b border-zinc-200/80 bg-white/90 backdrop-blur-md md:block shadow-2xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link 
              to="/" 
              className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              aria-label="StudentNeed Home"
            >
              <StudentNeedLogo size="md" />
            </Link>
            
            <nav className="flex items-center gap-1.5" aria-label="Main Navigation">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={cn(
                      "rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                      isActive 
                        ? "text-emerald-900 bg-emerald-50 border border-emerald-200 shadow-2xs" 
                        : "text-zinc-700 hover:text-emerald-800 hover:bg-zinc-50"
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Functional Desktop Search Form */}
            <form onSubmit={handleSearchSubmit} className="relative hidden lg:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search campus items"
                placeholder="Search campus..."
                className="h-10 w-full rounded-xl border border-brand-border bg-zinc-50/80 pl-9 pr-4 text-sm text-brand-charcoal outline-none transition-all placeholder:text-zinc-400 focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20 shadow-2xs"
              />
            </form>
            
            <Link
              to="/create-listing"
              className="flex h-10 items-center gap-2 rounded-xl bg-brand-teal px-4 text-sm font-bold text-white shadow-xs transition-all hover:bg-brand-teal-hover motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Post Item
            </Link>
            
            {currentUser ? (
              <div className="flex items-center gap-3">
                <NotificationBell />
                <Link 
                  to="/profile" 
                  className="flex items-center gap-2 rounded-xl border border-brand-border p-1 pr-3 hover:bg-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                  aria-label={`Profile of ${currentUser.name}`}
                >
                  <div className="relative">
                    {currentUser.avatarUrl ? (
                      <img 
                        src={currentUser.avatarUrl} 
                        alt={currentUser.name} 
                        className="h-8 w-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-charcoal text-white text-xs font-bold">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {hasActiveReservation && (
                      <span 
                        className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-teal ring-2 ring-white motion-safe:animate-pulse" 
                        title="Active reservation in progress"
                      />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-brand-charcoal truncate max-w-[120px]">{currentUser.name}</span>
                </Link>
                {hasActiveReservation && (
                  <Link 
                    to="/reserved"
                    className="hidden xl:inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
                  >
                    Active Trade
                  </Link>
                )}
              </div>
            ) : (
              <Link 
                to="/login" 
                className="text-sm font-semibold text-brand-charcoal hover:text-emerald-800 transition-colors px-3 py-2 rounded-lg hover:bg-zinc-50"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-brand-border bg-white/95 px-4 backdrop-blur-md md:hidden shadow-2xs">
        <Link 
          to="/" 
          className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-lg"
          aria-label="StudentNeed Home"
        >
          <StudentNeedLogo size="sm" />
        </Link>
        <div className="flex items-center gap-2.5">
          {currentUser && <NotificationBell />}
          <Link
            to="/create-listing"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-teal text-white shadow-xs motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            aria-label="Post Item"
          >
            <Plus className="h-4.5 w-4.5" />
          </Link>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 block border-t border-brand-border bg-white/95 backdrop-blur-md pb-safe pt-1.5 md:hidden shadow-lg">
        <nav className="flex items-center justify-around px-2 pb-1.5" aria-label="Mobile Navigation">
          {/* Home */}
          <Link 
            to="/" 
            className={cn(
              "flex flex-col items-center gap-0.5 p-1.5 min-w-[56px] transition-colors", 
              location.pathname === '/' 
                ? "text-emerald-800 font-bold" 
                : "text-zinc-600 hover:text-brand-charcoal"
            )}
            aria-current={location.pathname === '/' ? 'page' : undefined}
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">Home</span>
            {location.pathname === '/' && <span className="h-1 w-1 rounded-full bg-emerald-700 mt-0.5" />}
          </Link>

          {/* Explore / Marketplace */}
          <Link 
            to="/marketplace" 
            className={cn(
              "flex flex-col items-center gap-0.5 p-1.5 min-w-[56px] transition-colors", 
              location.pathname === '/marketplace' 
                ? "text-emerald-800 font-bold" 
                : "text-zinc-600 hover:text-brand-charcoal"
            )}
            aria-current={location.pathname === '/marketplace' ? 'page' : undefined}
          >
            <Search className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">Explore</span>
            {location.pathname === '/marketplace' && <span className="h-1 w-1 rounded-full bg-emerald-700 mt-0.5" />}
          </Link>

          {/* Elevated Center Post Button */}
          <Link 
            to="/create-listing" 
            aria-label="Post an Item" 
            className="group -mt-5 flex flex-col items-center p-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal text-white shadow-lg shadow-brand-teal/35 transition-transform motion-safe:active:scale-90 hover:bg-brand-teal-hover border-2 border-white">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-[9px] font-bold text-zinc-500 mt-0.5">Post</span>
          </Link>

          {/* Requests */}
          <Link 
            to="/requests" 
            className={cn(
              "flex flex-col items-center gap-0.5 p-1.5 min-w-[56px] transition-colors", 
              location.pathname === '/requests' 
                ? "text-emerald-800 font-bold" 
                : "text-zinc-600 hover:text-brand-charcoal"
            )}
            aria-current={location.pathname === '/requests' ? 'page' : undefined}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">Requests</span>
            {location.pathname === '/requests' && <span className="h-1 w-1 rounded-full bg-emerald-700 mt-0.5" />}
          </Link>

          {/* Profile */}
          <Link 
            to={currentUser ? "/profile" : "/login"} 
            className={cn(
              "flex flex-col items-center gap-0.5 p-1.5 min-w-[56px] transition-colors", 
              location.pathname.includes('/profile') 
                ? "text-emerald-800 font-bold" 
                : "text-zinc-600 hover:text-brand-charcoal"
            )}
            aria-current={location.pathname.includes('/profile') ? 'page' : undefined}
          >
            <div className="relative">
              <UserCircle2 className="h-5 w-5" />
              {hasActiveReservation && (
                <span 
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-teal ring-1 ring-white motion-safe:animate-pulse" 
                  title="Active reservation"
                />
              )}
            </div>
            <span className="text-[10px] tracking-tight">Profile</span>
            {location.pathname.includes('/profile') && <span className="h-1 w-1 rounded-full bg-emerald-700 mt-0.5" />}
          </Link>

          {/* Admin (Only if Admin Role) */}
          {isAdmin && (
            <Link 
              to="/admin" 
              className={cn(
                "flex flex-col items-center gap-0.5 p-1.5 min-w-[56px] transition-colors text-purple-700", 
                location.pathname === '/admin' && "text-purple-950 font-bold"
              )}
              aria-current={location.pathname === '/admin' ? 'page' : undefined}
            >
              <ShieldAlert className="h-5 w-5" />
              <span className="text-[10px] tracking-tight">Admin</span>
              {location.pathname === '/admin' && <span className="h-1 w-1 rounded-full bg-purple-700 mt-0.5" />}
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
