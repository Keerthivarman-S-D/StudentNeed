import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { StudentNeedLogo } from './StudentNeedLogo';

export function LaunchHeader({ variant }: { variant?: 'landing' | 'auth' } = {}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isAuth = variant === 'auth' || ['/login', '/register', '/verify-email'].includes(location.pathname);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/' && location.pathname !== '/launch') {
      window.location.href = `/#${sectionId}`;
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#eae8e1] bg-[#f7f6f2]/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Branding */}
        <Link
          to="/"
          className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] rounded-lg"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <StudentNeedLogo size="lg" iconClassName="group-hover:scale-105" />
        </Link>

        {/* Center / Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#555d56]">
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="hover:text-[#252b27] transition-colors cursor-pointer focus:outline-none"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="hover:text-[#252b27] transition-colors cursor-pointer focus:outline-none"
          >
            About
          </button>
          <button
            onClick={() => scrollToSection('contact')}
            className="hover:text-[#252b27] transition-colors cursor-pointer focus:outline-none"
          >
            Contact
          </button>
        </nav>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-full bg-[#204b39] px-5 py-2 text-sm font-medium text-white shadow-xs hover:bg-[#183a2c] transition-all active:scale-95 cursor-pointer"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="px-2 py-2 text-sm font-medium text-[#252b27] hover:text-black transition-colors cursor-pointer"
          >
            Sign in
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/register"
            className="inline-flex items-center rounded-full bg-[#204b39] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#183a2c]"
          >
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-[#555d56] hover:bg-[#eae8e1] hover:text-[#252b27] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-[#eae8e1] bg-[#f7f6f2] px-4 pt-2 pb-6 md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-3 pt-2">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left py-2 text-sm font-medium text-[#252b27] hover:text-[#204b39] border-b border-[#eae8e1]/60"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-left py-2 text-sm font-medium text-[#252b27] hover:text-[#204b39] border-b border-[#eae8e1]/60"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="text-left py-2 text-sm font-medium text-[#252b27] hover:text-[#204b39] border-b border-[#eae8e1]/60"
            >
              Contact
            </button>

            <div className="pt-3 flex flex-col gap-2">
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center rounded-full bg-[#204b39] py-2.5 text-sm font-medium text-white shadow-xs hover:bg-[#183a2c] transition-colors"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center rounded-full border border-[#dedcd4] bg-white py-2 text-sm font-medium text-[#252b27] hover:bg-[#eae8e1] transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
