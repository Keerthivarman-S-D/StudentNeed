import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { Button } from '../components/ui/Button';
import { MailCheck, RefreshCcw, LogOut } from 'lucide-react';

export function VerifyEmail() {
  const navigate = useNavigate();
  const { firebaseUser, currentUser, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // If no user, go to login
    if (!firebaseUser) {
      navigate('/login');
    } else if (firebaseUser.emailVerified) {
      // If already verified, move on
      navigate(currentUser ? '/' : '/onboarding');
    }
  }, [firebaseUser, currentUser, navigate]);

  const handleCheckVerified = async () => {
    if (!auth.currentUser) return;
    setIsChecking(true);
    setMessage({ type: '', text: '' });
    
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        navigate(currentUser ? '/' : '/onboarding');
      } else {
        setMessage({ type: 'error', text: "Email is not verified yet. Please check your inbox and click the link." });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || "An error occurred." });
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setIsResending(true);
    setMessage({ type: '', text: '' });
    
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage({ type: 'success', text: "Verification email resent. Check your inbox (and spam folder)." });
    } catch (err: any) {
      // Handle rate limiting (auth/too-many-requests)
      if (err.code === 'auth/too-many-requests') {
         setMessage({ type: 'error', text: "We just sent an email. Please wait a bit before requesting another." });
      } else {
         setMessage({ type: 'error', text: err.message || "Failed to resend email." });
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!firebaseUser) return null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4 border border-indigo-100">
          <MailCheck className="h-10 w-10" />
        </div>
        
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
          Verify your email
        </h2>
        
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-left">
          <p className="text-zinc-600 mb-6 text-center">
            We sent a verification link to <br/>
            <span className="font-semibold text-zinc-900">{firebaseUser.email}</span>
          </p>

          {message.text && (
            <div className={`p-3 mb-6 text-sm rounded-lg border text-center ${message.type === 'error' ? 'text-red-600 bg-red-50 border-red-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <Button onClick={handleCheckVerified} disabled={isChecking} className="w-full gap-2" size="lg">
              <RefreshCcw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : "I've clicked the link"}
            </Button>
            
            <Button onClick={handleResend} disabled={isResending} variant="outline" className="w-full">
              {isResending ? 'Sending...' : 'Resend Email'}
            </Button>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center justify-center gap-2 mx-auto transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out and try a different account
        </button>
      </div>
    </div>
  );
}
