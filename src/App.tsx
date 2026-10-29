import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navbar } from './components/Navbar';
import { NotificationToast } from './components/NotificationToast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StudentNeedChatbot } from './components/StudentNeedChatbot';
import { StudentNeedIcon } from './components/StudentNeedLogo';
import { AdminRoute } from './components/AdminRoute';

// Eagerly loaded critical landing / auth pages
import { Launch } from './pages/Launch';
import { Home } from './pages/Home';
import { Marketplace } from './pages/Marketplace';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VerifyEmail } from './pages/VerifyEmail';
import { Onboarding } from './pages/Onboarding';

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
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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
  const isAuthPage = ['/login', '/register', '/verify-email'].includes(location.pathname);
  const isWarmBgPage = isAuthPage || location.pathname === '/' || location.pathname === '/launch' || location.pathname === '/marketplace' || location.pathname.startsWith('/listing/') || location.pathname === '/requests' || location.pathname === '/create-request' || location.pathname === '/create-listing' || location.pathname.startsWith('/chat') || location.pathname === '/profile' || location.pathname === '/reserved' || location.pathname === '/onboarding' || location.pathname === '/admin' || location.pathname === '/terms' || location.pathname === '/privacy' || location.pathname === '/genui';
  const hideAppNavbar = isLaunchActive || isAuthPage;

  return (
    <div className={`flex min-h-screen flex-col ${isWarmBgPage ? 'bg-[#f7f6f2]' : 'bg-brand-bg'} ${hideAppNavbar ? '' : 'pb-16 md:pb-0'}`}>
      <NotificationToast />
      {!hideAppNavbar && <Navbar />}
      <main className="flex-1">
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={firebaseUser ? <Home /> : <Launch />} />
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
      {location.pathname === '/' && Boolean(firebaseUser) && <StudentNeedChatbot />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <NotificationProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </NotificationProvider>
      </AppProvider>
    </AuthProvider>
  );
}
