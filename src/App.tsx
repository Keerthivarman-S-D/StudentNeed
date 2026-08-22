import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';

// Page Imports
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

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-zinc-50 pb-16 md:pb-0">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/listing/:id" element={<ListingDetail />} />
                <Route path="/create-listing" element={<CreateListing />} />
                <Route path="/create-request" element={<CreateRequest />} />
                <Route path="/login" element={<Login />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/requests" element={<Requests />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
