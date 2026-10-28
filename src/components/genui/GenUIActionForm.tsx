import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { GenUIActionFormComponent, GenUIFormField } from '../../types/genui';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface GenUIActionFormProps {
  spec: GenUIActionFormComponent;
  onSuccess?: (createdEntityId?: string) => void;
}

export function GenUIActionForm({ spec, onSuccess }: GenUIActionFormProps) {
  const { addRequest } = useAppContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Initialize form state from default values
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const f of spec.fields) {
      initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedEntityId, setSubmittedEntityId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for field on change
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
    setServerError(null);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of spec.fields) {
      const val = formData[field.name];

      // Required check
      if (field.required && (val === undefined || val === null || String(val).trim() === '')) {
        newErrors[field.name] = `${field.label} is required.`;
        continue;
      }

      // String minLength & maxLength
      if (typeof val === 'string' && val.trim() !== '') {
        if (field.minLength && val.trim().length < field.minLength) {
          newErrors[field.name] = `${field.label} must be at least ${field.minLength} characters.`;
        }
        if (field.maxLength && val.trim().length > field.maxLength) {
          newErrors[field.name] = `${field.label} cannot exceed ${field.maxLength} characters.`;
        }
      }

      // Number range
      if (field.type === 'number' && val !== '' && val !== undefined) {
        const num = Number(val);
        if (isNaN(num)) {
          newErrors[field.name] = `${field.label} must be a valid number.`;
        } else {
          if (field.min !== undefined && num < field.min) {
            newErrors[field.name] = `${field.label} cannot be less than ${field.min}.`;
          }
          if (field.max !== undefined && num > field.max) {
            newErrors[field.name] = `${field.label} cannot exceed ${field.max}.`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submitSuccess) return; // Prevent duplicate submissions

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      if (spec.targetEntity === 'request') {
        if (!currentUser) {
          throw new Error('Please log in with your verified campus email to post an item request.');
        }

        // Real integration with AppContext & Firestore
        const requestId = await addRequest({
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category,
          location: formData.location || 'MIT Library',
          neededBy: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          budget: formData.budget ? Number(formData.budget) : undefined,
          requesterId: currentUser.id
        });

        setSubmittedEntityId(requestId);
        setSubmitSuccess(true);
        if (onSuccess) onSuccess(requestId);
      } else {
        // Generic action submission
        await new Promise((res) => setTimeout(res, 600));
        setSubmitSuccess(true);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setServerError(err?.message || 'Failed to submit form. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h5 className="text-xs font-bold text-emerald-900">Submitted Successfully!</h5>
        <p className="text-[11px] text-emerald-800">
          {spec.successMessage || 'Your input has been processed successfully.'}
        </p>
        <div className="pt-2 flex justify-center gap-2">
          {spec.targetEntity === 'request' && (
            <Link
              to="/requests"
              className="rounded-lg bg-[#204b39] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#183a2c] transition"
            >
              View in Requests
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-3 rounded-2xl border border-[#dedcd4] bg-white p-4 shadow-xs"
    >
      <div>
        <h4 className="text-xs font-bold text-[#252b27]">{spec.title}</h4>
        {spec.description && (
          <p className="text-[11px] text-[#555d56] mt-0.5">{spec.description}</p>
        )}
      </div>

      {serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Dynamic Fields */}
      <div className="space-y-2.5 pt-1">
        {spec.fields.map((field: GenUIFormField) => {
          const hasError = Boolean(errors[field.name]);

          return (
            <div key={field.name} className="space-y-1">
              <label
                htmlFor={`genui_field_${field.name}`}
                className="block text-[11px] font-bold text-[#252b27]"
              >
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  id={`genui_field_${field.name}`}
                  rows={2}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs text-[#252b27] placeholder:text-[#717870] focus:outline-hidden focus:ring-2 focus:ring-[#204b39] transition ${
                    hasError ? 'border-red-400 bg-red-50/20' : 'border-[#dedcd4] bg-white'
                  }`}
                />
              ) : field.type === 'select' ? (
                <select
                  id={`genui_field_${field.name}`}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs text-[#252b27] focus:outline-hidden focus:ring-2 focus:ring-[#204b39] transition ${
                    hasError ? 'border-red-400 bg-red-50/20' : 'border-[#dedcd4] bg-white'
                  }`}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`genui_field_${field.name}`}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  min={field.min}
                  max={field.max}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs text-[#252b27] placeholder:text-[#717870] focus:outline-hidden focus:ring-2 focus:ring-[#204b39] transition ${
                    hasError ? 'border-red-400 bg-red-50/20' : 'border-[#dedcd4] bg-white'
                  }`}
                />
              )}

              {/* Validation Error Message */}
              {hasError ? (
                <p className="text-[10px] font-semibold text-red-600">
                  {errors[field.name]}
                </p>
              ) : field.helpText ? (
                <p className="text-[10px] text-[#717870]">{field.helpText}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#204b39] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#183a2c] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>{spec.submitButtonText || 'Submit'}</span>
              <Send className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
