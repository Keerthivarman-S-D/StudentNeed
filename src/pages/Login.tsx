import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function Login() {
  const navigate = useNavigate();
  const { firebaseUser, currentUser } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if already logged in or needs onboarding
  useEffect(() => {
    if (firebaseUser) {
      if (currentUser) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    }
  }, [firebaseUser, currentUser, navigate]);

  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email address first to reset your password.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      if (!email.toLowerCase().endsWith('@student.annauniv.edu')) {
        throw new Error("You must use a valid @student.annauniv.edu email to join the marketplace.");
      }
      
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP.");
      
      setSuccessMessage("OTP sent! Please check your email.");
      setSignupStep(2);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP.");
      
      setSuccessMessage("Email verified successfully!");
      setSignupStep(3);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Redirect handled by useEffect
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Email is already in use. Try signing in instead, or use a different email.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message || "An error occurred. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect handled by useEffect
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError("Incorrect email or password. Please try again or reset your password.");
      } else {
        setError(err.message || "An error occurred. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setSignupStep(1);
    setError(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
    setOtp('');
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-4 border border-indigo-200 shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            {isSignup 
              ? (signupStep === 1 ? 'Create an account' : signupStep === 2 ? 'Verify Email' : 'Set Password') 
              : 'Welcome back'}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {isSignup ? 'Join the exclusive Anna University marketplace.' : 'Sign in to access your account.'}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 mb-4 text-sm text-green-600 bg-green-50 rounded-lg border border-green-100">
              {successMessage}
            </div>
          )}

          {!isSignup ? (
            // SIGN IN FORM
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">College Email Address</label>
                <Input 
                  type="email" 
                  required 
                  placeholder="e.g. 2023503014@student.annauniv.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-zinc-700">Password</label>
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          ) : (
            // SIGN UP MULTI-STEP FORM
            <div className="space-y-4">
              {signupStep === 1 && (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">College Email Address</label>
                    <Input 
                      type="email" 
                      required 
                      placeholder="e.g. 2023503014@student.annauniv.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send OTP'}
                  </Button>
                </form>
              )}

              {signupStep === 2 && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Enter Verification Code</label>
                    <Input 
                      type="text" 
                      required 
                      placeholder="_ _ _ _ _ _"
                      value={otp}
                      maxLength={6}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="text-center tracking-widest text-lg font-mono"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                    {isLoading ? 'Verifying...' : 'Verify Email'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleSendOTP} 
                    disabled={isLoading}
                  >
                    Resend OTP
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSignupStep(1)}
                    className="text-sm text-zinc-500 hover:text-zinc-900 w-full flex items-center justify-center gap-1 mt-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Change Email
                  </button>
                </form>
              )}

              {signupStep === 3 && (
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Create Password</label>
                    <Input 
                      type="password" 
                      required 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Confirm Password</label>
                    <Input 
                      type="password" 
                      required 
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-sm text-zinc-600">
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={toggleMode}
            className="font-semibold text-indigo-600 hover:text-indigo-500 focus:outline-none"
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
