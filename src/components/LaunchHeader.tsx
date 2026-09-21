import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { StudentNeedLogo } from './StudentNeedLogo';

export function LaunchHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

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
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Branding */}
        <Link 
          to="/" 
          className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-lg"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <StudentNeedLogo size="lg" iconClassName="group-hover:scale-105" />
        </Link>

        {/* Center / Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer focus:outline-none"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('campus-first')}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer focus:outline-none"
          >
            About
          </button>
          <button
            onClick={() => scrollToSection('contact')}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer focus:outline-none"
          >
            Contact
          </button>
        </nav>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="px-3.5 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 transition-all hover:gap-2 active:scale-95"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/login"
            className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
          >
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-zinc-200 bg-white px-4 pt-2 pb-6 md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-3 pt-2">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left py-2 text-base font-medium text-zinc-700 hover:text-zinc-900 border-b border-zinc-100"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('campus-first')}
              className="text-left py-2 text-base font-medium text-zinc-700 hover:text-zinc-900 border-b border-zinc-100"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="text-left py-2 text-base font-medium text-zinc-700 hover:text-zinc-900 border-b border-zinc-100"
            >
              Contact
            </button>

            <div className="pt-3 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 transition-colors"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center rounded-xl border border-zinc-300 bg-white py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
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
