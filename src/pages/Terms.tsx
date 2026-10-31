import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  ShieldCheck,
  Scale,
  Users,
  MapPin,
  AlertTriangle,
  FileText,
  CheckCircle2,
  HelpCircle,
  Clock
} from 'lucide-react';
import { AppFooter } from '../components/AppFooter';

export function Terms() {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    // 1. If opened in a new window/tab, attempt to close it to return to the active StudentNeed tab
    if (window.opener && !window.opener.closed) {
      try {
        window.close();
        return;
      } catch (_) {}
    }

    // Try closing if opened as a target="_blank" window
    try {
      window.close();
    } catch (_) {}

    // 2. If the user navigated within this tab's history, return to previous page (e.g. /register)
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    // 3. Fallback: navigate to /register if unauthenticated, or / if authenticated
    navigate(firebaseUser ? '/' : '/register');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f7f6f2] text-[#252b27]">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Back Link */}
        <Link
          to={firebaseUser ? '/' : '/register'}
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#204b39] hover:text-[#183a2c] hover:underline transition-colors mb-6 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] rounded cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-x-1" />
          <span>Back to StudentNeed</span>
        </Link>

        {/* Header Banner */}
        <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-10 shadow-2xs mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#edf1ec] border border-[#dedcd4] px-3 py-1 text-xs font-bold text-[#204b39] mb-4">
            <Scale className="h-3.5 w-3.5" />
            <span>Campus Legal Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#252b27]">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#555d56] leading-relaxed max-w-2xl">
            Guidelines and responsibilities for buying, donating, borrowing, and exchanging college essentials within the MIT campus community.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-[#555d56]">
            <Clock className="h-3.5 w-3.5" />
            <span>Last updated: October 2026 • Madras Institute of Technology (Anna University)</span>
          </div>
        </div>

        {/* Independent Platform Notice Callout */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 sm:p-6 mb-8 text-xs sm:text-sm text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Independent Student Initiative Notice</span>
          </div>
          <p className="leading-relaxed">
            StudentNeed is an independent, student-created platform designed to help peers connect and share academic supplies.
            It is not an official Anna University administration service, commercial subsidiary, or institutional department.
            Anna University email authentication is utilized solely to verify student eligibility and foster peer trust.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-6 sm:space-y-8">
          {/* Section 1 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <Users className="h-5 w-5 text-[#204b39]" />
              <h2>1. Account Eligibility & Campus Access</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              StudentNeed is exclusively available to actively enrolled students of Madras Institute of Technology (MIT), Anna University.
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li>Registration requires authentication with a genuine <code className="text-[#204b39] font-semibold bg-[#edf1ec] px-1 py-0.5 rounded">@student.annauniv.edu</code> email address.</li>
              <li>You may register and maintain only one account. Creating multiple accounts or impersonating other students is strictly prohibited.</li>
              <li>You are responsible for keeping your login credentials secure and for all actions taken under your account.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <FileText className="h-5 w-5 text-[#204b39]" />
              <h2>2. Marketplace Purpose & Permitted Items</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              The platform is built to circulate academic and campus essentials between senior and junior batches at affordable, student-friendly prices.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-3.5">
                <span className="font-semibold text-xs text-[#204b39] block mb-1">✓ Permitted Categories</span>
                <span className="text-xs text-[#555d56] leading-snug block">Textbooks, lab coats, calculators, drafting kits, development boards, stationery, hostel gear, and campus wear.</span>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5">
                <span className="font-semibold text-xs text-red-800 block mb-1">✕ Prohibited Listings</span>
                <span className="text-xs text-red-700 leading-snug block">Commercial wholesale, forged academic papers, leaked exams, weapons, alcohol, prescription drugs, or illegal items.</span>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <CheckCircle2 className="h-5 w-5 text-[#204b39]" />
              <h2>3. Listing Accuracy & Fair Pricing</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              When posting an item for sale, donation, or exchange, you agree to:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li>Accurately describe the item's true condition, edition, and any wear or defects.</li>
              <li>Provide genuine, clear photographs of the actual item whenever possible.</li>
              <li>Price items reasonably for fellow students. Free items must be marked as <strong>Donate</strong>, and item swaps as <strong>Exchange</strong>.</li>
              <li>Mark items as reserved or remove listings once an exchange has been completed.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <MapPin className="h-5 w-5 text-[#204b39]" />
              <h2>4. Campus Meetups & Exchange Safety</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              StudentNeed eliminates shipping fees and courier risks through quick in-person campus meetups.
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li>Meetups should strictly be coordinated at approved campus landmarks: <strong>Main Gate, Hostel Gate, Back Gate, MIT Library, or Canteen</strong>.</li>
              <li>Coordinate meetings during daylight hours in public, populated areas.</li>
              <li>Always inspect the item thoroughly before making payment or completing an exchange.</li>
              <li>Never wire funds in advance to someone claiming they will courier an item from off-campus.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <ShieldCheck className="h-5 w-5 text-[#204b39]" />
              <h2>5. Direct Peer-to-Peer Transactions & Disclaimers</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              All transactions, prices, and trades are agreed directly between individual students.
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li>StudentNeed does not process payments, hold funds in escrow, take commissions, or provide post-purchase warranties.</li>
              <li>We do not guarantee the condition, safety, or suitability of items listed by users.</li>
              <li>Any disputes regarding the price, quality, or return of an item must be settled amicably between the buyer and seller.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <HelpCircle className="h-5 w-5 text-[#204b39]" />
              <h2>6. Community Moderation & Account Suspension</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              To keep StudentNeed safe and friendly for all students, we reserve the right to remove listings, suspend accounts, or revoke access for users who:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li>Engage in harassment, abusive language, or fraudulent claims in in-app chat.</li>
              <li>Fail to show up for agreed reservations repeatedly without notice.</li>
              <li>Post prohibited, misleading, or non-student commercial content.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <Scale className="h-5 w-5 text-[#204b39]" />
              <h2>7. Contact & Inquiries</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              If you have questions about these terms or wish to report a safety concern, please reach out to our campus moderator team at:
            </p>
            <div className="pt-1">
              <a
                href="mailto:studentneed.info@gmail.com"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#2563EB] hover:underline"
              >
                studentneed.info@gmail.com
              </a>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
