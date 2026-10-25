import { Link } from 'react-router-dom';
import { StudentNeedLogo } from './StudentNeedLogo';

export function LaunchFooter() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="border-t border-[#dedcd4] bg-[#f7f6f2] text-[#555d56]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="flex items-center">
              <StudentNeedLogo size="md" />
            </Link>
            <p className="max-w-sm text-sm text-[#717870] leading-relaxed">
              Student-to-student campus marketplace. Buy, sell, borrow, and donate essentials within your college community.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#252b27] bg-white border border-[#dedcd4] rounded-md px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#204b39]" />
                Anna University • MIT Campus
              </span>
            </div>
          </div>

          {/* Explore Column */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[#252b27] uppercase">
              Explore
            </p>
            <ul className="space-y-2 text-sm text-[#555d56]">
              <li>
                <Link to="/marketplace" className="hover:text-[#204b39] transition-colors">
                  All Listings
                </Link>
              </li>
              <li>
                <Link to="/marketplace?category=Textbooks" className="hover:text-[#204b39] transition-colors">
                  Textbooks
                </Link>
              </li>
              <li>
                <Link to="/marketplace?category=Electronics" className="hover:text-[#204b39] transition-colors">
                  Electronics
                </Link>
              </li>
              <li>
                <Link to="/marketplace?category=Lab%20Essentials" className="hover:text-[#204b39] transition-colors">
                  Lab Gear
                </Link>
              </li>
              <li>
                <Link to="/requests" className="hover:text-[#204b39] transition-colors">
                  Student Requests
                </Link>
              </li>
            </ul>
          </div>

          {/* How It Works Column */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[#252b27] uppercase">
              How It Works
            </p>
            <ul className="space-y-2 text-sm text-[#555d56]">
              <li>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="hover:text-[#204b39] transition-colors cursor-pointer text-left"
                >
                  3-Step Process
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('campus-exchange')}
                  className="hover:text-[#204b39] transition-colors cursor-pointer text-left"
                >
                  Campus Exchange
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('campus-meetup')}
                  className="hover:text-[#204b39] transition-colors cursor-pointer text-left"
                >
                  Meetup Spots
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('about')}
                  className="hover:text-[#204b39] transition-colors cursor-pointer text-left"
                >
                  Community Trust
                </button>
              </li>
            </ul>
          </div>

          {/* Campus Community Column */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[#252b27] uppercase">
              Campus Community
            </p>
            <p className="text-sm text-[#252b27] font-medium">
              Madras Institute of Technology
            </p>
            <p className="text-xs text-[#717870] leading-relaxed">
              Anna University, Chromepet, Chennai 600044.
            </p>
            <div className="pt-1">
              <button
                onClick={() => scrollToSection('contact')}
                className="text-xs text-[#204b39] font-semibold hover:underline cursor-pointer"
              >
                Contact Campus Team →
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-[#dedcd4] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#717870]">
          <p>© 2026 StudentNeed. All rights reserved. Built for students, by students.</p>
          <p>Exclusively for Anna University & MIT Campus students</p>
        </div>
      </div>
    </footer>
  );
}
