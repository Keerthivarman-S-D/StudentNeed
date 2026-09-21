import { Link } from 'react-router-dom';
import { StudentNeedLogo } from './StudentNeedLogo';

export function AppFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white text-zinc-600 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-2">
            <StudentNeedLogo size="sm" />
            <p className="text-xs text-zinc-500">
              Campus marketplace for Anna University students.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Quick Links</p>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/" className="hover:text-zinc-900 transition-colors">Home</Link></li>
              <li><Link to="/marketplace" className="hover:text-zinc-900 transition-colors">Marketplace</Link></li>
              <li><Link to="/requests" className="hover:text-zinc-900 transition-colors">Requests</Link></li>
              <li><Link to="/create-listing" className="hover:text-zinc-900 transition-colors">Post an Item</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Support</p>
            <ul className="space-y-1.5 text-xs">
              <li><a href="mailto:auth@studentneed.me" className="hover:text-zinc-900 transition-colors">Contact</a></li>
              <li><Link to="/launch#campus-first" className="hover:text-zinc-900 transition-colors">About</Link></li>
              <li><a href="mailto:auth@studentneed.me?subject=StudentNeed%20Report" className="hover:text-zinc-900 transition-colors">Report an Issue</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Legal</p>
            <ul className="space-y-1.5 text-xs text-zinc-400">
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
              <li className="text-zinc-500 pt-1">studentneed.me</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 border-t border-zinc-100 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-400 gap-2">
          <span>© 2026 StudentNeed. All rights reserved.</span>
          <span>MIT Campus • Anna University</span>
        </div>
      </div>
    </footer>
  );
}
