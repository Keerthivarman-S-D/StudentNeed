/**
 * Centralized Error Handling & Message Normalization for StudentNeed
 * Maps Firebase Auth, Firestore, Cloudinary, and Backend API errors to
 * student-friendly, intelligible error messages without exposing technical stack traces or DB details.
 */

import { ApiError } from '../config/api';

export function formatErrorMessage(error: unknown, fallback: string = 'Something went wrong. Please try again later.'): string {
  if (!error) return fallback;

  // 1. Network / Offline Checks
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Connection problem. Check your internet and try again.';
  }

  // Extract raw error code and message
  const errObj = error as any;
  const code: string = (errObj?.code || errObj?.status || '').toString().toLowerCase();
  const rawMessage: string = (errObj?.message || (typeof error === 'string' ? error : '')).toString();

  // 2. Network / Timeout errors
  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('network request failed') ||
    code === 'auth/network-request-failed' ||
    errObj?.name === 'AbortError' ||
    code === '0'
  ) {
    return 'Connection problem. Check your internet and try again.';
  }

  if (code === '408' || rawMessage.includes('timed out') || rawMessage.includes('timeout')) {
    return 'Request timed out while waiting for server response. Please try again.';
  }

  // 3. Firebase Authentication Error Codes
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Incorrect password. Please try again.';
  }
  if (code === 'auth/user-not-found') {
    return 'No registered account found with this email. Please check your address or register.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/email-already-in-use' || rawMessage.includes('EMAIL_EXISTS')) {
    return 'This email is already registered.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Please use at least 8 characters with upper, lower, numbers, and symbols.';
  }
  if (code === 'auth/too-many-requests' || code === '429') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (code === 'auth/user-disabled') {
    return 'This account is suspended. Please contact studentneed.info@gmail.com for assistance.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'For security, please sign out and sign back in before performing this action.';
  }
  if (code === 'auth/id-token-expired') {
    return 'Your session has expired. Please sign in again.';
  }

  // 4. Firestore Database Error Codes
  if (code === 'permission-denied' || rawMessage.includes('permission-denied') || rawMessage.includes('Missing or insufficient permissions')) {
    return 'You do not have permission to perform this action.';
  }
  if (code === 'unavailable') {
    return 'Database temporarily unavailable. Check your internet connection and try again.';
  }
  if (code === 'resource-exhausted') {
    return 'Action limit reached. Please try again later.';
  }
  if (code === 'deadline-exceeded') {
    return 'The operation took too long. Please try again.';
  }

  // 5. Backend API & HTTP Status Codes
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return sanitizeUserMessage(error.message) || 'Invalid request details. Please check your inputs.';
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.status === 403) {
      return sanitizeUserMessage(error.message) || "Access denied. You don't have permission to perform this action.";
    }
    if (error.status === 404) {
      return sanitizeUserMessage(error.message) || 'The requested item or resource could not be found.';
    }
    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.status >= 500) {
      return 'Something went wrong on our servers. Please try again later.';
    }
  }

  // 6. Specific Domain / Business Logic Messages
  if (rawMessage.includes('OTP expired') || rawMessage.includes('verification expired')) {
    return 'Your verification code has expired. Request a new one.';
  }
  if (rawMessage.includes('Invalid verification code') || rawMessage.includes('invalid OTP')) {
    return 'Invalid verification code.';
  }
  if (rawMessage.includes('already reserved')) {
    return 'This item has already been reserved by another student.';
  }
  if (rawMessage.includes('already completed')) {
    return 'This listing has already been completed.';
  }
  if (rawMessage.includes('Cloudinary') || rawMessage.includes('upload') && rawMessage.includes('image')) {
    return 'Image upload failed. Please try again.';
  }

  // 7. Sanitize generic error string
  const cleanMsg = sanitizeUserMessage(rawMessage);
  if (cleanMsg && cleanMsg.length < 150) {
    return cleanMsg;
  }

  return fallback;
}

/**
 * Strips technical noise, stack traces, JSON brackets, and URL parameters from user messages
 */
function sanitizeUserMessage(msg: string): string {
  if (!msg) return '';
  let cleaned = msg
    .replace(/^Error:\s*/i, '')
    .replace(/Firebase:\s*/i, '')
    .replace(/\(auth\/[a-z-]+\)\.?/i, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/at\s+[a-zA-Z0-9_.\s/\\:-]+:\d+:\d+/g, '')
    .replace(/\{.*\}/g, '')
    .trim();

  // Capitalize first letter and ensure ending punctuation if clean
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
      cleaned += '.';
    }
  }
  return cleaned;
}
