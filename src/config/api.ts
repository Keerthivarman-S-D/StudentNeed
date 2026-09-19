// API configuration for StudentNeed frontend
const getApiBaseUrl = (): string => {
  const customUrl = (import.meta.env.VITE_API_URL as string)?.trim();
  if (customUrl && !customUrl.includes('student.annauniv.edu')) {
    return customUrl.replace(/\/+$/, '');
  }

  // Unified full-stack hosting: frontend and Express backend are served together (same-origin relative paths)
  return '';
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
  get forgotPassword() {
    return `${getApiBaseUrl()}/api/auth/forgot-password`;
  },
  get health() {
    return `${getApiBaseUrl()}/api/health`;
  },
};

export const CHAT_ENDPOINTS = {
  get assistant() {
    return `${getApiBaseUrl()}/api/chat/assistant`;
  },
};

