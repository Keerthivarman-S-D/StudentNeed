/**
 * StudentNeed Password Security and Validation Utility
 *
 * Enforces strong password security policies:
 * - At least 8 characters long
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)
 * - Reject whitespace
 * - Supports passwords of at least 64 characters (up to 128)
 */

export const SPECIAL_CHARACTERS = '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?';
export const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordStrength = 'Weak' | 'Medium' | 'Strong';

export interface PasswordRule {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special' | 'noWhitespace';
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  rules: PasswordRule[];
  errors: string[];
  strength: PasswordStrength;
  strengthScore: number; // 0: None/Empty, 1: Weak, 2: Medium, 3: Strong
}

/**
 * Validates a password against all required security rules and evaluates strength.
 */
export function validatePassword(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string') {
    return {
      isValid: false,
      rules: [
        { id: 'length', label: 'At least 8 characters', met: false },
        { id: 'uppercase', label: 'Uppercase letter', met: false },
        { id: 'lowercase', label: 'Lowercase letter', met: false },
        { id: 'number', label: 'Number', met: false },
        { id: 'special', label: 'Special character', met: false },
        { id: 'noWhitespace', label: 'No whitespace', met: true },
      ],
      errors: ['Password is required.'],
      strength: 'Weak',
      strengthScore: 0,
    };
  }

  const lengthMet = password.length >= MIN_PASSWORD_LENGTH;
  const uppercaseMet = /[A-Z]/.test(password);
  const lowercaseMet = /[a-z]/.test(password);
  const numberMet = /[0-9]/.test(password);
  const specialMet = SPECIAL_CHARS_REGEX.test(password);
  const noWhitespaceMet = !/\s/.test(password);
  const maxLengthMet = password.length <= MAX_PASSWORD_LENGTH;

  const rules: PasswordRule[] = [
    { id: 'length', label: 'At least 8 characters', met: lengthMet },
    { id: 'uppercase', label: 'Uppercase letter', met: uppercaseMet },
    { id: 'lowercase', label: 'Lowercase letter', met: lowercaseMet },
    { id: 'number', label: 'Number', met: numberMet },
    { id: 'special', label: 'Special character', met: specialMet },
    { id: 'noWhitespace', label: 'No whitespace', met: noWhitespaceMet },
  ];

  const errors: string[] = [];
  if (!lengthMet) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!maxLengthMet) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`);
  }
  if (!uppercaseMet) {
    errors.push('Password must contain at least 1 uppercase letter (A-Z).');
  }
  if (!lowercaseMet) {
    errors.push('Password must contain at least 1 lowercase letter (a-z).');
  }
  if (!numberMet) {
    errors.push('Password must contain at least 1 number (0-9).');
  }
  if (!specialMet) {
    errors.push('Password must contain at least 1 special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?).');
  }
  if (!noWhitespaceMet) {
    errors.push('Password must not contain spaces or whitespace.');
  }

  const isValid = lengthMet && maxLengthMet && uppercaseMet && lowercaseMet && numberMet && specialMet && noWhitespaceMet;

  // Strength evaluation
  let strength: PasswordStrength = 'Weak';
  let strengthScore = 0;

  if (password.length > 0) {
    if (!noWhitespaceMet) {
      strength = 'Weak';
      strengthScore = 1;
    } else {
      const coreRequirements = [lengthMet, uppercaseMet, lowercaseMet, numberMet, specialMet];
      const metCount = coreRequirements.filter(Boolean).length;

      if (isValid) {
        if (password.length >= 10) {
          strength = 'Strong';
          strengthScore = 3;
        } else {
          strength = 'Medium';
          strengthScore = 2;
        }
      } else {
        if (metCount >= 3) {
          strength = 'Medium';
          strengthScore = 2;
        } else {
          strength = 'Weak';
          strengthScore = 1;
        }
      }
    }
  }

  return {
    isValid,
    rules,
    errors,
    strength,
    strengthScore,
  };
}
