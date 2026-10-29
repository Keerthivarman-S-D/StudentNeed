// API configuration for StudentNeed frontend
const getApiBaseUrl = (): string => {
  const customUrl = ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) as string)?.trim();
  if (customUrl && !customUrl.includes('student.annauniv.edu')) {
    return customUrl.replace(/\/+$/, '');
  }

  // Unified full-stack hosting: frontend and Express backend are served together (same-origin relative paths)
  return '';
};

export const API_BASE_URL: string = getApiBaseUrl();

export const COLLEGE_EMAIL_DOMAIN: string =
  ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_COLLEGE_EMAIL_DOMAIN) as string) ||
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
  get createAccount() {
    return `${getApiBaseUrl()}/api/auth/create-account`;
  },
  get changePassword() {
    return `${getApiBaseUrl()}/api/auth/change-password`;
  },
  get validatePassword() {
    return `${getApiBaseUrl()}/api/auth/validate-password`;
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
  get editListing() {
    return `${getApiBaseUrl()}/api/admin/listings/edit`;
  },
  get moderateListing() {
    return `${getApiBaseUrl()}/api/admin/listings/moderate`;
  },
  get requests() {
    return `${getApiBaseUrl()}/api/admin/requests`;
  },
  get editRequest() {
    return `${getApiBaseUrl()}/api/admin/requests/edit`;
  },
  get moderateRequest() {
    return `${getApiBaseUrl()}/api/admin/requests/moderate`;
  },
  get reservations() {
    return `${getApiBaseUrl()}/api/admin/reservations`;
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

export const RESERVATION_ENDPOINTS = {
  get accept() {
    return `${getApiBaseUrl()}/api/reservations/accept`;
  },
  get decline() {
    return `${getApiBaseUrl()}/api/reservations/decline`;
  },
  get complete() {
    return `${getApiBaseUrl()}/api/reservations/complete`;
  },
  get cancel() {
    return `${getApiBaseUrl()}/api/reservations/cancel`;
  },
  get notifyCreated() {
    return `${getApiBaseUrl()}/api/reservations/notify-created`;
  },
  get notifyMeetup() {
    return `${getApiBaseUrl()}/api/reservations/notify-meetup`;
  },
};

export const NOTIFICATION_ENDPOINTS = {
  get markAllRead() {
    return `${getApiBaseUrl()}/api/notifications/mark-all-read`;
  },
  get registerFcm() {
    return `${getApiBaseUrl()}/api/push/fcm-token`;
  },
  get unregisterFcm() {
    return `${getApiBaseUrl()}/api/push/fcm-unsubscribe`;
  },
  get notifyRequestResponse() {
    return `${getApiBaseUrl()}/api/requests/notify-response`;
  },
};

export const REQUEST_ENDPOINTS = {
  get renew() {
    return `${getApiBaseUrl()}/api/requests/renew`;
  },
  get cleanupExpired() {
    return `${getApiBaseUrl()}/api/requests/cleanup-expired`;
  },
  get backfillExpiration() {
    return `${getApiBaseUrl()}/api/requests/backfill-expiration`;
  },
};

