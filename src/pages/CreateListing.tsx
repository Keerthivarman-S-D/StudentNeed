import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, AlertCircle, X, Loader2, Info, ArrowLeft, Clock, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Category, ListingType, Condition } from '../types';
import { uploadImageToCloudinary, validateImageFile, UploadCancelledError } from '../lib/cloudinary';
import { MODERATION_ENDPOINTS } from '../config/api';

const MAX_IMAGES = 4;

export function CreateListing() {
  const navigate = useNavigate();
  const { addListing } = useAppContext();
  const { currentUser, firebaseUser } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<ListingType>('Sale');
  const [condition, setCondition] = useState<Condition>('Good');
  const [category, setCategory] = useState<Category>('Other');
  const [location, setLocation] = useState('');
  const [expirationDays, setExpirationDays] = useState<7 | 15 | 30>(15);
  
  // Cloudinary image upload states
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingFileName, setUploadingFileName] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up any in-flight upload when unmounting
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Handle switching listing types (reset image state when moving to Borrow or Exchange)
  const handleTypeChange = (newType: ListingType) => {
    if (newType === 'Borrow' || newType === 'Exchange') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');
      setUploadedImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    setType(newType);
  };

  // Cancel in-flight upload
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadingFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('Upload cancelled.');
    setTimeout(() => {
      setError((prev) => (prev === 'Upload cancelled.' ? null : prev));
    }, 2500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setError(null);

    if (type === 'Borrow' || type === 'Exchange') {
      setError('Images are not permitted for Borrow or Exchange listings.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const incomingFiles = Array.from(e.target.files);
    if (uploadedImages.length + incomingFiles.length > MAX_IMAGES) {
      setError(`You can upload a maximum of ${MAX_IMAGES} photos.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    for (const file of incomingFiles) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(`"${file.name}": ${validation.error}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    // Upload files sequentially with progress reporting and cancellation support
    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsUploading(true);
      setUploadProgress(0);
      setUploadingFileName(file.name);

      try {
        const secureUrl = await uploadImageToCloudinary(file, {
          folder: 'studentneed/listings',
          signal: controller.signal,
          onProgress: (pct) => setUploadProgress(pct),
        });
        setUploadedImages(prev => [...prev, secureUrl]);
      } catch (err: any) {
        if (err instanceof UploadCancelledError || err.name === 'AbortError') {
          // Handled via cancellation
          setIsUploading(false);
          setUploadProgress(0);
          setUploadingFileName('');
          return;
        }
        console.error('Image upload failed:', err);
        setError('Failed to upload photo. Please try again.');
        break;
      } finally {
        abortControllerRef.current = null;
        setIsUploading(false);
        setUploadProgress(0);
        setUploadingFileName('');
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !firebaseUser) return navigate('/login');

    if (currentUser.status === 'suspended' || currentUser.status === 'banned') {
      setError(`Your account has been ${currentUser.status}. You are not permitted to publish listings.`);
      return;
    }

    if (isUploading) {
      setError('Please wait for your image upload to complete or cancel it.');
      return;
    }

    // Pre-screen content against prohibited items
    try {
      const token = await firebaseUser.getIdToken();
      const modRes = await fetch(MODERATION_ENDPOINTS.checkListing, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim()
        })
      });

      if (modRes.ok) {
        const modData = await modRes.json();
        if (modData.success && modData.data?.action === 'block') {
          setError(`Listing blocked by moderation: This listing appears to contain prohibited items or content (${modData.data.reason || 'prohibited'}). Please review campus marketplace guidelines.`);
          return;
        }
      }
    } catch (modErr) {
      console.warn('Moderation pre-check failed or skipped:', modErr);
    }

    // Enforce empty images for Borrow & Exchange; require image for Sale / Donate
    const isBorrowOrExchange = type === 'Borrow' || type === 'Exchange';
    if (isBorrowOrExchange && uploadedImages.length > 0) {
      setUploadedImages([]);
    }

    const finalImages: string[] = isBorrowOrExchange 
      ? [] 
      : (uploadedImages.length > 0 ? uploadedImages : ['https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800']);
    
    setIsSubmitting(true);
    setError(null);
    setStatusMessage('Publishing your listing…');
    
    try {
      const listingId = await addListing({
        title: title.trim(),
        description: description.trim(),
        price: type === 'Sale' && price ? Number(price) : undefined,
        type,
        condition,
        category,
        location: location.trim(),
        images: finalImages,
        status: 'available',
        expirationDays: expirationDays,
      });
      
      setIsSubmitting(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        navigate(`/listing/${listingId}`);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create listing:', err);
      setIsSubmitting(false);
      setError('Could not publish listing. Please try again.');
    }
  };

  const types: ListingType[] = ['Sale', 'Borrow', 'Donate', 'Exchange'];
  const categories: Category[] = ['Textbooks', 'Electronics', 'Stationery', 'Lab Essentials', 'Hostel Essentials', 'Sports', 'College Wear', 'Other'];
  const conditions: Condition[] = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

  const allowsImages = type === 'Sale' || type === 'Donate';

  if (showSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-32 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-zinc-900 mb-2">Listing Published!</h2>
        <p className="text-zinc-600 text-lg">Your item is now live on the campus marketplace.</p>
        <p className="text-sm text-zinc-400 mt-4">Redirecting to your listing...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-zinc-900">Post an Item</h1>
        <p className="text-zinc-600 mt-1">Fill out the details to list your item on the campus marketplace.</p>
      </div>

      {(currentUser?.status === 'suspended' || currentUser?.status === 'banned') && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <span className="font-semibold block capitalize">Account {currentUser.status}</span>
            <span>Your account is currently restricted from publishing items to the marketplace. Please contact campus administration if you believe this is an error.</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

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
                  onChange={() => handleTypeChange(t)} 
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
                placeholder="Describe the item, any defects, reason for selling/donating..."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Pickup Location on Campus</label>
              <Input 
                required 
                placeholder="e.g. CSE Block, Hostel A, Main Gate" 
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Listing Duration & Expiration Section */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-zinc-900">Listing Duration</h2>
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Auto-Cleanup Enabled
            </span>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            To keep the student marketplace active and prevent stale listings, select how long your item should remain visible. Expired listings are automatically archived and their stored assets are securely removed.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { days: 7 as const, label: '7 Days', desc: 'Urgent / Exam prep / Quick sale' },
              { days: 15 as const, label: '15 Days', desc: 'Standard campus exchange (Recommended)' },
              { days: 30 as const, label: '30 Days', desc: 'Extended / Semester term' },
            ].map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setExpirationDays(opt.days)}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                  expirationDays === opt.days
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm ring-2 ring-zinc-900/10'
                    : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100/80 text-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {expirationDays === opt.days && (
                    <span className="text-[11px] font-medium bg-white/20 px-2 py-0.5 rounded-md text-white">Active</span>
                  )}
                </div>
                <span className={`text-xs ${expirationDays === opt.days ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-zinc-50 border border-zinc-200/80 px-3.5 py-2.5 text-xs text-zinc-600">
            <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
            <span>
              This listing will remain active until{' '}
              <strong className="text-zinc-900">
                {new Date(Date.now() + expirationDays * 86400000).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </strong>
              .
            </span>
          </div>
        </section>

        {/* Photos Section: Only for Sale & Donate. Hidden for Borrow & Exchange */}
        {allowsImages ? (
          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Photos</h2>
              <span className="text-xs text-zinc-500">Max {MAX_IMAGES} photos (up to 5MB each)</span>
            </div>

            {/* Uploaded Image Previews */}
            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
                {uploadedImages.map((src, idx) => (
                  <div key={idx} className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                    <img src={src} alt={`Uploaded ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/80 text-white transition-opacity hover:bg-zinc-900"
                      title="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* In-Flight Upload Card with Cancel Upload Button */}
            {isUploading && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 flex flex-col items-center justify-center text-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-700 mb-2" />
                <p className="text-sm font-semibold text-zinc-900">
                  Uploading image... {uploadProgress > 0 ? `${uploadProgress}%` : ''}
                </p>
                {uploadingFileName && (
                  <p className="text-xs text-zinc-500 mt-0.5 mb-3 truncate max-w-xs">{uploadingFileName}</p>
                )}
                {uploadProgress > 0 && (
                  <div className="w-56 bg-zinc-200 rounded-full h-2 mb-3 overflow-hidden">
                    <div 
                      className="bg-zinc-900 h-2 rounded-full transition-all duration-150" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={handleCancelUpload}
                  className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-8 font-medium"
                >
                  Cancel Upload
                </Button>
              </div>
            )}

            {/* Upload Button */}
            {!isUploading && uploadedImages.length < MAX_IMAGES && (
              <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-zinc-400 hover:bg-zinc-100">
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden" 
                  disabled={isSubmitting || isUploading}
                />
                <ImagePlus className="h-8 w-8 text-zinc-400 mb-2" />
                <span className="text-sm font-medium text-zinc-600">Click to upload photo</span>
                <span className="text-xs text-zinc-400 mt-1">JPG, JPEG, PNG, or WEBP up to 5MB</span>
              </label>
            )}
          </section>
        ) : (
          <section className="space-y-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 p-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">No Photos Required</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Photos are only enabled for items offered for <strong>Sale</strong> or <strong>Donate</strong>. Borrow and Exchange listings do not require or permit photos to keep campus peer requests simple and lightweight.
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSubmitting || isUploading}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting || isUploading || currentUser?.status === 'suspended' || currentUser?.status === 'banned'} className="min-w-[170px]">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {statusMessage || 'Publishing...'}
              </span>
            ) : (
              'Publish Listing'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
