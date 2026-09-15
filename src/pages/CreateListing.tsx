import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, AlertCircle, X, Loader2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { storage } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Category, ListingType, Condition } from '../types';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track preview URLs to revoke on unmount and prevent memory leaks
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = imagePreviews;

  useEffect(() => {
    return () => {
      previewsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setError(null);

    const incomingFiles = Array.from(e.target.files);
    if (selectedFiles.length + incomingFiles.length > MAX_IMAGES) {
      setError(`You can upload a maximum of ${MAX_IMAGES} photos.`);
      return;
    }

    for (const file of incomingFiles) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setError(`"${file.name}" has an unsupported format. Please upload JPG, PNG, WEBP, or GIF images.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`"${file.name}" exceeds the 5MB size limit. Please choose a smaller image.`);
        return;
      }
    }

    const newPreviews = incomingFiles.map(file => URL.createObjectURL(file));
    setSelectedFiles(prev => [...prev, ...incomingFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
    e.target.value = ''; // Reset input to allow re-selection
  };

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImagesToStorage = async (uid: string): Promise<string[]> => {
    if (selectedFiles.length === 0) {
      // Default clean placeholder if no image was selected
      return ['https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800'];
    }

    const downloadUrls: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setStatusMessage(`Uploading photo ${i + 1} of ${selectedFiles.length}...`);
      
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePath = `listings/${uid}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${safeName}`;
      const storageRef = ref(storage, uniquePath);

      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: uid,
          originalName: file.name
        }
      };

      const uploadResult = await uploadBytes(storageRef, file, metadata);
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      downloadUrls.push(downloadUrl);
    }
    return downloadUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !firebaseUser) return navigate('/login');
    
    setIsSubmitting(true);
    setError(null);
    setStatusMessage('Preparing upload...');
    
    try {
      // 1. Upload images to Firebase Storage scoped by authenticated UID
      const uploadedImageUrls = await uploadImagesToStorage(firebaseUser.uid);
      
      // 2. Create listing document in Firestore with resulting Storage URLs
      setStatusMessage('Publishing listing to Firestore...');
      const listingId = await addListing({
        title: title.trim(),
        description: description.trim(),
        price: type === 'Sale' && price ? Number(price) : undefined,
        type,
        condition,
        category,
        location: location.trim(),
        sellerId: firebaseUser.uid, // strictly enforced from authenticated user
        images: uploadedImageUrls,
        status: 'available',
      });
      
      imagePreviews.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });

      setIsSubmitting(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        navigate(`/listing/${listingId}`);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create listing:', err);
      setIsSubmitting(false);
      setError(err.message || 'Failed to upload photo or publish listing. Please try again.');
    }
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
        <p className="text-zinc-600 text-lg">Your item and photos are now live on the campus marketplace.</p>
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

        {/* Photos (Firebase Storage) */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Photos</h2>
            <span className="text-xs text-zinc-500">Max {MAX_IMAGES} photos (up to 5MB each)</span>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
              {imagePreviews.map((src, idx) => (
                <div key={idx} className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  <img src={src} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
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

          {selectedFiles.length < MAX_IMAGES && (
            <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-zinc-400 hover:bg-zinc-100">
              <input 
                type="file" 
                multiple 
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden" 
                disabled={isSubmitting}
              />
              <ImagePlus className="h-8 w-8 text-zinc-400 mb-2" />
              <span className="text-sm font-medium text-zinc-600">Click to upload photos</span>
              <span className="text-xs text-zinc-400 mt-1">JPG, PNG, WEBP, or GIF up to 5MB</span>
            </label>
          )}
        </section>

        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[170px]">
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

