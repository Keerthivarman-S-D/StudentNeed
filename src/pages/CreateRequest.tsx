import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowLeft, Sparkles, HelpCircle, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Category } from '../types';

export function CreateRequest() {
  const navigate = useNavigate();
  const { addRequest } = useAppContext();
  const { currentUser, firebaseUser } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [location, setLocation] = useState('');
  const [neededBy, setNeededBy] = useState('');
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
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-lg px-1 py-0.5"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 text-zinc-500" />
          <span>Back</span>
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">Can&apos;t find what you need?</h1>
            <p className="text-zinc-600 text-sm mt-1">
              Ask fellow students across campus. <span className="font-semibold text-emerald-800">Find → Connect → Meet</span>.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Campus Request
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-zinc-700 uppercase tracking-wider">
            What do you need? <span className="text-red-500">*</span>
          </label>
          <Input 
            required 
            placeholder="e.g. Casio fx-991EX Scientific Calculator, Engineering Mechanics textbook" 
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Category <span className="text-red-500">*</span>
            </label>
            <select 
              className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-3.5 py-2 text-sm text-brand-charcoal font-medium focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all shadow-2xs"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">Budget (₹)</label>
              <span className="text-[11px] text-zinc-400">Optional</span>
            </div>
            <Input 
              type="number" 
              min="0"
              placeholder="e.g. 300" 
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea 
            required
            rows={4}
            placeholder="Provide any specific details (model, edition, condition required, course/department)..."
            className="w-full rounded-xl border border-brand-border bg-white px-3.5 py-2.5 text-sm text-brand-charcoal focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all shadow-2xs placeholder:text-zinc-400"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              When do you need it? <span className="text-red-500">*</span>
            </label>
            <Input 
              required 
              placeholder="e.g. By Friday, Next Monday, Urgent" 
              value={neededBy}
              onChange={e => setNeededBy(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Preferred Meetup Location <span className="text-red-500">*</span>
            </label>
            <Input 
              required 
              placeholder="e.g. Library, Red Building, Main Gate" 
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[150px] h-11 font-bold">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Posting your request…
              </span>
            ) : (
              'Post Request'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
