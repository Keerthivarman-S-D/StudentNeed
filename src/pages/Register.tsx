import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AUTH_ENDPOINTS, COLLEGE_EMAIL_DOMAIN } from '../config/api';
import { AuthLayout } from '../components/AuthLayout';
import { FieldError } from '../components/ui/FieldError';
import { FormAlert } from '../components/ui/FormAlert';
import { validateEmail, isProfileComplete } from '../lib/validation';
import { formatErrorMessage } from '../lib/errorHandler';
import { AuthProgressIndicator } from '../components/AuthProgressIndicator';

// In-memory registration form draft to preserve values if navigation occurs
// Plaintext passwords are NEVER stored in localStorage, sessionStorage, or any browser persistent storage
interface RegistrationDraft {
  email: string;
}

let registrationDraft: RegistrationDraft = {
  email: '',
};

export const updateDraft = (updates: Partial<RegistrationDraft>) => {
  registrationDraft = {
    ...registrationDraft,
    ...updates,
  };
};

export const clearRegistrationDraft = () => {
  registrationDraft = {
    email: '',
  };
};

export function Register() {
  const navigate = useNavigate();
  const { firebaseUser, currentUser, loading } = useAuth();

  const [email, setEmail] = useState(registrationDraft.email);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
  }>({});

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) setError(null);
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (loading) return;
    if (firebaseUser) {
      if (currentUser && isProfileComplete(currentUser)) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    }
  }, [firebaseUser, currentUser, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setFieldErrors({ email: emailValidation.error });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // Step 1: Send OTP to student email
      const res = await fetch(AUTH_ENDPOINTS.sendOtp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        let errMessage = 'Unable to send verification code. Please try again.';
        try {
          const text = await res.text();
          const data = JSON.parse(text);
          errMessage = data.error || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      // Store pending registration session securely for the OTP verification step
      sessionStorage.setItem(
        'studentneed_registration_session',
        JSON.stringify({
          email: cleanEmail,
        })
      );

      // Clear in-memory draft upon proceeding to verification step
      clearRegistrationDraft();

      setSuccessMessage('Verification code sent! Redirecting to email verification...');

      // Navigate to OTP verification page
      setTimeout(() => {
        navigate('/verify-email', {
          state: {
            email: cleanEmail,
          },
        });
      }, 500);
    } catch (err: any) {
      const formatted = formatErrorMessage(err);
      if (formatted.toLowerCase().includes('already registered')) {
        setFieldErrors({
          email: 'This email is already registered. Please sign in instead.',
        });
      } else {
        setError(formatted);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-4">
        {/* Progress Indicator: Step 1 (Email) */}
        <AuthProgressIndicator currentStep={1} />

        {/* Header */}
        <div>
          <h2 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#252b27] leading-tight">
            Join your campus.
          </h2>
          <p className="mt-1 text-[13px] sm:text-sm text-[#555d56]">
            Create an account with your official student email.
          </p>
        </div>

        {/* Campus Identification Badge */}
        <div className="rounded-xl border border-[#dedcd4] bg-[#f7f6f2] p-3 text-xs text-[#555d56] space-y-1">
          <div className="font-semibold text-[#252b27] flex items-center gap-1.5">
            <span>🏫</span>
            <span>Madras Institute of Technology · Anna University</span>
          </div>
          <p className="text-[#555d56]">
            Only @{COLLEGE_EMAIL_DOMAIN} emails are accepted.
          </p>
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

        {/* Form: ONLY Email & Send Button */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Student Email */}
          <div>
            <label
              htmlFor="register-email"
              className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-1.5"
            >
              Student Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                updateDraft({ email: val });
                clearFieldError('email');
              }}
              placeholder={`yourname@${COLLEGE_EMAIL_DOMAIN}`}
              disabled={isLoading}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#252b27] placeholder:text-[#889089] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] disabled:cursor-not-allowed ${
                fieldErrors.email
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-[#dedcd4] focus:border-[#204b39]'
              }`}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
            />
            <FieldError error={fieldErrors.email} id="register-email-error" />
          </div>

          {/* Send Verification Code Button */}
          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#204b39] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#18392b] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Sending code…</span>
              </>
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>

          {/* Privacy & Terms Note */}
          <p className="text-center text-[11px] text-[#889089] leading-relaxed">
            By continuing, you agree to StudentNeed&apos;s{' '}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#204b39] underline hover:text-[#18392b]"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#204b39] underline hover:text-[#18392b]"
            >
              Privacy Policy
            </Link>
            . We&apos;ll send a code to your student email to confirm access.
          </p>
        </form>

        {/* Existing Login Link */}
        <div className="pt-2 border-t border-[#dedcd4] text-center">
          <p className="text-xs text-[#555d56]">
            Already registered?{' '}
            <Link
              to="/login"
              className="font-semibold text-[#204b39] hover:text-[#18392b] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
