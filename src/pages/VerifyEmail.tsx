import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AUTH_ENDPOINTS, COLLEGE_EMAIL_DOMAIN } from '../config/api';
import { AuthLayout } from '../components/AuthLayout';
import { FieldError } from '../components/ui/FieldError';
import { FormAlert } from '../components/ui/FormAlert';
import { isProfileComplete } from '../lib/validation';
import { formatErrorMessage } from '../lib/errorHandler';
import { AuthProgressIndicator } from '../components/AuthProgressIndicator';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

export function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { firebaseUser, currentUser, loading } = useAuth();

  // Retrieve pending registration session from location.state or sessionStorage
  const [email] = useState<string>(() => {
    if (location.state && location.state.email) {
      return location.state.email;
    }
    try {
      const stored = sessionStorage.getItem('studentneed_registration_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.email) return parsed.email;
      }
    } catch (_) {}
    return '';
  });

  // 6-digit OTP input boxes state
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If email is missing, redirect back to registration
  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);

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

  // Redirect if already fully authenticated with completed profile
  useEffect(() => {
    if (loading) return;
    if (firebaseUser && currentUser && isProfileComplete(currentUser)) {
      navigate('/', { replace: true });
    }
  }, [firebaseUser, currentUser, loading, navigate]);

  const otpCode = digits.join('');
  const isCodeComplete = otpCode.length === 6 && digits.every((d) => d.length === 1);

  const handleDigitChange = (index: number, value: string) => {
    setError(null);
    setOtpError(null);
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
      setError('Email address is missing. Please restart registration.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOtpError(null);
    setSuccessMessage(null);

    try {
      // 1. Verify OTP with server endpoint
      const verifyRes = await fetch(AUTH_ENDPOINTS.verifyOtp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: otpCode }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok) {
        const rawErr = verifyData.error || 'Invalid verification code.';
        throw new Error(rawErr);
      }

      // Store verified registration session with token for Step 3 Onboarding
      sessionStorage.setItem(
        'studentneed_registration_session',
        JSON.stringify({
          email: cleanEmail,
          verified: true,
          registrationToken: verifyData.registrationToken || '',
          verifiedAt: Date.now(),
        })
      );

      setSuccessMessage('Email verified successfully! Setting up your student profile...');

      // Transition to Step 3: Onboarding
      setTimeout(() => {
        navigate('/onboarding', {
          replace: true,
          state: {
            email: cleanEmail,
            verified: true,
            registrationToken: verifyData.registrationToken,
          },
        });
      }, 500);
    } catch (err: any) {
      const formatted = formatErrorMessage(
        err,
        'Invalid verification code. Please check and try again.'
      );
      setOtpError(formatted);
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
    setOtpError(null);
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

      setSuccessMessage('A new verification code has been sent to your student email.');
      setResendCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(formatErrorMessage(err, 'Failed to resend verification code. Please try again.'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-4">
        {/* Progress Indicator: Step 2 (Verification) */}
        <AuthProgressIndicator currentStep={2} />

        {/* Header */}
        <div>
          <h2 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#252b27] leading-tight">
            Check your student email.
          </h2>
          <p className="mt-1 text-[13px] sm:text-sm text-[#555d56]">
            Enter the 6-digit code sent to your student email to confirm access.
          </p>
        </div>

        {/* Email Target Indicator & Change Link */}
        <div className="flex items-center justify-between rounded-xl border border-[#dedcd4] bg-[#f7f6f2] p-3 text-xs">
          <div className="truncate pr-2">
            <span className="text-[#889089] block text-[10px] uppercase font-bold tracking-wider">
              Verification sent to
            </span>
            <span className="font-semibold text-[#252b27] truncate block text-[13px]">
              {email || `student@${COLLEGE_EMAIL_DOMAIN}`}
            </span>
          </div>
          <Link
            to="/register"
            className="shrink-0 text-xs font-semibold text-[#204b39] hover:text-[#18392b] hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Use a different email</span>
          </Link>
        </div>

        {/* General Error Alert */}
        {error && (
          <FormAlert
            error={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Success Alert */}
        {successMessage && (
          <FormAlert
            success={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {/* OTP Form */}
        <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="otp-digit-0"
              className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-2"
            >
              Verification code
            </label>

            {/* 6 Individual Digit Input Boxes */}
            <div className="flex justify-between gap-1.5 sm:gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-digit-${index}`}
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
                  disabled={isLoading}
                  className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border bg-white text-[#252b27] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] disabled:cursor-not-allowed ${
                    otpError
                      ? 'border-red-400 focus:border-red-500 bg-red-50/20'
                      : digit
                      ? 'border-[#204b39] bg-[#204b39]/5 text-[#204b39]'
                      : 'border-[#dedcd4] focus:border-[#204b39]'
                  }`}
                  aria-label={`Digit ${index + 1} of verification code`}
                />
              ))}
            </div>

            {/* Field Error below OTP boxes */}
            <FieldError error={otpError || undefined} id="otp-input-error" />
          </div>

          {/* Verify Button */}
          <button
            type="submit"
            disabled={!isCodeComplete || isLoading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#204b39] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#18392b] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Verifying code…</span>
              </>
            ) : (
              <>
                <span>Verify & Continue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>

          {/* Resend Action with Countdown */}
          <div className="flex items-center justify-between text-xs text-[#555d56] pt-1">
            <span>Didn&apos;t get the code?</span>
            {resendCooldown > 0 ? (
              <span className="text-[#889089] font-medium">
                Resend code in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending}
                className="font-semibold text-[#204b39] hover:text-[#18392b] hover:underline disabled:opacity-50"
              >
                {isResending ? 'Sending…' : 'Resend code'}
              </button>
            )}
          </div>
        </form>

        {/* Guidance and Security Reminders */}
        <div className="rounded-xl border border-[#dedcd4] bg-[#f7f6f2] p-3 text-[11px] text-[#555d56] space-y-1 leading-relaxed">
          <p>
            • <strong>Spam folder:</strong> Check your spam folder or promotions tab if you don&apos;t see the email within 1–2 minutes.
          </p>
          <p>
            • <strong>Security:</strong> Keep your code private. StudentNeed staff won&apos;t ask for your code.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
