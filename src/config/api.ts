// API configuration and network client for StudentNeed frontend
// Architecture: Firebase Hosting + Firebase Cloud Functions (same-origin /api rewrite)

export const getApiBaseUrl = (): string => {
  const customUrl = ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) as string)?.trim();
  if (customUrl && !customUrl.includes('student.annauniv.edu')) {
    return customUrl.replace(/\/+$/, '');
  }

  // Pure Firebase Architecture:
  // Firebase Hosting automatically rewrites /api/** to Firebase Cloud Functions on the same origin.
  // Using relative path '' ensures zero CORS overhead and complete hosting portability.
  return '';
};

export const API_BASE_URL: string = getApiBaseUrl();

export const COLLEGE_EMAIL_DOMAIN: string =
  ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_COLLEGE_EMAIL_DOMAIN) as string) ||
  'student.annauniv.edu';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number = 500, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal || controller.signal;

  try {
    let appCheckHeader: Record<string, string> = {};
    try {
      const { getAppCheckToken } = await import('../lib/appCheck');
      const token = await getAppCheckToken();
      if (token) {
        appCheckHeader['X-Firebase-AppCheck'] = token;
      }
    } catch {
      // Non-blocking monitoring mode
    }

    const headers = {
      ...appCheckHeader,
      ...(fetchOptions.headers || {}),
    };

    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal,
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const errorMsg = res.ok
        ? 'Received HTML from server instead of JSON API response. The backend service may be waking up or misconfigured.'
        : `Backend returned error (HTTP ${res.status}).`;
      throw new ApiError(errorMsg, res.status);
    }

    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => '');
      data = text ? { message: text } : {};
    }

    if (!res.ok) {
      const message = data?.error || data?.message || `Request failed with status ${res.status}`;
      throw new ApiError(message, res.status, data);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err?.name === 'AbortError') {
      throw new ApiError('Request timed out while waiting for server response. Please try again.', 408);
    }
    throw new ApiError(err?.message || 'Network error connecting to StudentNeed backend.', 0);
  }
}

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
  get deleteAccount() {
    return `${getApiBaseUrl()}/api/account/delete`;
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
  get cleanupTestDataPreview() {
    return `${getApiBaseUrl()}/api/admin/cleanup-test-data/preview`;
  },
  get cleanupTestDataExecute() {
    return `${getApiBaseUrl()}/api/admin/cleanup-test-data/execute`;
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
  get vapidPublicKey() {
    return `${getApiBaseUrl()}/api/push/vapid-public-key`;
  },
  get subscribe() {
    return `${getApiBaseUrl()}/api/push/subscribe`;
  },
  get unsubscribe() {
    return `${getApiBaseUrl()}/api/push/unsubscribe`;
  },
  get notifyMessage() {
    return `${getApiBaseUrl()}/api/push/notify-message`;
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

export const UPLOAD_ENDPOINTS = {
  get image() {
    return `${getApiBaseUrl()}/api/upload/image`;
  },
};
