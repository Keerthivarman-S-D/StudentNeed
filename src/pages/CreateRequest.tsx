import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Category } from '../types';
import { FieldError } from '../components/ui/FieldError';
import { FormAlert } from '../components/ui/FormAlert';
import { formatErrorMessage } from '../lib/errorHandler';

export function CreateRequest() {
  const navigate = useNavigate();
  const locationState = useLocation();
  const repostFrom = (locationState.state as any)?.repostFrom;

  const { addRequest } = useAppContext();
  const { currentUser, firebaseUser } = useAuth();
  
  const [title, setTitle] = useState(repostFrom?.title || '');
  const [description, setDescription] = useState(repostFrom?.description || '');
  const [budget, setBudget] = useState(repostFrom?.budget ? String(repostFrom.budget) : '');
  const [category, setCategory] = useState<Category>(repostFrom?.category || 'Other');
  const [location, setLocation] = useState(repostFrom?.location || '');
  const [neededBy, setNeededBy] = useState(repostFrom?.neededBy || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    neededBy?: string;
    location?: string;
    budget?: string;
  }>({});

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !firebaseUser) return navigate('/login');
    
    // Clear previous error
    setError(null);
    const errors: typeof fieldErrors = {};

    // Form input validation with clear student-friendly guidance
    if (!title.trim()) {
      errors.title = 'Please specify what item you need.';
      setError('Please specify what item you need.');
      setFieldErrors(errors);
      return;
    }
    if (!description.trim()) {
      errors.description = 'Please describe what item you need.';
      setError('Please describe what item you need.');
      setFieldErrors(errors);
      return;
    }
    if (!neededBy.trim()) {
      errors.neededBy = 'Please specify when you need this item.';
      setError('Please specify when you need this item.');
      setFieldErrors(errors);
      return;
    }
    if (!location.trim()) {
      errors.location = 'Please specify your preferred campus meetup location.';
      setError('Please specify your preferred campus meetup location.');
      setFieldErrors(errors);
      return;
    }

    if (budget) {
      const numBudget = Number(budget);
      if (isNaN(numBudget) || numBudget < 0) {
        errors.budget = 'Please enter a valid budget amount.';
        setError('Please enter a valid budget amount.');
        setFieldErrors(errors);
        return;
      }
    }
    
    setFieldErrors({});
    setIsSubmitting(true);
    
    try {
      await addRequest({
        title: title.trim(),
        description: description.trim(),
        budget: budget ? Number(budget) : undefined,
        category,
        location: location.trim(),
        neededBy: neededBy.trim(),
        status: 'open',
      });
      
      setIsSubmitting(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        navigate('/requests');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create request:', err);
      setIsSubmitting(false);
      setError('Could not post request. Please try again.');
    }
  };

  const categories: Category[] = [
    'Textbooks',
    'Electronics',
    'Stationery',
    'Lab Essentials',
    'Hostel Essentials',
    'Sports',
    'College Wear',
    'Other'
  ];

  if (showSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-32 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 shadow-md">
          <CheckCircle2 className="h-10 w-10 text-emerald-700" />
        </div>
        <h2 className="text-3xl font-bold text-brand-charcoal mb-2">Request Posted!</h2>
        <p className="text-zinc-600 text-base max-w-md mx-auto">
          Your campus peers can now see what you&apos;re looking for and reach out directly.
        </p>
        <p className="text-xs text-zinc-400 mt-4 flex items-center justify-center gap-1.5 font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
          <span>Redirecting to campus requests...</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate('/requests')}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#555d56] hover:text-[#252b27] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Requests</span>
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
          Can&apos;t find what you need?
        </h1>
        <p className="mt-1 text-sm text-[#555d56]">
          Post a request for textbooks, lab gear, calculators, or essentials. Peers with spare items can message you.
        </p>
      </div>

      {/* Reposting Alert Banner */}
      {repostFrom && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <Clock className="h-5 w-5 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <span className="font-semibold block text-sm">Reposting Campus Request</span>
            <span className="text-xs text-[#555d56]">Details from your previous request have been prefilled. Submitting will publish a fresh request active for 24 hours.</span>
          </div>
        </div>
      )}

      {/* 24-Hour Expiry Info Notice */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#dedcd4] bg-white p-4 text-xs text-[#555d56]">
        <Clock className="h-4 w-4 shrink-0 mt-0.5 text-[#204b39]" />
        <span>
          Every campus request expires automatically after <strong>24 hours</strong> to ensure requests stay timely and relevant. You can renew your request anytime from <strong>My Requests</strong>.
        </span>
      </div>

      {error && (
        <div className="mb-6">
          <FormAlert error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-xs">
        <div>
          <label htmlFor="req-title" className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
            What do you need? <span className="text-red-500">*</span>
          </label>
          <Input 
            id="req-title"
            required 
            placeholder="e.g. Casio fx-991EX Scientific Calculator, Engineering Mechanics textbook" 
            value={title}
            error={Boolean(fieldErrors.title)}
            onChange={e => {
              setTitle(e.target.value);
              clearFieldError('title');
            }}
            className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
          />
          <FieldError error={fieldErrors.title} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="req-cat" className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
              Category <span className="text-red-500">*</span>
            </label>
            <select 
              id="req-cat"
              className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] font-medium focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="req-budget" className="block text-xs font-bold text-[#252b27] uppercase tracking-wider">Budget (₹)</label>
              <span className="text-[11px] text-[#555d56]">Optional</span>
            </div>
            <Input 
              id="req-budget"
              type="number" 
              min="0"
              placeholder="e.g. 300" 
              value={budget}
              error={Boolean(fieldErrors.budget)}
              onChange={e => {
                setBudget(e.target.value);
                clearFieldError('budget');
              }}
              className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
            />
            <FieldError error={fieldErrors.budget} />
          </div>
        </div>

        <div>
          <label htmlFor="req-desc" className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea 
            id="req-desc"
            required
            rows={4}
            placeholder="Provide any specific details (model, edition, condition required, course/department)..."
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm transition-all shadow-2xs focus:outline-none ${
              fieldErrors.description
                ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-[#dedcd4] text-[#252b27] placeholder:text-[#555d56] focus:border-[#204b39] focus:ring-2 focus:ring-[#204b39]/20'
            }`}
            value={description}
            onChange={e => {
              setDescription(e.target.value);
              clearFieldError('description');
            }}
          />
          <FieldError error={fieldErrors.description} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="req-needed" className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
              When do you need it? <span className="text-red-500">*</span>
            </label>
            <Input 
              id="req-needed"
              required 
              placeholder="e.g. By Friday, Next Monday, Urgent" 
              value={neededBy}
              error={Boolean(fieldErrors.neededBy)}
              onChange={e => {
                setNeededBy(e.target.value);
                clearFieldError('neededBy');
              }}
              className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
            />
            <FieldError error={fieldErrors.neededBy} />
          </div>
          <div>
            <label htmlFor="req-loc" className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
              Preferred Meetup Location <span className="text-red-500">*</span>
            </label>
            <Input 
              id="req-loc"
              required 
              placeholder="e.g. Library, Red Building, Main Gate" 
              value={location}
              error={Boolean(fieldErrors.location)}
              onChange={e => {
                setLocation(e.target.value);
                clearFieldError('location');
              }}
              className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
            />
            <FieldError error={fieldErrors.location} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#dedcd4]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-[#555d56] hover:text-[#252b27] hover:bg-zinc-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#204b39] hover:bg-[#183a2c] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Posting your request…</span>
              </>
            ) : (
              'Post Request'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
export default CreateRequest;
