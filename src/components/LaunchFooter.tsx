import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { StudentNeedLogo } from './StudentNeedLogo';

export function LaunchFooter() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="border-t border-zinc-200 bg-white text-zinc-600">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="flex items-center">
              <StudentNeedLogo size="md" />
            </Link>
            <p className="max-w-sm text-sm text-zinc-500 leading-relaxed">
              Campus marketplace built for students. Connect with peers to find, exchange, and request essential items on campus.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 bg-zinc-100 rounded-md px-2.5 py-1">
                studentneed.me
              </span>
            </div>
          </div>

          {/* Product Col */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-zinc-900 uppercase">
              Product
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="hover:text-zinc-900 transition-colors cursor-pointer text-left"
                >
                  How It Works
                </button>
              </li>
              <li>
                <Link to="/marketplace" className="hover:text-zinc-900 transition-colors inline-flex items-center gap-0.5">
                  Marketplace <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link to="/requests" className="hover:text-zinc-900 transition-colors inline-flex items-center gap-0.5">
                  Requests <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-zinc-900 transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Legal Col */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-zinc-900 uppercase">
              Company & Legal
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => scrollToSection('campus-first')}
                  className="hover:text-zinc-900 transition-colors cursor-pointer text-left"
                >
                  About
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="hover:text-zinc-900 transition-colors cursor-pointer text-left"
                >
                  Contact
                </button>
              </li>
              <li>
                <span className="text-zinc-400 cursor-not-allowed">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="text-zinc-400 cursor-not-allowed">
                  Terms of Service
                </span>
              </li>
            </ul>
          </div>

          {/* Campus Community Col */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-zinc-900 uppercase">
              Campus Community
            </p>
            <p className="text-sm text-zinc-700 font-medium">
              Anna University • MIT Campus
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Madras Institute of Technology, Chromepet, Chennai.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active Campus
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-zinc-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <p>© 2026 StudentNeed. All rights reserved. • studentneed.me</p>
          <p>Exclusively for Anna University & MIT Campus students</p>
        </div>
      </div>
    </footer>
  );
}
