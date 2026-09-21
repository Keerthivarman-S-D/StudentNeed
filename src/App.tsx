import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StudentNeedChatbot } from './components/StudentNeedChatbot';
import { StudentNeedIcon } from './components/StudentNeedLogo';

// Page Imports
import { Launch } from './pages/Launch';
import { Home } from './pages/Home';
import { Marketplace } from './pages/Marketplace';
import { ListingDetail } from './pages/ListingDetail';
import { CreateListing } from './pages/CreateListing';
import { CreateRequest } from './pages/CreateRequest';
import { Login } from './pages/Login';
import { VerifyEmail } from './pages/VerifyEmail';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { Requests } from './pages/Requests';
import { ChatPage } from './pages/Chat';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminRoute } from './components/AdminRoute';

function AppContent() {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 space-y-4">
        <StudentNeedIcon size="2xl" />
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
          <div className="h-4 w-4 rounded-full border-2 border-[#19bf96] border-t-transparent animate-spin" />
          <span>Loading <strong className="font-semibold text-zinc-900">Student<span className="text-[#19bf96]">Need</span></strong>...</span>
        </div>
      </div>
    );
  }

  const isLaunchExplicit = location.pathname === '/launch';
  const isRootLaunch = location.pathname === '/' && !firebaseUser;
  const isLaunchActive = isLaunchExplicit || isRootLaunch;

  return (
    <div className={`flex min-h-screen flex-col bg-zinc-50 ${isLaunchActive ? '' : 'pb-16 md:pb-0'}`}>
      {!isLaunchActive && <Navbar />}
      <main className="flex-1">
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
        </Routes>
      </main>
      {!isLaunchActive && <StudentNeedChatbot />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
