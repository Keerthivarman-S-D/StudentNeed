import React from 'react';
import { Check, Circle, AlertCircle } from 'lucide-react';
import { validatePassword, PasswordValidationResult } from '../lib/passwordSecurity';

interface PasswordRequirementsProps {
  password?: string;
  validation?: PasswordValidationResult;
  className?: string;
}

export function PasswordRequirements({ password = '', validation: customValidation, className = '' }: PasswordRequirementsProps) {
  const validation = customValidation || validatePassword(password);
  const { rules, strength, strengthScore } = validation;

  const coreRules = rules.filter((r) => r.id !== 'noWhitespace');
  const noWhitespaceRule = rules.find((r) => r.id === 'noWhitespace');
  const hasWhitespaceError = noWhitespaceRule && !noWhitespaceRule.met;

  // Strength color styling
  const getStrengthBadge = () => {
    switch (strength) {
      case 'Strong':
        return {
          textColor: 'text-emerald-700',
          barColor: 'bg-emerald-500',
          label: 'Strong',
        };
      case 'Medium':
        return {
          textColor: 'text-amber-600',
          barColor: 'bg-amber-500',
          label: 'Medium',
        };
      case 'Weak':
      default:
        return {
          textColor: 'text-rose-600',
          barColor: 'bg-rose-500',
          label: 'Weak',
        };
    }
  };

  const badge = getStrengthBadge();

  return (
    <div className={`rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-3 ${className}`}>
      {/* Requirements List */}
      <div className="space-y-1.5" aria-label="Password requirements">
        <p className="text-xs font-semibold text-zinc-700 mb-1">Password Requirements</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {coreRules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-2 text-xs transition-colors duration-150 ${
                rule.met ? 'text-emerald-700 font-medium' : 'text-zinc-500'
              }`}
            >
              {rule.met ? (
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                </div>
              ) : (
                <div className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-300">
                  <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              )}
              <span>{rule.label}</span>
            </div>
          ))}
        </div>

        {/* Whitespace warning if user typed a space */}
        {hasWhitespaceError && (
          <div className="flex items-center gap-1.5 pt-1 text-xs text-rose-600 font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Spaces are not allowed in passwords.</span>
          </div>
        )}
      </div>

      {/* Strength Indicator */}
      <div className="pt-2 border-t border-zinc-200/80">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-zinc-600">Password strength:</span>
          <span className={`font-semibold ${password.length === 0 ? 'text-zinc-400' : badge.textColor}`}>
            {password.length === 0 ? 'None' : badge.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              strengthScore >= 1 ? badge.barColor : 'bg-zinc-200'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              strengthScore >= 2 ? badge.barColor : 'bg-zinc-200'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              strengthScore >= 3 ? badge.barColor : 'bg-zinc-200'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
