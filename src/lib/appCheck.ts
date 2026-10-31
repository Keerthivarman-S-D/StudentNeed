// Firebase App Check initialization and token helper for StudentNeed
// Operates in monitoring mode prior to production enforcement to ensure zero disruption for legitimate students.

import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, AppCheck } from 'firebase/app-check';
import { app } from './firebase';

let appCheckInstance: AppCheck | null = null;
let appCheckInitialized = false;

export function initAppCheck(): AppCheck | null {
  if (appCheckInitialized) return appCheckInstance;
  appCheckInitialized = true;

  if (typeof window === 'undefined') return null;

  try {
    const isDev = Boolean(import.meta.env?.DEV);
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local');

    // In development and localhost environments, enable debug token to test App Check flows
    if (isDev || isLocalhost) {
      const debugToken = (import.meta.env?.VITE_APPCHECK_DEBUG_TOKEN as string) || true;
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }

    const recaptchaKey = (import.meta.env?.VITE_RECAPTCHA_ENTERPRISE_KEY as string)?.trim();

    if (recaptchaKey) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      });
      console.info('[App Check] Initialized with ReCaptchaEnterpriseProvider in monitoring mode.');
    } else if (isDev || isLocalhost) {
      // In dev mode without an explicit enterprise key, configure debug provider placeholder for monitoring
      console.info('[App Check] Running in development monitoring mode.');
    }
  } catch (err: unknown) {
    console.warn('[App Check] Safe initialization notice (non-fatal):', err);
    appCheckInstance = null;
  }

  return appCheckInstance;
}

/**
 * Retrieves the current App Check token if available.
 * Guaranteed never to throw, ensuring legitimate users are never blocked.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const instance = initAppCheck();
    if (!instance) return null;

    const result = await getToken(instance, /* forceRefresh */ false);
    return result?.token || null;
  } catch (err) {
    // Non-fatal telemetry note: never fail user actions on token fetch failure
    return null;
  }
}
