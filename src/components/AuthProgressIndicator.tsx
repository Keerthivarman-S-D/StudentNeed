import React from 'react';
import { Check } from 'lucide-react';

interface AuthProgressIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { id: 1, label: 'Email' },
  { id: 2, label: 'Verification' },
  { id: 3, label: 'Profile' },
];

export const AuthProgressIndicator: React.FC<AuthProgressIndicatorProps> = ({ currentStep }) => {
  return (
    <div className="w-full py-2 mb-4" aria-label={`Registration progress: Step ${currentStep} of 3`}>
      <div className="flex items-center justify-between max-w-sm mx-auto">
        {STEPS.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step indicator node */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    isCompleted
                      ? 'bg-[#204b39] text-white shadow-sm'
                      : isActive
                      ? 'bg-[#204b39] text-white ring-4 ring-[#204b39]/15 shadow-sm'
                      : 'bg-[#f7f6f2] text-[#889089] border border-[#dedcd4]'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium transition-colors duration-200 ${
                    isActive
                      ? 'text-[#204b39] font-semibold'
                      : isCompleted
                      ? 'text-[#252b27]'
                      : 'text-[#889089]'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line between steps */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 -mt-4 transition-all duration-300 ${
                    step.id < currentStep ? 'bg-[#204b39]' : 'bg-[#dedcd4]'
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
