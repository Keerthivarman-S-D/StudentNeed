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

export const REPORT_ENDPOINTS = {
  get submit() {
    return `${getApiBaseUrl()}/api/reports/submit`;
  },
};

export const MODERATION_ENDPOINTS = {
  get checkListing() {
    return `${getApiBaseUrl()}/api/moderation/check-listing`;
  },
};

export const ADMIN_ENDPOINTS = {
  get overview() {
    return `${getApiBaseUrl()}/api/admin/overview`;
  },
  get users() {
    return `${getApiBaseUrl()}/api/admin/users`;
  },
  get warnUser() {
    return `${getApiBaseUrl()}/api/admin/users/warn`;
  },
  get suspendUser() {
    return `${getApiBaseUrl()}/api/admin/users/suspend`;
  },
  get banUser() {
    return `${getApiBaseUrl()}/api/admin/users/ban`;
  },
  get restoreUser() {
    return `${getApiBaseUrl()}/api/admin/users/restore`;
  },
  get listings() {
    return `${getApiBaseUrl()}/api/admin/listings`;
  },
  get moderateListing() {
    return `${getApiBaseUrl()}/api/admin/listings/moderate`;
  },
  get reports() {
    return `${getApiBaseUrl()}/api/admin/reports`;
  },
  get resolveReport() {
    return `${getApiBaseUrl()}/api/admin/reports/resolve`;
  },
  get auditLogs() {
    return `${getApiBaseUrl()}/api/admin/audit-logs`;
  },
  get activityLogs() {
    return `${getApiBaseUrl()}/api/admin/activity-logs`;
  },
};
