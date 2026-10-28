import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AUTH_ENDPOINTS, COLLEGE_EMAIL_DOMAIN } from '../config/api';
import { validatePassword } from '../lib/passwordSecurity';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { AuthLayout } from '../components/AuthLayout';

// In-memory registration form draft to preserve values if navigation occurs
// Plaintext passwords are NEVER stored in localStorage, sessionStorage, or any browser persistent storage
interface RegistrationDraft {
  name: string;
  email: string;
  yearOfStudy: string;
  password?: string;
  confirmPassword?: string;
  agreedToTerms: boolean;
}

let registrationDraft: RegistrationDraft = {
  name: '',
  email: '',
  yearOfStudy: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
};

export const clearRegistrationDraft = () => {
  registrationDraft = {
    name: '',
    email: '',
    yearOfStudy: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  };
};

export function Register() {
  const navigate = useNavigate();
  const { firebaseUser, currentUser } = useAuth();

  const [name, setName] = useState(registrationDraft.name);
  const [email, setEmail] = useState(registrationDraft.email);
  const [yearOfStudy, setYearOfStudy] = useState(registrationDraft.yearOfStudy);
  const [password, setPassword] = useState(registrationDraft.password || '');
  const [confirmPassword, setConfirmPassword] = useState(registrationDraft.confirmPassword || '');
  const [agreedToTerms, setAgreedToTerms] = useState(registrationDraft.agreedToTerms);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (updates: Partial<RegistrationDraft>) => {
    registrationDraft = {
      ...registrationDraft,
      ...updates,
    };
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (firebaseUser) {
      if (currentUser) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    }
  }, [firebaseUser, currentUser, navigate]);

  const passwordValidation = validatePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawDomain = COLLEGE_EMAIL_DOMAIN.trim().replace(/^@/, '');
    const allowedDomain = `@${rawDomain}`;
    if (!cleanEmail.endsWith(allowedDomain)) {
      setError(`Only ${allowedDomain} emails are accepted.`);
      return;
    }

    if (!yearOfStudy) {
      setError('Please select your year of study.');
      return;
    }

    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0] || 'Password does not meet the security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setIsLoading(true);

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

      // Store pending registration info securely in sessionStorage for OTP verification step
      sessionStorage.setItem(
        'studentneed_pending_registration',
        JSON.stringify({
          email: cleanEmail,
          name: cleanName,
          yearOfStudy,
          password,
        })
      );

      // Clear in-memory draft upon proceeding to verification step
      clearRegistrationDraft();

      // Navigate to OTP verification page
      navigate('/verify-email', {
        state: {
          email: cleanEmail,
          name: cleanName,
          yearOfStudy,
          password,
        },
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#252b27] leading-tight">
            Join your campus.
          </h2>
          <p className="mt-1 text-[13px] sm:text-sm text-[#555d56]">
            Create an account with your official student email.
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

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
          {/* Name Field */}
          <div>
            <label className="block text-[13px] font-medium text-[#252b27] mb-1" htmlFor="reg-name">
              Name
            </label>
            <input
              id="reg-name"
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                updateDraft({ name: e.target.value });
              }}
              className="w-full h-10 sm:h-[42px] rounded-lg border border-[#dedcd4] bg-white px-3.5 text-sm text-[#252b27] placeholder:text-[#9ea39c] focus:outline-none focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]/20 transition-all"
            />
          </div>

          {/* Student Email Field */}
          <div>
            <label className="block text-[13px] font-medium text-[#252b27] mb-1" htmlFor="reg-email">
              Student email
            </label>
            <input
              id="reg-email"
              type="email"
              required
              placeholder="you@student.annauniv.edu"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                updateDraft({ email: e.target.value });
              }}
              className="w-full h-10 sm:h-[42px] rounded-lg border border-[#dedcd4] bg-white px-3.5 text-sm text-[#252b27] placeholder:text-[#9ea39c] focus:outline-none focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]/20 transition-all"
            />
            <p className="mt-1 text-[11px] sm:text-xs text-[#667065]">
              Only @student.annauniv.edu emails are accepted.
            </p>
          </div>

          {/* Campus Identification Panel */}
          <div className="rounded-xl bg-[#edf1ec] p-3 border border-[#e0e6df]">
            <span className="block text-[10px] font-bold tracking-wider text-[#252b27]/75 uppercase">
              CAMPUS
            </span>
            <p className="mt-0.5 text-xs sm:text-[13px] font-medium text-[#252b27]">
              Madras Institute of Technology · Anna University
            </p>
          </div>

          {/* Year of Study Selector */}
          <div>
            <label className="block text-[13px] font-medium text-[#252b27] mb-1" htmlFor="reg-year">
              Year of study
            </label>
            <div className="relative">
              <select
                id="reg-year"
                required
                value={yearOfStudy}
                onChange={(e) => {
                  setYearOfStudy(e.target.value);
                  updateDraft({ yearOfStudy: e.target.value });
                }}
                className="w-full h-10 sm:h-[42px] appearance-none rounded-lg border border-[#dedcd4] bg-white px-3.5 pr-10 text-sm text-[#252b27] focus:outline-none focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]/20 transition-all cursor-pointer"
              >
                <option value="" disabled className="text-zinc-400">
                  Select your year
                </option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#717870]">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-[13px] font-medium text-[#252b27] mb-1" htmlFor="reg-password">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  updateDraft({ password: e.target.value });
                }}
                className="w-full h-10 sm:h-[42px] rounded-lg border border-[#dedcd4] bg-white px-3.5 pr-11 text-sm text-[#252b27] placeholder:text-[#9ea39c] focus:outline-none focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-0 flex h-full items-center justify-center px-3 text-zinc-400 hover:text-[#252b27] transition-colors focus:outline-none cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs text-[#667065]">Use at least 8 characters.</p>

            {/* Accessible password security requirements integration */}
            <PasswordRequirements
              password={password}
              validation={passwordValidation}
              className="sr-only"
            />
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-[13px] font-medium text-[#252b27] mb-1" htmlFor="reg-confirm-password">
              Confirm password
            </label>
            <div className="relative flex items-center">
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  updateDraft({ confirmPassword: e.target.value });
                }}
                className="w-full h-10 sm:h-[42px] rounded-lg border border-[#dedcd4] bg-white px-3.5 pr-11 text-sm text-[#252b27] placeholder:text-[#9ea39c] focus:outline-none focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-0 flex h-full items-center justify-center px-3 text-zinc-400 hover:text-[#252b27] transition-colors focus:outline-none cursor-pointer"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-red-600 mt-1 font-medium">Passwords do not match.</p>
            )}
          </div>

          {/* Terms Agreement Checkbox */}
          <div className="pt-0.5 flex items-start gap-2.5">
            <input
              id="terms-agreement-checkbox"
              type="checkbox"
              required
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked);
                updateDraft({ agreedToTerms: e.target.checked });
              }}
              className="mt-0.5 h-3.5 w-3.5 rounded border-[#dedcd4] text-[#204b39] focus:ring-[#204b39] accent-[#204b39] cursor-pointer shrink-0"
            />
            <div
              className="text-xs text-[#555d56] leading-snug select-none"
              aria-label="I agree to the Terms of Service and Privacy Policy."
            >
              <label htmlFor="terms-agreement-checkbox" className="cursor-pointer">
                I agree to the{' '}
              </label>
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-[#2563EB] hover:text-[#1d4ed8] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded px-0.5 transition-colors inline-block"
              >
                Terms of Service
              </Link>
              <label htmlFor="terms-agreement-checkbox" className="cursor-pointer">
                {' '}and{' '}
              </label>
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-[#2563EB] hover:text-[#1d4ed8] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded px-0.5 transition-colors inline-block"
              >
                Privacy Policy
              </Link>
              <label htmlFor="terms-agreement-checkbox" className="cursor-pointer">
                .
              </label>
            </div>
          </div>

          {/* Primary Create Account Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 sm:h-[42px] rounded-lg bg-[#204b39] hover:bg-[#183a2c] text-white text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
            >
              {isLoading ? 'Sending verification code...' : 'Create account'}
            </button>
          </div>

          {/* Helper Text */}
          <p className="text-[11px] sm:text-xs text-[#667065] text-center pt-0.5">
            We&apos;ll send a code to your student email to confirm access.
          </p>

          {/* Sign In Link / Outline Button */}
          <div className="pt-0.5">
            <Link
              to="/login"
              className="w-full h-10 sm:h-[42px] flex items-center justify-center rounded-lg border border-[#dedcd4] bg-white text-xs sm:text-sm font-semibold text-[#252b27] hover:bg-[#f7f6f2] transition-colors"
            >
              Already registered? Sign in
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
export default Register;
