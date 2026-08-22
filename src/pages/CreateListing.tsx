import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Upload, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Category, ListingType, Condition, Listing } from '../types';

export function CreateListing() {
  const navigate = useNavigate();
  const { addListing } = useAppContext();
  const { currentUser } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<ListingType>('Sale');
  const [condition, setCondition] = useState<Condition>('Good');
  const [category, setCategory] = useState<Category>('Other');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Mock image for prototype
  const mockImage = 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return navigate('/login');
    
    setIsSubmitting(true);
    
    // Simulate network delay
    setTimeout(() => {
      const newListing: Listing = {
        id: `l_${Date.now()}`,
        title,
        description,
        price: type === 'Sale' ? Number(price) : undefined,
        type,
        condition,
        category,
        location,
        sellerId: currentUser.id,
        images: [mockImage],
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      addListing(newListing);
      setIsSubmitting(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        navigate(`/listing/${newListing.id}`);
      }, 2000);
    }, 1000);
  };

  const types: ListingType[] = ['Sale', 'Borrow', 'Donate', 'Exchange'];
  const categories: Category[] = ['Textbooks', 'Electronics', 'Stationery', 'Lab Essentials', 'Hostel Essentials', 'Sports', 'College Wear', 'Other'];
  const conditions: Condition[] = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

  if (showSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-32 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-zinc-900 mb-2">Listing Published!</h2>
        <p className="text-zinc-600 text-lg">Your item is now visible to students on campus.</p>
        <p className="text-sm text-zinc-400 mt-4">Redirecting to your listing...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Post an Item</h1>
        <p className="text-zinc-600 mt-1">Fill out the details to list your item on the campus marketplace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Type Selection */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">What are you offering?</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {types.map(t => (
              <label 
                key={t}
                className={`flex cursor-pointer items-center justify-center rounded-xl border p-4 text-sm font-medium transition-colors ${
                  type === t 
                    ? 'border-zinc-900 bg-zinc-900 text-white' 
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="type" 
                  className="hidden" 
                  checked={type === t} 
                  onChange={() => setType(t)} 
                />
                {t}
              </label>
            ))}
          </div>
        </section>

        {/* Basic Details */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Item Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Title</label>
              <Input 
                required 
                placeholder="e.g. Casio Scientific Calculator" 
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Condition</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  value={condition}
                  onChange={e => setCondition(e.target.value as Condition)}
                >
                  {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {type === 'Sale' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Price (₹)</label>
                <Input 
                  required 
                  type="number" 
                  min="0"
                  placeholder="e.g. 450" 
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Description</label>
              <textarea 
                required
                rows={4}
                placeholder="Describe the item, any defects, reason for selling..."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Pickup Location on Campus</label>
              <Input 
                required 
                placeholder="e.g. CSE Block, Hostel A" 
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Photos (Mock) */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Photos</h2>
          <div className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-zinc-400 hover:bg-zinc-100">
            <ImagePlus className="h-8 w-8 text-zinc-400 mb-2" />
            <span className="text-sm font-medium text-zinc-600">Click to upload photos</span>
            <span className="text-xs text-zinc-400 mt-1">Prototype mode: A mock image will be used.</span>
          </div>
        </section>

        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Publishing...' : 'Publish Listing'}
          </Button>
        </div>
      </form>
    </div>
  );
}
