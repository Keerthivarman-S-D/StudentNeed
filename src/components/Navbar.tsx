import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Plus, UserCircle2, MessageSquare, LayoutGrid, ShieldAlert } from 'lucide-react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { StudentNeedLogo } from './StudentNeedLogo';

export function Navbar() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [hasActiveReservation, setHasActiveReservation] = useState(false);

  const isAdmin = currentUser?.email?.toLowerCase() === 'admin@student.annauniv.edu';

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
      <header className="sticky top-0 z-50 hidden border-b border-zinc-200 bg-white/80 backdrop-blur-md md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center">
              <StudentNeedLogo size="md" />
            </Link>
            
            <nav className="flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    location.pathname === link.path 
                      ? "text-brand-teal-hover bg-brand-teal-light font-semibold" 
                      : "text-brand-charcoal hover:text-brand-teal hover:bg-zinc-50"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden lg:block w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-brand-muted" />
              <input
                type="text"
                aria-label="Search campus items"
                placeholder="Search campus..."
                className="h-9 w-full rounded-full border border-brand-border bg-zinc-50 pl-9 pr-4 text-sm text-brand-charcoal outline-none transition-all placeholder:text-brand-muted focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>
            
            <Link
              to="/create-listing"
              className="flex h-9 items-center gap-2 rounded-full bg-brand-teal px-4 text-sm font-semibold text-white shadow-xs transition-all hover:bg-brand-teal-hover active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Post Item
            </Link>
            
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="flex items-center gap-2 rounded-full border border-brand-border p-1 pr-3 hover:bg-zinc-50 transition-colors">
                  <div className="relative">
                    <img 
                      src={currentUser.avatarUrl} 
                      alt={currentUser.name} 
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    {hasActiveReservation && (
                      <span 
                        className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-teal ring-2 ring-white animate-pulse" 
                        title="Active reservation in progress"
                      />
                    )}
                  </div>
                  <span className="text-sm font-medium text-brand-charcoal">{currentUser.name}</span>
                </Link>
                {hasActiveReservation && (
                  <Link 
                    to="/reserved"
                    className="hidden xl:inline-flex items-center rounded-full bg-brand-teal-light px-2.5 py-0.5 text-[10px] font-semibold text-brand-teal-hover border border-brand-teal-border hover:bg-brand-teal-light/80 hover:border-brand-teal transition-colors"
                  >
                    Active Trade
                  </Link>
                )}
              </div>
            ) : (
              <Link to="/login" className="text-sm font-medium text-brand-charcoal hover:text-brand-teal transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 block border-t border-brand-border bg-white pb-safe pt-2 md:hidden">
        <nav className="flex items-center justify-around px-2 pb-2">
          <Link to="/" className={cn("flex flex-col items-center gap-1 p-2 text-brand-muted", location.pathname === '/' && "text-brand-teal font-semibold")}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link to="/marketplace" className={cn("flex flex-col items-center gap-1 p-2 text-brand-muted", location.pathname === '/marketplace' && "text-brand-teal font-semibold")}>
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-medium">Explore</span>
          </Link>
          <Link to="/create-listing" aria-label="Post Item" className="group -mt-6 flex flex-col items-center p-2 text-brand-charcoal">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-white shadow-lg shadow-brand-teal/30 transition-transform active:scale-95 hover:bg-brand-teal-hover">
              <Plus className="h-6 w-6" />
            </div>
          </Link>
          <Link to="/requests" className={cn("flex flex-col items-center gap-1 p-2 text-brand-muted", location.pathname === '/requests' && "text-brand-teal font-semibold")}>
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">Requests</span>
          </Link>
          <Link to={currentUser ? "/profile" : "/login"} className={cn("flex flex-col items-center gap-1 p-2 text-brand-muted", location.pathname.includes('/profile') && "text-brand-teal font-semibold")}>
            <div className="relative">
              <UserCircle2 className="h-5 w-5" />
              {hasActiveReservation && (
                <span 
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-teal ring-1 ring-white animate-pulse" 
                  title="Active reservation"
                />
              )}
            </div>
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className={cn("flex flex-col items-center gap-1 p-2 text-purple-600", location.pathname === '/admin' && "text-purple-900 font-bold")}>
              <ShieldAlert className="h-5 w-5" />
              <span className="text-[10px] font-medium">Admin</span>
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
