import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AUTH_ENDPOINTS, COLLEGE_EMAIL_DOMAIN } from '../config/api';

export function Login() {
  const navigate = useNavigate();
  const { firebaseUser, currentUser } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Timer countdown for Resend OTP button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your college email address first to reset your password.");
      return;
    }

    const rawDomain = COLLEGE_EMAIL_DOMAIN.trim().replace(/^@/, '');
    const allowedDomain = `@${rawDomain}`;
    if (!cleanEmail.endsWith(allowedDomain)) {
      setError("Please use your official college email address.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(AUTH_ENDPOINTS.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        let errMessage = "Unable to send password reset email. Please try again.";
        try {
          const data = await res.json();
          if (data.error) {
            errMessage = data.error;
          }
        } catch (_) {}
        throw new Error(errMessage);
      }

      setSuccessMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Unable to send password reset email. Please try again.");
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
      const cleanEmail = email.trim().toLowerCase();
      const rawDomain = COLLEGE_EMAIL_DOMAIN.trim().replace(/^@/, '');
      const allowedDomain = `@${rawDomain}`;
      if (!cleanEmail.endsWith(allowedDomain)) {
        throw new Error("Please use your official college email address.");
      }
      
      const res = await fetch(AUTH_ENDPOINTS.sendOtp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      
      if (!res.ok) {
        let errMessage = "Failed to send OTP.";
        try {
          const text = await res.text();
          const data = JSON.parse(text);
          errMessage = data.error || errMessage;
        } catch (e) {
          errMessage = "Unable to send verification code. Please try again.";
        }
        throw new Error(errMessage);
      }
      
      setSuccessMessage(`Verification code sent to ${cleanEmail}`);
      setResendCooldown(60);
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
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(AUTH_ENDPOINTS.verifyOtp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: otp.trim() })
      });
      
      if (!res.ok) {
        let errMessage = "Invalid OTP.";
        try {
          const text = await res.text();
          const data = JSON.parse(text);
          errMessage = data.error || errMessage;
        } catch (e) {
          errMessage = "Unable to verify code. Please try again.";
        }
        throw new Error(errMessage);
      }
      
      await res.json();
      
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
      const cleanEmail = email.trim().toLowerCase();
      await createUserWithEmailAndPassword(auth, cleanEmail, password);
      // Redirect handled by useEffect
    } catch (err: any) {
      console.warn("Account creation error:", err.code || err.message);
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
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        setError("Please enter your college email address.");
        setIsLoading(false);
        return;
      }
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      // Redirect handled by useEffect
    } catch (err: any) {
      console.warn("Sign-in error:", err.code || err.message);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Incorrect email or password. Please verify your credentials or click 'Forgot Password?' to reset.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many failed attempts. Please wait a few minutes or reset your password.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
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
    setShowPassword(false);
    setShowCreatePassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal mb-4 border border-brand-teal-border shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-charcoal">
            {isSignup 
              ? (signupStep === 1 ? 'Create an account' : signupStep === 2 ? 'Verify Email' : 'Set Password') 
              : 'Welcome back'}
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            {isSignup ? 'Join the exclusive Anna University marketplace.' : 'Sign in to access your account.'}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
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
                <label className="block text-sm font-medium text-brand-charcoal mb-1">College Email Address</label>
                <Input 
                  type="email" 
                  required 
                  placeholder="1234567@student.annauniv.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-brand-charcoal">Password</label>
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-xs font-semibold text-brand-teal-hover hover:text-brand-teal focus:outline-none transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-0 flex h-full items-center justify-center px-3 text-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:text-zinc-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
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
                      placeholder="1234567@student.annauniv.edu"
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
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-600 text-center">
                    We&apos;ve sent a 6-digit verification code to <span className="font-semibold text-zinc-900">{email}</span>
                  </div>
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
                    disabled={isLoading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep(1);
                      setOtp('');
                      setError(null);
                      setSuccessMessage(null);
                      setShowCreatePassword(false);
                      setShowConfirmPassword(false);
                    }}
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
                    <div className="relative flex items-center">
                      <Input 
                        type={showCreatePassword ? "text" : "password"} 
                        required 
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword((prev) => !prev)}
                        className="absolute right-0 flex h-full items-center justify-center px-3 text-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:text-zinc-600 transition-colors"
                        aria-label={showCreatePassword ? "Hide password" : "Show password"}
                        title={showCreatePassword ? "Hide password" : "Show password"}
                      >
                        {showCreatePassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Confirm Password</label>
                    <div className="relative flex items-center">
                      <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        required 
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-0 flex h-full items-center justify-center px-3 text-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:text-zinc-600 transition-colors"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-sm text-brand-muted">
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={toggleMode}
            className="font-semibold text-brand-teal-hover hover:text-brand-teal focus:outline-none transition-colors"
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
