// API configuration for StudentNeed frontend
const getApiBaseUrl = (): string => {
  const customUrl = (import.meta.env.VITE_API_URL as string)?.trim();
  if (customUrl && !customUrl.includes('student.annauniv.edu')) {
    return customUrl.replace(/\/+$/, '');
  }

  // In AI Studio preview or local development server, use same-origin relative URLs
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('asia-east1.run.app') ||
      hostname.includes('ais-dev') ||
      hostname.includes('ais-pre')
    ) {
      return '';
    }
  }

  // Production standalone hosting default (e.g. Firebase Hosting)
  return 'https://studentneed-backend-gti23zzly6wg7xqqzhxl5a-asia-south1.a.run.app';
};

export const API_BASE_URL: string = getApiBaseUrl();

export const COLLEGE_EMAIL_DOMAIN: string =
  (import.meta.env.VITE_COLLEGE_EMAIL_DOMAIN as string) ||
  'student.annauniv.edu';

export const AUTH_ENDPOINTS = {
  get sendOtp() {
    return `${getApiBaseUrl()}/api/auth/send-otp`;
  },
  get verifyOtp() {
    return `${getApiBaseUrl()}/api/auth/verify-otp`;
  },
  get finalizeAccount() {
    return `${getApiBaseUrl()}/api/auth/finalize-account`;
  },
  get health() {
    return `${getApiBaseUrl()}/api/health`;
  },
};

