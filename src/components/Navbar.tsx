import { Link, useLocation } from 'react-router-dom';
import { Search, Plus, UserCircle2, MessageSquare, LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { currentUser } = useAuth();
  const location = useLocation();

  const navLinks = [
    { name: 'Marketplace', path: '/marketplace', icon: LayoutGrid },
    { name: 'Requests', path: '/requests', icon: MessageSquare },
  ];

  return (
    <>
      {/* Desktop Navbar */}
      <header className="sticky top-0 z-50 hidden border-b border-zinc-200 bg-white/80 backdrop-blur-md md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white font-bold text-xl leading-none">
                S
              </div>
              <span className="text-xl font-bold tracking-tight text-zinc-900">StudentNeed</span>
            </Link>
            
            <nav className="flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-100",
                    location.pathname === link.path ? "text-zinc-900 bg-zinc-100" : "text-zinc-600"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden lg:block w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search campus..."
                className="h-9 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-9 pr-4 text-sm outline-none transition-all focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>
            
            <Link
              to="/create-listing"
              className="flex h-9 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              Post Item
            </Link>
            
            {currentUser ? (
              <Link to="/profile" className="flex items-center gap-2 rounded-full border border-zinc-200 p-1 pr-3 hover:bg-zinc-50 transition-colors">
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="h-7 w-7 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-zinc-700">{currentUser.name}</span>
              </Link>
            ) : (
              <Link to="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 block border-t border-zinc-200 bg-white pb-safe pt-2 md:hidden">
        <nav className="flex items-center justify-around px-2 pb-2">
          <Link to="/" className={cn("flex flex-col items-center gap-1 p-2 text-zinc-500", location.pathname === '/' && "text-zinc-900")}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link to="/marketplace" className={cn("flex flex-col items-center gap-1 p-2 text-zinc-500", location.pathname === '/marketplace' && "text-zinc-900")}>
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-medium">Explore</span>
          </Link>
          <Link to="/create-listing" className="group -mt-6 flex flex-col items-center p-2 text-zinc-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 transition-transform active:scale-95">
              <Plus className="h-6 w-6" />
            </div>
          </Link>
          <Link to="/requests" className={cn("flex flex-col items-center gap-1 p-2 text-zinc-500", location.pathname === '/requests' && "text-zinc-900")}>
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">Requests</span>
          </Link>
          <Link to={currentUser ? "/profile" : "/login"} className={cn("flex flex-col items-center gap-1 p-2 text-zinc-500", location.pathname.includes('/profile') && "text-zinc-900")}>
            <UserCircle2 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
        </nav>
      </div>
    </>
  );
}
