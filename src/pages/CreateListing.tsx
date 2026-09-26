import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, AlertCircle, X, Loader2, ArrowLeft, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Category, ActiveListingType, Condition, APPROVED_CAMPUS_LOCATIONS, isValidApprovedLocation } from '../types';
import { uploadImageToCloudinary, validateImageFile, UploadCancelledError } from '../lib/cloudinary';
import { MODERATION_ENDPOINTS } from '../config/api';
import { cn } from '../lib/utils';

export function CreateListing() {
  const navigate = useNavigate();
  const { addListing } = useAppContext();
  const { currentUser, firebaseUser } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [wantedItem, setWantedItem] = useState('');
  const [type, setType] = useState<ActiveListingType>('Sale');
  const [condition, setCondition] = useState<Condition>('Good');
  const [category, setCategory] = useState<Category>('Other');
  const [location, setLocation] = useState('');
  const [expirationDays, setExpirationDays] = useState<7 | 15 | 30>(15);
  
  // Up to 3 photos
  const MAX_IMAGES = 3;
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingFileName, setUploadingFileName] = useState<string>('');
  const [photoAddedFeedback, setPhotoAddedFeedback] = useState(false);
  
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

  // Handle switching listing types
  const handleTypeChange = (newType: ActiveListingType) => {
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
    setPhotoAddedFeedback(false);

    const selectedFiles = Array.from(e.target.files);
    if (uploadedImages.length + selectedFiles.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed per listing.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    for (const file of selectedFiles) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsUploading(true);
    setUploadProgress(0);

    const newlyUploaded: string[] = [];
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadingFileName(file.name);
        const secureUrl = await uploadImageToCloudinary(file, {
          folder: 'studentneed/listings',
          signal: controller.signal,
          onProgress: (pct) => {
            const overall = Math.round(((i + pct / 100) / selectedFiles.length) * 100);
            setUploadProgress(overall);
          },
        });
        newlyUploaded.push(secureUrl);
      }
      setUploadedImages((prev) => [...prev, ...newlyUploaded].slice(0, MAX_IMAGES));
      setPhotoAddedFeedback(true);
      setTimeout(() => setPhotoAddedFeedback(false), 3000);
    } catch (err: any) {
      if (err instanceof UploadCancelledError || err.name === 'AbortError') {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadingFileName('');
        return;
      }
      console.error('Image upload failed:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      abortControllerRef.current = null;
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setPhotoAddedFeedback(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

    if (type === 'Exchange' && !wantedItem.trim()) {
      setError('Please specify what item you are looking for in exchange.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    if (trimmedTitle.length > 50) {
      setError('Title cannot exceed 50 characters.');
      return;
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    if (trimmedDesc.length > 100) {
      setError('Description cannot exceed 100 characters.');
      return;
    }

    const trimmedLoc = location.trim();
    if (!isValidApprovedLocation(trimmedLoc)) {
      setError('Please select an approved campus pickup location.');
      return;
    }

    if (type === 'Sale') {
      const parsedPrice = Number(price);
      if (!price || isNaN(parsedPrice) || parsedPrice < 1) {
        setError('Minimum listing price is ₹1.');
        return;
      }
      if (parsedPrice > 10000) {
        setError('Maximum listing price is ₹10,000.');
        return;
      }
    }

    if (uploadedImages.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed per listing.`);
      return;
    }

    const finalImages: string[] = uploadedImages.slice(0, MAX_IMAGES);
    
    setIsSubmitting(true);
    setError(null);
    setStatusMessage('Publishing your listing…');
    
    try {
      const listingId = await addListing({
        title: trimmedTitle,
        description: trimmedDesc,
        price: type === 'Sale' && price ? Number(price) : undefined,
        wantedItem: type === 'Exchange' ? wantedItem.trim() : undefined,
        type,
        condition,
        category,
        location: trimmedLoc,
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
      setError(err?.message || 'Could not publish listing. Please try again.');
    }
  };

  const types: ActiveListingType[] = ['Sale', 'Donate', 'Exchange'];
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
        <section className="space-y-4 rounded-2xl border border-brand-border bg-white p-6">
          <h2 className="text-lg font-semibold text-brand-charcoal">What are you offering?</h2>
          <div className="grid grid-cols-3 gap-3">
            {types.map(t => (
              <label 
                key={t}
                className={`flex cursor-pointer items-center justify-center rounded-xl border p-4 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-brand-teal focus-within:ring-offset-2 ${
                  type === t 
                    ? 'border-brand-teal bg-brand-teal text-white shadow-xs' 
                    : 'border-brand-border bg-white text-zinc-600 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="type" 
                  className="sr-only" 
                  checked={type === t} 
                  onChange={() => handleTypeChange(t)} 
                />
                {t === 'Sale' ? 'Sell' : t}
              </label>
            ))}
          </div>
        </section>

        {/* Basic Details */}
        <section className="space-y-4 rounded-2xl border border-brand-border bg-white p-6">
          <h2 className="text-lg font-semibold text-brand-charcoal">Item Details</h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-brand-charcoal">Title</label>
                <span className="text-xs text-brand-muted">{title.length} / 50</span>
              </div>
              <Input 
                required 
                minLength={3}
                maxLength={50}
                placeholder="e.g. Casio Scientific Calculator" 
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              {title.length > 0 && title.trim().length < 3 && (
                <p className="mt-1 text-xs text-red-600 font-medium">Title must be at least 3 characters.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-charcoal">Category</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  value={category}
                  onChange={e => setCategory(e.target.value as Category)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-charcoal">Condition</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  value={condition}
                  onChange={e => setCondition(e.target.value as Condition)}
                >
                  {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {type === 'Sale' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-charcoal">Price (₹)</label>
                <Input 
                  required 
                  type="number" 
                  min="1"
                  max="10000"
                  placeholder="e.g. 450" 
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
                {price !== '' && Number(price) >= 1 && Number(price) <= 10000 && (
                  <p className="mt-1 text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid.
                  </p>
                )}
                {price !== '' && Number(price) < 1 && (
                  <p className="mt-1 text-xs text-red-600 font-medium">Minimum listing price is ₹1.</p>
                )}
                {price !== '' && Number(price) > 10000 && (
                  <p className="mt-1 text-xs text-red-600 font-medium">Maximum listing price is ₹10,000.</p>
                )}
              </div>
            )}

            {type === 'Exchange' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-charcoal">
                  Wanted in exchange <span className="text-red-500">*</span>
                </label>
                <Input 
                  required 
                  placeholder="e.g. Scientific Calculator, Lab Coat, Engineering Book" 
                  value={wantedItem}
                  onChange={e => setWantedItem(e.target.value)}
                />
                <p className="mt-1 text-xs text-brand-muted">Specify the item or equipment you wish to trade for.</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-brand-charcoal">Description</label>
                <span className={cn("text-xs", description.length >= 100 ? "text-amber-600 font-semibold" : "text-brand-muted")}>
                  {description.length} / 100
                </span>
              </div>
              <textarea 
                required
                rows={4}
                maxLength={100}
                placeholder="Describe the item, condition, defects, or reasons for giving away..."
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                {description.length > 0 && description.trim().length < 10 ? (
                  <span className="text-red-600 font-medium">Description must be at least 10 characters.</span>
                ) : (
                  <span className="text-brand-muted">Between 10 and 100 characters.</span>
                )}
              </div>
            </div>
            
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-charcoal">Pickup Location on Campus</label>
              <select 
                required 
                className="flex h-10 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all"
                value={location}
                onChange={e => setLocation(e.target.value)}
              >
                <option value="" disabled>Select approved campus pickup location...</option>
                {APPROVED_CAMPUS_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Listing Duration & Expiration Section */}
        <section className="space-y-4 rounded-2xl border border-brand-border bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-teal" />
              <h2 className="text-lg font-semibold text-brand-charcoal">How long should your listing stay active?</h2>
            </div>
            <span className="text-xs font-medium text-brand-teal-hover bg-brand-teal-light px-2.5 py-1 rounded-full border border-brand-teal-border">
              Automatic expiry
            </span>
          </div>

          <p className="text-xs text-brand-muted leading-relaxed">
            Choose how long you want your item to be available. After this period, the listing will no longer be active.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { days: 7 as const, label: '7 Days', desc: 'Best for quick sales or urgent needs' },
              { days: 15 as const, label: '15 Days', desc: 'Good for most campus listings' },
              { days: 30 as const, label: '30 Days', desc: 'Best for longer-term or semester needs' },
            ].map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setExpirationDays(opt.days)}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                  expirationDays === opt.days
                    ? 'border-brand-teal bg-brand-teal text-white shadow-xs ring-2 ring-brand-teal/20'
                    : 'border-brand-border bg-slate-50/60 hover:bg-slate-100 text-brand-charcoal'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {expirationDays === opt.days && (
                    <span className="text-[11px] font-medium bg-white/20 px-2 py-0.5 rounded-md text-white">Active</span>
                  )}
                </div>
                <span className={`text-xs ${expirationDays === opt.days ? 'text-zinc-100' : 'text-brand-muted'}`}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-brand-border px-3.5 py-2.5 text-xs text-brand-muted">
            <Calendar className="h-4 w-4 text-brand-teal shrink-0" />
            <span>
              Your listing will stay active until{' '}
              <strong className="text-brand-charcoal">
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

        {/* Photo Section: Optional photos (up to 3) */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Photos (Optional)</h2>
              <p className="text-xs text-zinc-500">Up to 3 photos (up to 5MB each)</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-zinc-600">
              {uploadedImages.length} / {MAX_IMAGES}
            </span>
          </div>

          {/* Uploaded Images Preview Grid */}
          {uploadedImages.length > 0 && !isUploading && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {uploadedImages.map((imgUrl, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                    <img src={imgUrl} alt={`Upload ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/80 text-white transition-opacity hover:bg-zinc-900"
                      title="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
              {photoAddedFeedback && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-teal-hover bg-brand-teal-light px-2.5 py-1 rounded-full border border-brand-teal-border">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-teal" /> Photos updated
                </span>
              )}
            </div>
          )}

          {/* In-Flight Upload Card with Cancel Upload Button */}
          {isUploading && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 flex flex-col items-center justify-center text-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-700 mb-2" />
              <p className="text-sm font-semibold text-zinc-900">
                Uploading photo… {uploadProgress > 0 ? `${uploadProgress}%` : ''}
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

          {/* Upload Dropzone (when fewer than 3 photos and not uploading) */}
          {!isUploading && uploadedImages.length < MAX_IMAGES && (
            <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-zinc-400 hover:bg-zinc-100">
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileChange}
                className="hidden" 
                disabled={isSubmitting || isUploading}
              />
              <ImagePlus className="h-7 w-7 text-zinc-400 mb-1" />
              <span className="text-sm font-medium text-zinc-600">Click to upload photo ({uploadedImages.length}/3)</span>
              <span className="text-xs text-zinc-400 mt-0.5">JPG, JPEG, PNG, or WEBP up to 5MB</span>
            </label>
          )}
        </section>

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
