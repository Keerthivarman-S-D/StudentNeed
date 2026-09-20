import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
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
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-zinc-900 mb-2">Request Posted!</h2>
        <p className="text-zinc-600 text-lg">Your campus peers can now see what you're looking for.</p>
        <p className="text-sm text-zinc-400 mt-4">Redirecting to requests...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Can't find what you need?</h1>
        <p className="text-zinc-600 mt-1">Tell the campus what you're looking for.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">What do you need?</label>
          <Input 
            required 
            placeholder="e.g. Scientific Calculator" 
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Category</label>
            <select 
              className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Budget (₹) - Optional</label>
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
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">Description</label>
          <textarea 
            required
            rows={3}
            placeholder="Provide any specific details (model, edition, condition required)..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">When do you need it?</label>
            <Input 
              required 
              placeholder="e.g. Tomorrow morning, Next week" 
              value={neededBy}
              onChange={e => setNeededBy(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Preferred Location</label>
            <Input 
              required 
              placeholder="e.g. Library, Main Gate" 
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4 border-t border-zinc-100">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[140px]">
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
