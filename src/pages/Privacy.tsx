import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Database,
  UserCheck,
  Mail,
  Clock,
  BellRing,
  Trash2
} from 'lucide-react';
import { AppFooter } from '../components/AppFooter';

export function Privacy() {
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
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Data Protection & Privacy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#252b27]">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#555d56] leading-relaxed max-w-2xl">
            How StudentNeed collects, handles, stores, and protects your information as an Anna University campus marketplace member.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-[#555d56]">
            <Clock className="h-3.5 w-3.5" />
            <span>Last updated: October 2026 • Madras Institute of Technology (Anna University)</span>
          </div>
        </div>

        {/* Privacy Commitment Callout */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5 sm:p-6 mb-8 text-xs sm:text-sm text-emerald-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#204b39]">
            <Lock className="h-4 w-4 text-[#204b39] shrink-0" />
            <span>Our Campus Privacy Principle</span>
          </div>
          <p className="leading-relaxed text-emerald-900">
            StudentNeed is built for students, not data brokers. We collect only what is strictly necessary to authenticate your active enrollment, display your listings, and facilitate direct campus handoffs. We never sell or license your personal information to third-party advertisers.
          </p>
        </div>

        {/* Policy Sections */}
        <div className="space-y-6 sm:space-y-8">
          {/* Section 1 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <Database className="h-5 w-5 text-[#204b39]" />
              <h2>1. Information We Collect</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              When using StudentNeed, we collect the following categories of information:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-4">
                <span className="font-semibold text-xs text-[#204b39] block mb-1">Account & Identity</span>
                <p className="text-xs text-[#555d56] leading-relaxed">
                  Your full name, official student email (<code className="text-[#204b39] bg-[#edf1ec] px-1 py-0.5 rounded">@student.annauniv.edu</code>), year of study, optional student bio, and profile picture avatar.
                </p>
              </div>
              <div className="rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-4">
                <span className="font-semibold text-xs text-[#204b39] block mb-1">Listings & Requests</span>
                <p className="text-xs text-[#555d56] leading-relaxed">
                  Item titles, descriptions, categories, price, condition, preferred meetup landmarks on campus, and item photos uploaded by you.
                </p>
              </div>
              <div className="rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-4">
                <span className="font-semibold text-xs text-[#204b39] block mb-1">In-App Chat & Reservations</span>
                <p className="text-xs text-[#555d56] leading-relaxed">
                  Messages exchanged with other students in conversation threads, along with reservation request states (pending, accepted, completed).
                </p>
              </div>
              <div className="rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-4">
                <span className="font-semibold text-xs text-[#204b39] block mb-1">Browser Notifications</span>
                <p className="text-xs text-[#555d56] leading-relaxed">
                  Service worker push notification endpoints if you explicitly grant permission to receive real-time reservation updates.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <UserCheck className="h-5 w-5 text-[#204b39]" />
              <h2>2. Student Email Verification (OTP)</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              To keep StudentNeed exclusive to verified students and prevent unauthorized outsiders from accessing student data:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li>Registration requires entering a 6-digit one-time password (OTP) sent directly to your <code className="text-[#204b39] font-medium bg-[#edf1ec] px-1 py-0.5 rounded">@student.annauniv.edu</code> address.</li>
              <li>We never ask for or store your official Anna University portal passwords.</li>
              <li>Email verification is handled securely using automated verification tokens that expire after 10 minutes.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <BellRing className="h-5 w-5 text-[#204b39]" />
              <h2>3. How We Use Your Data</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              Your information is used strictly to power core campus marketplace functionality:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li>Displaying your listings, requests, and student profile to verified MIT campus peers.</li>
              <li>Enabling in-app real-time messaging so students can arrange meetup times and ask questions.</li>
              <li>Managing item reservations to temporarily lock an item while students coordinate handoffs.</li>
              <li>Protecting the campus community from spam, fraudulent listings, and non-student accounts.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <Lock className="h-5 w-5 text-[#204b39]" />
              <h2>4. Security Architecture & Firebase Infrastructure</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              StudentNeed is powered by modern cloud infrastructure with strict access controls:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li><strong>Firebase Authentication:</strong> User passwords are encrypted, salted, and hashed using Google's secure authentication service. Passwords are never stored in plaintext.</li>
              <li><strong>Cloud Firestore Security Rules:</strong> Server-enforced rules ensure private conversations are only readable by the two students participating in the chat. Unauthenticated access is completely blocked.</li>
              <li><strong>Cloudinary Image Delivery:</strong> Item photographs and avatars are stored securely on Cloudinary and delivered over HTTPS.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <Trash2 className="h-5 w-5 text-[#204b39]" />
              <h2>5. Your Rights & Data Retention</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              You maintain full control over your information on StudentNeed:
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-[#555d56] space-y-1.5 leading-relaxed">
              <li><strong>Edit Profile:</strong> You can modify your name, year of study, bio, or avatar anytime via Account Settings.</li>
              <li><strong>Manage Listings:</strong> You can edit details or permanently delete any item you posted at any time.</li>
              <li><strong>Account Deletion:</strong> If you graduate or wish to leave the platform, you can request full account deletion and data removal by contacting us.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 text-lg font-bold text-[#204b39]">
              <Mail className="h-5 w-5 text-[#204b39]" />
              <h2>6. Contact & Designated Support Address</h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555d56] leading-relaxed">
              For any privacy inquiries, data export requests, or security reports, please contact our student administrator team at:
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
