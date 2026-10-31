/**
 * Centralized Validation Utilities for StudentNeed
 * Ensures consistent frontend and backend validation rules across all forms,
 * including authentication, onboarding, profile updates, listings, and requests.
 */

import { User, isValidApprovedLocation } from '../types';
import { COLLEGE_EMAIL_DOMAIN } from '../config/api';

export const ACADEMIC_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Postgraduate',
] as const;

export type AcademicYear = typeof ACADEMIC_YEARS[number];

export const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Mechanical',
  'Aeronautical',
  'Production',
  'Automobile',
  'Rubber & Plastic',
  'Other',
] as const;

export type DepartmentName = typeof DEPARTMENTS[number];

/**
 * Validates a student full name
 */
export function validateFullName(name: string | null | undefined): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Please enter your full name.' };
  }
  const clean = name.trim();
  if (clean.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters.' };
  }
  if (clean.length > 50) {
    return { valid: false, error: 'Name cannot exceed 50 characters.' };
  }
  // Check for letters, spaces, dots, hyphens (Indian student naming conventions)
  if (!/^[a-zA-Z\s.-]+$/.test(clean)) {
    return { valid: false, error: 'Name can only contain letters, spaces, and periods.' };
  }
  return { valid: true };
}

/**
 * Validates college student email against official domain
 */
export function validateEmail(email: string | null | undefined, customDomain?: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Please enter your student email address.' };
  }
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const domain = (customDomain || COLLEGE_EMAIL_DOMAIN || 'student.annauniv.edu').trim().replace(/^@/, '');
  const allowedDomain = `@${domain}`;
  if (!clean.endsWith(allowedDomain)) {
    return { valid: false, error: `Only official ${allowedDomain} emails are accepted.` };
  }

  return { valid: true };
}

/**
 * Validates Academic Year
 */
export function validateYearOfStudy(year: string | null | undefined): { valid: boolean; error?: string } {
  if (!year || typeof year !== 'string' || !year.trim()) {
    return { valid: false, error: 'Please select your academic year.' };
  }
  const clean = year.trim();
  if (!ACADEMIC_YEARS.includes(clean as any)) {
    return { valid: false, error: 'Please select a valid academic year (1st, 2nd, 3rd, 4th Year, or Postgraduate).' };
  }
  return { valid: true };
}

/**
 * Validates Academic Department
 */
export function validateDepartment(dept: string | null | undefined): { valid: boolean; error?: string } {
  if (!dept || typeof dept !== 'string' || !dept.trim()) {
    return { valid: false, error: 'Please select your department.' };
  }
  const clean = dept.trim();
  if (clean.length < 2) {
    return { valid: false, error: 'Please enter a valid department name.' };
  }
  return { valid: true };
}

/**
 * Determines whether a user's Firestore profile is completely onboarded
 */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.onboardingCompleted === false) return false;

  const hasName = Boolean(user.name && user.name.trim() && user.name.trim().toLowerCase() !== 'student');
  const hasDept = Boolean(user.department && user.department.trim() && user.department.trim().toLowerCase() !== 'general');
  const hasYear = Boolean(user.yearOfStudy && user.yearOfStudy.trim());

  // Explicit onboarding completed flag with minimum viable name & department
  if (user.onboardingCompleted === true && hasName && hasDept) {
    return true;
  }

  // Backwards compatibility for existing users who already filled full details
  if (hasName && hasDept && hasYear) {
    return true;
  }

  return false;
}

/**
 * Validates Marketplace Listing Form Fields
 */
export function validateListingForm(fields: {
  title: string;
  description: string;
  price?: string | number;
  type: string;
  condition: string;
  category: string;
  location: string;
  wantedItem?: string;
  imagesCount?: number;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const cleanTitle = fields.title?.trim() || '';
  if (!cleanTitle) {
    errors.title = 'Please enter an item title.';
  } else if (cleanTitle.length < 3) {
    errors.title = 'Title must be at least 3 characters.';
  } else if (cleanTitle.length > 50) {
    errors.title = 'Title cannot exceed 50 characters.';
  }

  const cleanDesc = fields.description?.trim() || '';
  if (!cleanDesc) {
    errors.description = 'Please describe the condition and details of your item.';
  } else if (cleanDesc.length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  } else if (cleanDesc.length > 100) {
    errors.description = 'Description cannot exceed 100 characters.';
  }

  if (!fields.category || fields.category.trim() === '') {
    errors.category = 'Please select a category.';
  }

  if (fields.type === 'Sale') {
    const rawPrice = fields.price;
    const numPrice = Number(rawPrice);
    if (rawPrice === '' || rawPrice === undefined || isNaN(numPrice)) {
      errors.price = 'Please enter a valid item price.';
    } else if (numPrice < 1) {
      errors.price = 'Minimum item price is ₹1.';
    } else if (numPrice > 10000) {
      errors.price = 'Maximum listing price is ₹10,000.';
    }
  }

  if (fields.type === 'Exchange') {
    if (!fields.wantedItem?.trim()) {
      errors.wantedItem = 'Please specify what item you would like in exchange.';
    }
  }

  const cleanLoc = fields.location?.trim() || '';
  if (!cleanLoc) {
    errors.location = 'Please select an approved campus pickup location.';
  } else if (!isValidApprovedLocation(cleanLoc)) {
    errors.location = 'Please choose a location from the approved campus meetup spots.';
  }

  if (fields.imagesCount !== undefined && fields.imagesCount > 3) {
    errors.images = 'A maximum of 3 images are allowed per listing.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Student Item Request Form Fields
 */
export function validateRequestForm(fields: {
  title: string;
  description: string;
  category: string;
  neededBy: string;
  location: string;
  budget?: string | number;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const cleanTitle = fields.title?.trim() || '';
  if (!cleanTitle) {
    errors.title = 'Please specify what item you need.';
  } else if (cleanTitle.length < 3) {
    errors.title = 'Request title must be at least 3 characters.';
  } else if (cleanTitle.length > 50) {
    errors.title = 'Request title cannot exceed 50 characters.';
  }

  const cleanDesc = fields.description?.trim() || '';
  if (!cleanDesc) {
    errors.description = 'Please describe what you are looking for.';
  } else if (cleanDesc.length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  }

  if (!fields.category || !fields.category.trim()) {
    errors.category = 'Please select a category.';
  }

  if (!fields.neededBy?.trim()) {
    errors.neededBy = 'Please specify when you need this item.';
  }

  const cleanLoc = fields.location?.trim() || '';
  if (!cleanLoc) {
    errors.location = 'Please specify your preferred campus meetup location.';
  }

  if (fields.budget !== undefined && fields.budget !== '') {
    const numBudget = Number(fields.budget);
    if (isNaN(numBudget) || numBudget < 0) {
      errors.budget = 'Please enter a valid budget amount.';
    } else if (numBudget > 10000) {
      errors.budget = 'Maximum budget is ₹10,000.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
