import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";
import { isProfileComplete } from "../lib/validation";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, firebaseUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
        <p className="text-sm font-medium text-slate-500">Checking campus authorization...</p>
      </div>
    );
  }

  // If not authenticated via Firebase
  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isOnboardingRoute = location.pathname === '/onboarding';
  const profileComplete = isProfileComplete(currentUser);

  // Returning users with completed profiles must not see onboarding again
  if (isOnboardingRoute && profileComplete) {
    return <Navigate to="/marketplace" replace />;
  }

  // First-time users or users with incomplete profiles must complete onboarding before accessing protected routes
  if (!profileComplete && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
