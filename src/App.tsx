import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StudentNeedIcon } from './components/StudentNeedLogo';
import { AdminRoute } from './components/AdminRoute';
import { isProfileComplete } from './lib/validation';

// Eagerly loaded critical landing page
import { Launch } from './pages/Launch';

// Lazy-loaded context providers for authenticated / marketplace routes
const MarketplaceProviders = lazy(() => import('./context/MarketplaceProviders'));

// Lazy-loaded UI chrome for authenticated / marketplace routes
const Navbar = lazy(() => import('./components/Navbar').then(m => ({ default: m.Navbar })));
const NotificationToast = lazy(() => import('./components/NotificationToast').then(m => ({ default: m.NotificationToast })));
const StudentNeedChatbot = lazy(() => import('./components/StudentNeedChatbot').then(m => ({ default: m.StudentNeedChatbot })));

// Route-level Code Splitting for secondary and heavy application pages
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Marketplace = lazy(() => import('./pages/Marketplace').then(m => ({ default: m.Marketplace })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then(m => ({ default: m.VerifyEmail })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));

// Route-level Code Splitting for heavy application pages
const ListingDetail = lazy(() => import('./pages/ListingDetail').then(m => ({ default: m.ListingDetail })));
const CreateListing = lazy(() => import('./pages/CreateListing').then(m => ({ default: m.CreateListing })));
const CreateRequest = lazy(() => import('./pages/CreateRequest').then(m => ({ default: m.CreateRequest })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Requests = lazy(() => import('./pages/Requests').then(m => ({ default: m.Requests })));
const ChatPage = lazy(() => import('./pages/Chat').then(m => ({ default: m.ChatPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const GenUIDemo = lazy(() => import('./pages/GenUIDemo').then(m => ({ default: m.GenUIDemo })));

const PageLoadingFallback = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
    <div className="h-6 w-6 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />
    <span className="text-xs font-medium text-brand-muted">Loading page...</span>
  </div>
);

function AppContent() {
  const { firebaseUser, currentUser, loading } = useAuth();
  const location = useLocation();

  // Public landing, marketing, and legal routes render immediately without being blocked by auth state resolution.
  // For users with an active saved session, we wait on '/' to prevent a flash of logged-out content before hydrating Home.
  const hasSavedSession = typeof window !== 'undefined' && localStorage.getItem('sn_has_session') === 'true';
  const isPublicRoute =
    location.pathname === '/launch' ||
    location.pathname === '/terms' ||
    location.pathname === '/privacy' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname === '/onboarding' ||
    (location.pathname === '/' && !hasSavedSession);

  if (loading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg space-y-4">
        <StudentNeedIcon size="2xl" />
        <div className="flex items-center gap-2 text-sm font-medium text-brand-muted">
          <div className="h-4 w-4 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />
          <span>Loading <strong className="font-semibold text-brand-charcoal">Student<span className="text-brand-teal">Need</span></strong>...</span>
        </div>
      </div>
    );
  }

  const isLaunchExplicit = location.pathname === '/launch';
  const isRootLaunch = location.pathname === '/' && !firebaseUser;
  const isLaunchActive = isLaunchExplicit || isRootLaunch;
  const isAuthPage = ['/login', '/register', '/verify-email', '/onboarding', '/terms', '/privacy'].includes(location.pathname);
  const isWarmBgPage = isAuthPage || location.pathname === '/' || location.pathname === '/launch' || location.pathname === '/marketplace' || location.pathname.startsWith('/listing/') || location.pathname === '/requests' || location.pathname === '/create-request' || location.pathname === '/create-listing' || location.pathname.startsWith('/chat') || location.pathname === '/profile' || location.pathname === '/reserved' || location.pathname === '/onboarding' || location.pathname === '/admin' || location.pathname === '/terms' || location.pathname === '/privacy' || location.pathname === '/genui';
  const hideAppNavbar = isLaunchActive || isAuthPage;

  return (
    <div className={`flex min-h-screen flex-col ${isWarmBgPage ? 'bg-[#f7f6f2]' : 'bg-brand-bg'} ${hideAppNavbar ? '' : 'pb-16 md:pb-0'}`}>
      {!hideAppNavbar && (
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
      )}
      <main className="flex-1">
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route
              path="/"
              element={
                firebaseUser
                  ? isProfileComplete(currentUser)
                    ? <Home />
                    : <Navigate to="/onboarding" replace />
                  : <Launch />
              }
            />
            <Route path="/launch" element={<Launch />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route
              path="/create-listing"
              element={
                <ProtectedRoute>
                  <CreateListing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-request"
              element={
                <ProtectedRoute>
                  <CreateRequest />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reserved"
              element={
                <ProtectedRoute>
                  <Profile defaultTab="reserved" />
                </ProtectedRoute>
              }
            />
            <Route path="/requests" element={<Requests />} />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:chatId"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/genui" element={<GenUIDemo />} />
          </Routes>
        </Suspense>
      </main>
      {location.pathname === '/' && Boolean(firebaseUser) && (
        <Suspense fallback={null}>
          <StudentNeedChatbot />
        </Suspense>
      )}
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const { firebaseUser } = useAuth();

  const hasSavedSession = typeof window !== 'undefined' && localStorage.getItem('sn_has_session') === 'true';
  // Public marketing & auth routes do NOT need AppProvider or NotificationProvider
  const isPublicOnly =
    location.pathname === '/launch' ||
    location.pathname === '/terms' ||
    location.pathname === '/privacy' ||
    (location.pathname === '/' && !hasSavedSession && !firebaseUser) ||
    ['/login', '/register', '/verify-email'].includes(location.pathname) ||
    (location.pathname === '/onboarding' && !firebaseUser);

  if (isPublicOnly) {
    return <AppContent />;
  }

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <MarketplaceProviders>
        <Suspense fallback={null}>
          <NotificationToast />
        </Suspense>
        <AppContent />
      </MarketplaceProviders>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
