import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowLeft, Sparkles, HelpCircle, CheckCircle2, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Category } from '../types';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !firebaseUser) return navigate('/login');
    
    // Clear previous error
    setError(null);

    // Form input validation with clear student-friendly guidance
    if (!title.trim()) {
      setError('Please specify what item you need.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe what item you need.');
      return;
    }
    if (!neededBy.trim()) {
      setError('Please specify when you need this item.');
      return;
    }
    if (!location.trim()) {
      setError('Please specify your preferred campus meetup location.');
      return;
    }
    
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

  const categories: Category[] = ['Textbooks', 'Electronics', 'Stationery', 'Lab Essentials', 'Hostel Essentials', 'Sports', 'College Wear', 'Other'];

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
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-[#555d56] hover:text-[#252b27] mb-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] rounded-lg px-1 py-0.5"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 text-[#555d56]" />
          <span>Back to Requests</span>
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#252b27] tracking-tight">Can&apos;t find what you need?</h1>
            <p className="text-[#555d56] text-sm mt-1">
              Ask fellow students across campus. <span className="font-semibold text-[#204b39]">Find → Connect → Meet</span>.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#edf1ec] px-3.5 py-1 text-xs font-semibold text-[#204b39] border border-[#dedcd4]">
            <Sparkles className="h-3.5 w-3.5 text-[#204b39]" />
            Campus Request
          </span>
        </div>
      </div>

      {repostFrom && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#204b39]/20 bg-[#edf1ec] p-4 text-[#204b39] text-sm">
          <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-[#204b39]" />
          <div>
            <span className="font-bold block">Reposting Campus Request</span>
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
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-8 shadow-xs">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
            What do you need? <span className="text-red-500">*</span>
          </label>
          <Input 
            required 
            placeholder="e.g. Casio fx-991EX Scientific Calculator, Engineering Mechanics textbook" 
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
              Category <span className="text-red-500">*</span>
            </label>
            <select 
              className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] font-medium focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#252b27] uppercase tracking-wider">Budget (₹)</label>
              <span className="text-[11px] text-[#555d56]">Optional</span>
            </div>
            <Input 
              type="number" 
              min="0"
              placeholder="e.g. 300" 
              value={budget}
              onChange={e => setBudget(e.target.value)}
              className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea 
            required
            rows={4}
            placeholder="Provide any specific details (model, edition, condition required, course/department)..."
            className="w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2.5 text-sm text-[#252b27] focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs placeholder:text-[#555d56]"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
              When do you need it? <span className="text-red-500">*</span>
            </label>
            <Input 
              required 
              placeholder="e.g. By Friday, Next Monday, Urgent" 
              value={neededBy}
              onChange={e => setNeededBy(e.target.value)}
              className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#252b27] uppercase tracking-wider">
              Preferred Meetup Location <span className="text-red-500">*</span>
            </label>
            <Input 
              required 
              placeholder="e.g. Library, Red Building, Main Gate" 
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#dedcd4]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-[#555d56] hover:text-[#252b27] hover:bg-zinc-100 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[150px] h-11 px-6 rounded-xl font-semibold text-sm text-white bg-[#204b39] hover:bg-[#183a2c] transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                Posting your request…
              </span>
            ) : (
              'Post Request'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
