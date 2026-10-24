import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { AUTH_ENDPOINTS, COLLEGE_EMAIL_DOMAIN } from '../config/api';
import { AuthLayout } from '../components/AuthLayout';

export function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { firebaseUser, currentUser } = useAuth();

  // Retrieve pending registration state from location.state or sessionStorage
  const [pendingData, setPendingData] = useState<{
    email?: string;
    name?: string;
    yearOfStudy?: string;
    password?: string;
  }>(() => {
    if (location.state && location.state.email) {
      return location.state;
    }
    try {
      const stored = sessionStorage.getItem('studentneed_pending_registration');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}
    return {};
  });

  const email = pendingData.email || firebaseUser?.email || '';

  // 6-digit OTP input boxes state
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Timer countdown for Resend code button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus the first input on initial mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Redirect if already fully authenticated with profile
  useEffect(() => {
    if (firebaseUser && currentUser) {
      navigate('/');
    }
  }, [firebaseUser, currentUser, navigate]);

  const otpCode = digits.join('');
  const isCodeComplete = otpCode.length === 6 && digits.every((d) => d.length === 1);

  const handleDigitChange = (index: number, value: string) => {
    setError(null);
    setSuccessMessage(null);

    // Allow only numeric digits
    const cleanValue = value.replace(/\D/g, '');

    // Handle single character typed
    if (cleanValue.length <= 1) {
      const newDigits = [...digits];
      newDigits[index] = cleanValue;
      setDigits(newDigits);

      // Auto-focus next input if a digit was entered
      if (cleanValue.length === 1 && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      // Handle multi-character paste or autofill in a single box
      handlePastedCode(cleanValue);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous box and clear it
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        e.preventDefault();
      } else if (digits[index]) {
        // Clear current box
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePastedCode = (pastedText: string) => {
    const cleanCode = pastedText.replace(/\D/g, '').slice(0, 6);
    if (!cleanCode) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < cleanCode.length; i++) {
      newDigits[i] = cleanCode[i];
    }
    setDigits(newDigits);

    // Focus either the box after the pasted digits or the last box
    const nextIndex = Math.min(cleanCode.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    handlePastedCode(pasted);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeComplete) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Email address is missing. Please start registration again.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Verify OTP with server endpoint
      const verifyRes = await fetch(AUTH_ENDPOINTS.verifyOtp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: otpCode }),
      });

      if (!verifyRes.ok) {
        let errMessage = 'Invalid verification code.';
        try {
          const text = await verifyRes.text();
          const data = JSON.parse(text);
          errMessage = data.error || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      // If we have full pending registration credentials, complete account creation and finalization
      if (pendingData.password) {
        // 2. Submit to backend create-account endpoint
        const createRes = await fetch(AUTH_ENDPOINTS.createAccount, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: pendingData.password,
          }),
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(
            createData.error ||
              (createData.details ? createData.details[0] : 'Failed to create account.')
          );
        }

        // 3. Establish Firebase Auth session
        const userCred = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          pendingData.password
        );

        // 4. Finalize student public & private profiles
        const idToken = await userCred.user.getIdToken();
        const finalizeRes = await fetch(AUTH_ENDPOINTS.finalizeAccount, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: userCred.user.uid,
            email: cleanEmail,
            name: pendingData.name || 'Student',
            department: pendingData.yearOfStudy || 'General',
            avatarUrl: '',
            idToken,
          }),
        });

        if (!finalizeRes.ok) {
          console.warn('Profile finalization returned non-200, will fallback to onboarding.');
        }

        // Clean up temporary session storage
        sessionStorage.removeItem('studentneed_pending_registration');
        setSuccessMessage('Account created and verified successfully!');

        // Redirect directly to the app
        navigate('/');
      } else {
        // Email verified successfully in standalone mode
        setSuccessMessage('Email verified successfully!');
        sessionStorage.removeItem('studentneed_pending_registration');
        setTimeout(() => {
          navigate(currentUser ? '/' : '/login');
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please provide your student email address.');
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(AUTH_ENDPOINTS.sendOtp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        let errMessage = 'Failed to resend verification code.';
        try {
          const text = await res.text();
          const data = JSON.parse(text);
          errMessage = data.error || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      setSuccessMessage(`A new verification code was sent to ${cleanEmail}`);
      setResendCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Unable to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleDifferentEmail = () => {
    sessionStorage.removeItem('studentneed_pending_registration');
    navigate('/register');
  };

  return (
    <AuthLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#252b27] leading-tight">
            Check your student email.
          </h2>
          <p className="mt-1 text-[13px] sm:text-sm text-[#555d56]">
            Enter the 6-digit code sent to your student email to confirm access.
          </p>
        </div>

        {/* Envelope Icon & Email Display matching screenshot */}
        <div className="space-y-1 pt-0.5">
          {/* Custom SVG Envelope with checkmark in bottom-right corner */}
          <div className="text-[#252b27]">
            <svg
              className="h-8 w-8 text-[#252b27]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8.2l7.89 5.26a2 2 0 002.22 0L21 8.2M5 19h7m-7-14h14a2 2 0 012 2v5.5M5 5a2 2 0 00-2 2v10a2 2 0 002 2"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l2 2 4-4"
              />
            </svg>
          </div>

          <p className="text-sm font-bold text-[#252b27] tracking-tight">
            {email || `student.a@${COLLEGE_EMAIL_DOMAIN}`}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-2.5 text-xs sm:text-sm text-red-600 bg-red-50 rounded-lg border border-red-100"
          >
            {error}
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            className="p-2.5 text-xs sm:text-sm text-[#204b39] bg-[#edf1ec] rounded-lg border border-[#e0e6df]"
          >
            {successMessage}
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleVerifyOtp} className="space-y-3.5 pt-0.5">
          {/* Verification Code Label */}
          <div>
            <label className="block text-[13px] font-medium text-[#252b27] mb-1.5">
              Verification code
            </label>

            {/* 6 Digit Input Boxes matching screenshot */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
              {digits.map((digit, index) => (
                <div key={index} className="flex-1 max-w-[56px]">
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    placeholder="—"
                    aria-label={`Digit ${index + 1} of 6`}
                    className={`w-full h-11 sm:h-12 rounded-lg border text-center text-lg sm:text-xl font-semibold transition-all focus:outline-none ${
                      digit
                        ? 'border-[#252b27] text-[#252b27] bg-white'
                        : 'border-[#dedcd4] text-[#252b27] bg-white placeholder:text-[#a0a59e]'
                    } focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]/20`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Primary Verify Email Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={!isCodeComplete || isLoading}
              className={`w-full h-10 sm:h-[42px] rounded-lg text-sm font-semibold transition-all flex items-center justify-center ${
                isCodeComplete && !isLoading
                  ? 'bg-[#204b39] hover:bg-[#183a2c] text-white cursor-pointer'
                  : 'bg-[#ced9cd] text-[#717870] cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Verifying...' : 'Verify email'}
            </button>
          </div>

          {/* Spam Folder Guidance */}
          <p className="text-[11px] sm:text-xs text-[#667065] text-center pt-0.5">
            Didn&apos;t get the email? Check your spam folder.
          </p>

          {/* Action Buttons: Resend code & Use a different email */}
          <div className="space-y-2 pt-0.5">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending || resendCooldown > 0}
              className="w-full h-10 sm:h-[42px] flex items-center justify-center rounded-lg border border-[#dedcd4] bg-white text-xs sm:text-sm font-semibold text-[#252b27] hover:bg-[#f7f6f2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isResending
                ? 'Sending code...'
                : resendCooldown > 0
                ? `Resend code (${resendCooldown}s)`
                : 'Resend code'}
            </button>

            <button
              type="button"
              onClick={handleDifferentEmail}
              className="w-full h-10 sm:h-[42px] flex items-center justify-center rounded-lg border border-[#dedcd4] bg-white text-xs sm:text-sm font-semibold text-[#252b27] hover:bg-[#f7f6f2] transition-colors cursor-pointer"
            >
              Use a different email
            </button>
          </div>

          {/* Privacy Reminder Footnote */}
          <p className="text-[11px] sm:text-xs text-[#717870] text-center pt-1 leading-relaxed">
            Keep your code private. StudentNeed won&apos;t ask you to share it in chat.
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
export default VerifyEmail;
