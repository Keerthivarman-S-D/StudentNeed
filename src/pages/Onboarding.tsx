import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FieldError } from '../components/ui/FieldError';
import { FormAlert } from '../components/ui/FormAlert';
import { AuthProgressIndicator } from '../components/AuthProgressIndicator';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { validatePassword } from '../lib/passwordSecurity';
import {
  UserCircle2,
  Camera,
  Upload,
  X,
  Loader2,
  Sparkles,
  School,
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { AUTH_ENDPOINTS, COLLEGE_EMAIL_DOMAIN } from '../config/api';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';
import {
  ACADEMIC_YEARS,
  DEPARTMENTS,
  validateFullName,
  validateYearOfStudy,
  validateDepartment,
  isProfileComplete,
} from '../lib/validation';
import { formatErrorMessage } from '../lib/errorHandler';

export function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { firebaseUser, currentUser, loading, updateUserProfile } = useAuth();

  // Retrieve verified registration session state
  const [registrationSession] = useState<{
    email?: string;
    registrationToken?: string;
    verified?: boolean;
  }>(() => {
    if (location.state && location.state.email) {
      return location.state;
    }
    try {
      const stored = sessionStorage.getItem('studentneed_registration_session');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}
    return {};
  });

  const verifiedEmail = registrationSession.email || firebaseUser?.email || '';
  const registrationToken = registrationSession.registrationToken || (location.state as any)?.registrationToken || '';

  // Profile fields state
  const [name, setName] = useState(currentUser?.name || '');
  const [yearOfStudy, setYearOfStudy] = useState(currentUser?.yearOfStudy || '');
  const [department, setDepartment] = useState(
    currentUser?.department && currentUser.department !== 'General'
      ? currentUser.department
      : 'Computer Science'
  );
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(
    currentUser?.avatarUrl || ''
  );

  // Password fields state (for new registrations where firebaseUser is not yet signed in)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    yearOfStudy?: string;
    department?: string;
    password?: string;
    confirmPassword?: string;
    avatar?: string;
    bio?: string;
  }>({});

  // Auth & Profile Redirection Logic:
  // - If user is not authenticated AND has no verified registration session -> redirect to register
  // - If profile is already complete in Firestore -> redirect to marketplace
  useEffect(() => {
    if (loading) return;

    if (!firebaseUser && !verifiedEmail) {
      navigate('/register', { replace: true });
    } else if (currentUser && isProfileComplete(currentUser)) {
      navigate('/marketplace', { replace: true });
    }
  }, [firebaseUser, currentUser, loading, verifiedEmail, navigate]);

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) setGeneralError(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    clearFieldError('avatar');
    const file = e.target.files?.[0];
    if (file) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        setFieldErrors((prev) => ({
          ...prev,
          avatar:
            validation.error ||
            'Invalid image file. Please use JPG, PNG, or WEBP under 5MB.',
        }));
        setAvatarFile(null);
        setAvatarPreview('');
        e.target.value = '';
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setAvatarFile(null);
      setAvatarPreview('');
    }
  };

  const handleRemovePhoto = () => {
    clearFieldError('avatar');
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const passwordValidation = validatePassword(password);
  const needsPassword = !firebaseUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    // 1. Centralized Field Validations
    const errors: typeof fieldErrors = {};

    const nameValidation = validateFullName(name);
    if (!nameValidation.valid) {
      errors.name = nameValidation.error;
    }

    const yearValidation = validateYearOfStudy(yearOfStudy);
    if (!yearValidation.valid) {
      errors.yearOfStudy = yearValidation.error;
    }

    const deptValidation = validateDepartment(department);
    if (!deptValidation.valid) {
      errors.department = deptValidation.error;
    }

    if (needsPassword) {
      if (!passwordValidation.isValid) {
        errors.password =
          passwordValidation.errors[0] ||
          'Password does not meet the security requirements.';
      }

      if (!confirmPassword) {
        errors.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (bio && bio.length > 150) {
      errors.bio = 'Bio cannot exceed 150 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const cleanName = name.trim();
      const cleanDept = department.trim();
      const cleanYear = yearOfStudy.trim();
      const cleanBio = bio.trim();
      const cleanEmail = verifiedEmail.trim().toLowerCase();

      // 2. Resolve Avatar: Upload new photo to Cloudinary or use default monogram
      let finalAvatarUrl =
        avatarPreview && !avatarPreview.startsWith('blob:')
          ? avatarPreview
          : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
              cleanName
            )}&backgroundColor=000000`;

      if (avatarFile) {
        try {
          finalAvatarUrl = await uploadImageToCloudinary(avatarFile, {
            folder: 'studentneed/avatars',
          });
        } catch (imgError: any) {
          console.error('Failed to upload avatar to Cloudinary:', imgError);
          setFieldErrors((prev) => ({
            ...prev,
            avatar:
              'Image upload failed. Please try again or continue with the default monogram.',
          }));
          setIsLoading(false);
          return;
        }
      }

      let activeUid = firebaseUser?.uid;
      let idToken = '';

      // 3. If new user, create Firebase Authentication account securely
      if (!firebaseUser) {
        const createRes = await fetch(AUTH_ENDPOINTS.createAccount, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            registrationToken,
          }),
        });

        const createData = await createRes.json().catch(() => ({}));

        if (createRes.ok) {
          activeUid = createData.uid;
        } else {
          // If the account was already created (e.g. retry or rapid double click), attempt sign-in
          const errMsg = (createData.error || '').toLowerCase();
          if (
            createRes.status === 409 ||
            errMsg.includes('already in use') ||
            errMsg.includes('email_exists') ||
            errMsg.includes('already registered')
          ) {
            // Account exists, proceed to sign in with user's verified password
          } else {
            throw new Error(
              createData.error ||
                (createData.details
                  ? createData.details[0]
                  : 'Failed to create account. Please try again.')
            );
          }
        }

        // Sign in via Firebase Auth to obtain authenticated session
        const userCred = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );
        activeUid = userCred.user.uid;
        idToken = await userCred.user.getIdToken();
      } else {
        idToken = await firebaseUser.getIdToken();
      }

      if (!activeUid || !idToken) {
        throw new Error('Unable to establish student authentication session.');
      }

      // 4. Finalize User Profile via authoritative backend endpoint
      let backendSuccess = false;
      try {
        const response = await fetch(AUTH_ENDPOINTS.finalizeAccount, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: activeUid,
            email: cleanEmail,
            name: cleanName,
            department: cleanDept,
            yearOfStudy: cleanYear,
            bio: cleanBio,
            avatarUrl: finalAvatarUrl,
            idToken,
            registrationToken,
          }),
        });

        if (response.ok) {
          backendSuccess = true;
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('Backend finalizeAccount returned non-200:', errData);
          if (errData.error) {
            throw new Error(errData.error);
          }
        }
      } catch (backendErr: any) {
        console.warn('Backend finalizeAccount note:', backendErr?.message || backendErr);
        if (backendErr?.message && !backendErr.message.toLowerCase().includes('fetch')) {
          throw backendErr;
        }
      }

      // 5. Resilience Fallback: Update Firestore document directly if backend was offline
      if (!backendSuccess) {
        try {
          await setDoc(
            doc(db, 'users', activeUid),
            {
              id: activeUid,
              name: cleanName,
              department: cleanDept,
              yearOfStudy: cleanYear,
              bio: cleanBio,
              avatarUrl: finalAvatarUrl,
              campus: 'Madras Institute of Technology – Anna University',
              onboardingCompleted: true,
              isVerified: true,
            },
            { merge: true }
          );
        } catch (firestoreErr) {
          console.warn('Direct Firestore sync note:', firestoreErr);
        }
      }

      // 6. Update Local Auth Context State
      updateUserProfile({
        name: cleanName,
        department: cleanDept,
        yearOfStudy: cleanYear,
        bio: cleanBio,
        avatarUrl: finalAvatarUrl,
        campus: 'Madras Institute of Technology – Anna University',
        onboardingCompleted: true,
        isVerified: true,
      });

      // Clean up registration session
      sessionStorage.removeItem('studentneed_registration_session');

      setSuccessMessage('Welcome to StudentNeed! Taking you to the marketplace...');

      // 7. Seamless Redirect to the main Marketplace
      setTimeout(() => {
        navigate('/marketplace', { replace: true });
      }, 700);
    } catch (err: any) {
      console.error('Profile setup error:', err);
      setGeneralError(
        formatErrorMessage(
          err,
          'Unable to complete your profile. Please check your information and try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-[#dedcd4] sm:px-10">
          {/* Progress Indicator: Step 3 (Profile) */}
          <AuthProgressIndicator currentStep={3} />

          {/* Heading and Subtitle */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
              Let&apos;s set up your profile!
            </h1>
            <p className="mt-2 text-sm text-[#555d56]">
              Tell us a little about yourself to get started with StudentNeed.
            </p>
          </div>

          {/* Verified Student Email Indicator */}
          <div className="mb-6 flex items-center justify-between rounded-xl border border-[#204b39]/20 bg-[#204b39]/5 px-3.5 py-2.5 text-xs text-[#204b39]">
            <div className="flex items-center gap-2 truncate">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#204b39]" />
              <span className="truncate">
                Verified email: <strong>{verifiedEmail || `student@${COLLEGE_EMAIL_DOMAIN}`}</strong>
              </span>
            </div>
            <span className="shrink-0 font-semibold uppercase text-[10px] tracking-wider bg-[#204b39] text-white px-2 py-0.5 rounded-full">
              Verified
            </span>
          </div>

          {/* General Error Banner */}
          {generalError && (
            <div className="mb-6">
              <FormAlert
                error={generalError}
                onDismiss={() => setGeneralError(null)}
              />
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-6">
              <FormAlert
                success={successMessage}
                onDismiss={() => setSuccessMessage(null)}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* A. Profile Picture */}
            <div className="flex flex-col items-center">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-3">
                Profile Picture <span className="text-[#889089] font-normal lowercase">(optional)</span>
              </label>

              <div className="relative group">
                <div
                  className={`w-28 h-28 rounded-full border-2 overflow-hidden flex items-center justify-center bg-[#f7f6f2] shadow-inner transition-all ${
                    fieldErrors.avatar
                      ? 'border-red-400'
                      : 'border-[#dedcd4] group-hover:border-[#204b39]'
                  }`}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#889089]">
                      <UserCircle2 className="w-14 h-14 stroke-1" />
                    </div>
                  )}
                </div>

                {/* Upload Button Overlay */}
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 p-2.5 rounded-full bg-[#204b39] text-white shadow-md hover:bg-[#18392b] cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  title="Upload profile picture"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={isLoading}
                  />
                </label>

                {/* Remove button if file selected */}
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shadow-sm"
                    title="Remove photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <p className="mt-2 text-[11px] text-[#889089] text-center">
                JPG, PNG, or WebP up to 5MB. You can skip this and use your default monogram.
              </p>
              <FieldError error={fieldErrors.avatar} id="avatar-error" />
            </div>

            {/* B. Personal Information */}
            <div className="space-y-4 pt-2 border-t border-[#dedcd4]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#252b27]">
                Personal Information
              </h3>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="onboarding-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-1.5"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="onboarding-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError('name');
                  }}
                  placeholder="e.g. Priyadharshini K"
                  disabled={isLoading}
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#252b27] placeholder:text-[#889089] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] ${
                    fieldErrors.name
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-[#dedcd4] focus:border-[#204b39]'
                  }`}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'onboarding-name-error' : undefined}
                />
                <FieldError error={fieldErrors.name} id="onboarding-name-error" />
              </div>

              {/* Grid: Academic Year & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Academic Year */}
                <div>
                  <label
                    htmlFor="onboarding-year"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-1.5"
                  >
                    Year of study <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="onboarding-year"
                      value={yearOfStudy}
                      onChange={(e) => {
                        setYearOfStudy(e.target.value);
                        clearFieldError('yearOfStudy');
                      }}
                      disabled={isLoading}
                      className={`w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-8 text-sm text-[#252b27] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] ${
                        fieldErrors.yearOfStudy
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#dedcd4] focus:border-[#204b39]'
                      }`}
                      aria-invalid={!!fieldErrors.yearOfStudy}
                      aria-describedby={
                        fieldErrors.yearOfStudy ? 'onboarding-year-error' : undefined
                      }
                    >
                      <option value="">Select your year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#889089]" />
                  </div>
                  <FieldError error={fieldErrors.yearOfStudy} id="onboarding-year-error" />
                </div>

                {/* Department */}
                <div>
                  <label
                    htmlFor="onboarding-department"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-1.5"
                  >
                    Department <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="onboarding-department"
                      value={department}
                      onChange={(e) => {
                        setDepartment(e.target.value);
                        clearFieldError('department');
                      }}
                      disabled={isLoading}
                      className={`w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-8 text-sm text-[#252b27] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] ${
                        fieldErrors.department
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#dedcd4] focus:border-[#204b39]'
                      }`}
                      aria-invalid={!!fieldErrors.department}
                      aria-describedby={
                        fieldErrors.department ? 'onboarding-department-error' : undefined
                      }
                    >
                      <option value="">Select your department</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#889089]" />
                  </div>
                  <FieldError error={fieldErrors.department} id="onboarding-department-error" />
                </div>
              </div>
            </div>

            {/* C. Account Security (Password Creation) */}
            {needsPassword && (
              <div className="space-y-4 pt-4 border-t border-[#dedcd4]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#252b27]">
                  Account Security
                </h3>

                {/* Create Password */}
                <div>
                  <label
                    htmlFor="onboarding-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-1.5"
                  >
                    Create Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="onboarding-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      placeholder="At least 8 characters with a number & symbol"
                      disabled={isLoading}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-sm text-[#252b27] placeholder:text-[#889089] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] ${
                        fieldErrors.password
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#dedcd4] focus:border-[#204b39]'
                      }`}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={
                        fieldErrors.password ? 'onboarding-password-error' : undefined
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[#889089] hover:text-[#252b27] focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <FieldError error={fieldErrors.password} id="onboarding-password-error" />

                  {/* Password Requirements Checklist */}
                  {password.length > 0 && (
                    <div className="mt-2.5">
                      <PasswordRequirements validation={passwordValidation} />
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="onboarding-confirm-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-1.5"
                  >
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="onboarding-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        clearFieldError('confirmPassword');
                      }}
                      placeholder="Re-enter your password"
                      disabled={isLoading}
                      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-sm text-[#252b27] placeholder:text-[#889089] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] ${
                        fieldErrors.confirmPassword
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#dedcd4] focus:border-[#204b39]'
                      }`}
                      aria-invalid={!!fieldErrors.confirmPassword}
                      aria-describedby={
                        fieldErrors.confirmPassword
                          ? 'onboarding-confirm-password-error'
                          : undefined
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-[#889089] hover:text-[#252b27] focus:outline-none"
                      aria-label={
                        showConfirmPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    error={fieldErrors.confirmPassword}
                    id="onboarding-confirm-password-error"
                  />
                </div>
              </div>
            )}

            {/* D. Additional Profile Information */}
            <div className="space-y-4 pt-4 border-t border-[#dedcd4]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#252b27]">
                Campus & Bio
              </h3>

              {/* Campus Information (Auto-populated & Read-only) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#555d56] mb-1.5">
                  Campus
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-[#dedcd4] bg-[#f7f6f2] px-3.5 py-2.5 text-sm text-[#252b27]">
                  <School className="w-4 h-4 text-[#204b39] shrink-0" />
                  <span className="font-medium">
                    Madras Institute of Technology – Anna University
                  </span>
                </div>
              </div>

              {/* Campus Bio (Optional) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label
                    htmlFor="onboarding-bio"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#555d56]"
                  >
                    Campus Bio <span className="text-[#889089] font-normal lowercase">(optional)</span>
                  </label>
                  <span
                    className={`text-[11px] ${
                      bio.length > 150 ? 'text-red-500 font-semibold' : 'text-[#889089]'
                    }`}
                  >
                    {bio.length} / 150
                  </span>
                </div>
                <textarea
                  id="onboarding-bio"
                  rows={2}
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    clearFieldError('bio');
                  }}
                  maxLength={150}
                  placeholder="e.g. 3rd year Mech student, hostel resident, looking for lab coats and drawing sets."
                  disabled={isLoading}
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#252b27] placeholder:text-[#889089] transition-all focus:outline-none focus:ring-2 focus:ring-[#204b39]/15 disabled:bg-[#f7f6f2] resize-none ${
                    fieldErrors.bio
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-[#dedcd4] focus:border-[#204b39]'
                  }`}
                  aria-invalid={!!fieldErrors.bio}
                  aria-describedby={fieldErrors.bio ? 'onboarding-bio-error' : undefined}
                />
                <FieldError error={fieldErrors.bio} id="onboarding-bio-error" />
              </div>
            </div>

            {/* E. Complete Profile Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white bg-[#204b39] hover:bg-[#18392b] rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-[#204b39]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting up your profile…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Complete Profile</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
