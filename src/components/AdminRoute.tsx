import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { currentUser, firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
        <p className="text-sm font-medium text-zinc-600">Verifying administrative credentials...</p>
      </div>
    );
  }

  // If unauthenticated, redirect to login
  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  const userEmail = (firebaseUser.email || currentUser?.email || '').toLowerCase().trim();
  const isAdmin = userEmail === 'admin@student.annauniv.edu';

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Access Restricted</h2>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
            The StudentNeed Moderation Console is strictly restricted to authorized campus administrators. Your account (<span className="font-mono text-zinc-900 font-medium">{userEmail}</span>) does not possess administrative privileges.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/marketplace">
              <Button variant="default" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Return to Campus Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
