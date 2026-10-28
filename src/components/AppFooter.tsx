import { Link } from 'react-router-dom';
import { StudentNeedLogo } from './StudentNeedLogo';

export function AppFooter() {
  return (
    <footer className="border-t border-[#dedcd4] bg-white text-[#555d56] mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-2">
            <StudentNeedLogo size="sm" />
            <p className="text-xs text-[#717870]">
              Campus marketplace for Anna University students.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#252b27] uppercase tracking-wider">Quick Links</p>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Home</Link></li>
              <li><Link to="/marketplace" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Marketplace</Link></li>
              <li><Link to="/requests" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Requests</Link></li>
              <li><Link to="/create-listing" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Post an Item</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#252b27] uppercase tracking-wider">Support</p>
            <ul className="space-y-1.5 text-xs">
              <li><a href="mailto:auth@studentneed.me" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Contact</a></li>
              <li><Link to="/launch#campus-first" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">About</Link></li>
              <li><a href="mailto:auth@studentneed.me?subject=StudentNeed%20Report" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Report an Issue</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#252b27] uppercase tracking-wider">Legal</p>
            <ul className="space-y-1.5 text-xs text-[#717870]">
              <li><Link to="/privacy" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:underline">Terms of Service</Link></li>
              <li className="text-[#555d56] font-medium pt-1">studentneed.me</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 border-t border-[#dedcd4] pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#717870] gap-2">
          <span>© 2026 StudentNeed. All rights reserved.</span>
          <span>MIT Campus • Anna University</span>
        </div>
      </div>
    </footer>
  );
}
