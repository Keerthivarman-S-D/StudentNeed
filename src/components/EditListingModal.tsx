import React, { useState } from 'react';
import { X, Loader2, AlertCircle, ShieldAlert, CheckCircle2, ImagePlus, Trash2, Clock, Calendar, Check } from 'lucide-react';
import { Listing, Category, Condition, UpdateListingInput, ActiveListingType, ListingType, APPROVED_CAMPUS_LOCATIONS, isValidApprovedLocation } from '../types';
import { useAppContext } from '../context/AppContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';
import { cn } from '../lib/utils';

const CATEGORIES: Category[] = [
  'Stationery',
  'Textbooks',
  'Electronics',
  'Lab Essentials',
  'Hostel Essentials',
  'Sports',
  'College Wear',
  'Other',
];

const CONDITIONS: Condition[] = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
const ACTIVE_TYPES: ActiveListingType[] = ['Sale', 'Donate', 'Exchange'];
const MAX_IMAGES = 3;

interface EditListingModalProps {
  listing: Listing;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditListingModal({ listing, isOpen, onClose, onSuccess }: EditListingModalProps) {
  const { updateListing } = useAppContext();

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(listing.price !== undefined ? String(listing.price) : '');
  const [wantedItem, setWantedItem] = useState(listing.wantedItem || '');
  const [type, setType] = useState<ListingType>(listing.type);
  const [category, setCategory] = useState<Category>(listing.category);
  const [condition, setCondition] = useState<Condition>(listing.condition || 'Good');
  const [location, setLocation] = useState(listing.location);
  const [images, setImages] = useState<string[]>(listing.images ? [...listing.images].slice(0, MAX_IMAGES) : []);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isTerminal = listing.status === 'completed' || listing.status === 'cancelled';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_IMAGES} photos allowed per listing.`);
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    for (const file of selectedFiles) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file.');
        return;
      }
    }

    setError(null);
    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const url = await uploadImageToCloudinary(file, { folder: 'studentneed/listings' });
        uploadedUrls.push(url);
      }
      setImages((prev) => [...prev, ...uploadedUrls].slice(0, MAX_IMAGES));
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (isTerminal) {
      setError(`Cannot edit a listing with status "${listing.status}".`);
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
      setError('Title must be between 3 and 50 characters.');
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10 || trimmedDesc.length > 100) {
      setError('Description must be between 10 and 100 characters.');
      return;
    }

    const trimmedLoc = location.trim();
    if (!trimmedLoc) {
      setError('Campus/pickup location cannot be empty.');
      return;
    }
    if (!isValidApprovedLocation(trimmedLoc)) {
      setError(`Please select an approved campus location: ${APPROVED_CAMPUS_LOCATIONS.join(', ')}.`);
      return;
    }

    if (type === 'Sale') {
      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice < 1 || parsedPrice > 10000) {
        setError('Price must be between ₹1 and ₹10,000 for sale items.');
        return;
      }
    }

    if (images.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    setIsSaving(true);
    try {
      const updates: UpdateListingInput = {
        title: trimmedTitle,
        description: trimmedDesc,
        category,
        location: trimmedLoc,
        images: images.slice(0, MAX_IMAGES),
      };

      if (type !== listing.type) {
        updates.type = type;
      }

      if (type !== 'Borrow') {
        updates.condition = condition;
      }

      if (type === 'Sale') {
        updates.price = Number(price);
      }

      if (type === 'Exchange') {
        const trimmedWanted = wantedItem.trim();
        if (!trimmedWanted) {
          setError('Please specify what item you are looking for in exchange.');
          setIsSaving(false);
          return;
        }
        updates.wantedItem = trimmedWanted;
      }

      // Security guarantee: sellerId, createdAt, expiresAt, and expirationDays
      // are omitted from updates so they remain immutable on Firestore.
      await updateListing(listing.id, updates);
      setSuccessMessage('Listing updated successfully!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to update listing:', err);
      setError('Failed to update listing. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      id="edit-listing-modal" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#173e2d]/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-listing-title"
    >
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-[#dedcd4] my-8 space-y-5 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#dedcd4]">
          <div>
            <h2 id="edit-listing-title" className="text-xl font-bold text-[#252b27]">Edit Listing</h2>
            <p className="text-xs text-[#555d56] mt-0.5">
              Update listing details while preserving security immutability guarantees
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#555d56] hover:bg-[#edf1ec] hover:text-[#204b39] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39]"
            aria-label="Close edit listing modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-red-700 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl bg-[#edf1ec] border border-[#dedcd4] p-3.5 flex items-center gap-2.5 text-[#204b39] text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#204b39]" />
            <span>{successMessage}</span>
          </div>
        )}

        {isTerminal ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-900 space-y-3">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
              Listing is locked
            </div>
            <p className="text-xs leading-relaxed text-amber-800">
              This listing is marked as <strong className="capitalize">{listing.status}</strong>. Terminal exchange records cannot be edited to ensure trust and transaction history integrity.
            </p>
            <div className="pt-1">
              <Button variant="outline" onClick={onClose} className="h-9 text-xs">Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Title <span className="text-red-500">*</span>
                </label>
                <span className={cn(
                  "text-[11px] font-mono",
                  title.trim().length >= 3 && title.trim().length <= 50 ? "text-zinc-400" : "text-amber-700 font-semibold"
                )}>
                  {title.trim().length} / 50 (min 3)
                </span>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scientific Calculator - Casio fx-991EX"
                required
                minLength={3}
                maxLength={50}
              />
            </div>

            {/* Offering Type / Legacy Borrow Conversion */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                Offering Type <span className="text-red-500">*</span>
              </label>
              {type === 'Borrow' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    Legacy Borrow Listing
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Borrow listings have been retired from the active marketplace. Choose an active option to convert this listing:
                  </p>
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {ACTIVE_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setType(t);
                          if (!price && t === 'Sale') setPrice('100');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 font-bold text-zinc-800 hover:bg-amber-100 hover:border-amber-400 transition-colors shadow-2xs text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                      >
                        Convert to {t === 'Sale' ? 'Sell' : t}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ActiveListingType)}
                  className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] font-medium focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
                >
                  <option value="Sale">Sell</option>
                  <option value="Donate">Donate</option>
                  <option value="Exchange">Exchange</option>
                </select>
              )}
            </div>

            {/* Category and Condition */}
            <div className={`grid ${type !== 'Borrow' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] font-medium focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {type !== 'Borrow' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                    Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as Condition)}
                    className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] font-medium focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
                  >
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Price (Sale only) */}
            {type === 'Sale' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">₹1 – ₹10,000</span>
                </div>
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 450"
                  required
                />
                {price && (Number(price) < 1 || Number(price) > 10000) && (
                  <p className="mt-1 text-xs text-red-600 font-medium">Price must be between ₹1 and ₹10,000.</p>
                )}
              </div>
            )}

            {/* Wanted Item (Exchange only) */}
            {type === 'Exchange' && (
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                  Wanted in exchange <span className="text-red-500">*</span>
                </label>
                <Input
                  value={wantedItem}
                  onChange={(e) => setWantedItem(e.target.value)}
                  placeholder="e.g. Scientific Calculator, Lab Coat, Engineering Book"
                  required
                  maxLength={100}
                />
                <p className="mt-1 text-xs text-zinc-500">Specify the item or equipment you wish to trade for.</p>
              </div>
            )}

            {/* Campus / Meetup Location */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                Campus / Meetup Location <span className="text-red-500">*</span>
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] font-medium focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
                required
              >
                {!APPROVED_CAMPUS_LOCATIONS.includes(location as any) && (
                  <option value={location}>{location} (Current Location)</option>
                )}
                {APPROVED_CAMPUS_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Description <span className="text-red-500">*</span>
                </label>
                <span
                  className={cn(
                    "text-[11px] font-mono",
                    description.trim().length >= 10 && description.trim().length <= 100
                      ? "text-zinc-400"
                      : "text-amber-700 font-semibold"
                  )}
                >
                  {description.length} / 100
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[#dedcd4] bg-[#faf9f5] focus:bg-white p-3.5 text-sm text-[#252b27] focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
                placeholder="Provide detailed description of the item (10–100 characters)..."
                required
                maxLength={100}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Must be between 10 and 100 characters.
              </p>
            </div>

            {/* Photos (Optional, max 3) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Photos <span className="text-zinc-400 font-normal lowercase">(Optional, max {MAX_IMAGES})</span>
                </label>
                <span className="text-[11px] text-zinc-400">{images.length} / {MAX_IMAGES}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {images.map((imgUrl, index) => (
                  <div key={index} className="relative h-20 w-20 rounded-2xl overflow-hidden border border-[#dedcd4] bg-[#faf9f5] shrink-0 shadow-2xs">
                    <img src={imgUrl} alt={`Listing photo ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1.5 right-1.5 bg-black/75 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                      title="Remove photo"
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {images.length < MAX_IMAGES && (
                  <label className="h-20 w-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dedcd4] hover:border-[#204b39] hover:bg-[#edf1ec]/40 bg-[#faf9f5] cursor-pointer text-[#555d56] hover:text-[#204b39] transition-all focus-within:ring-2 focus-within:ring-[#204b39]">
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#204b39]" />
                    ) : (
                      <>
                        <ImagePlus className="h-5 w-5 mb-1 text-[#555d56]" />
                        <span className="text-[10px] font-bold">Add photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
              {isUploading && (
                <p className="text-xs text-[#204b39] font-medium mt-2 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#204b39]" />
                  Uploading photo…
                </p>
              )}
            </div>

            {/* Security Notice on Protected Fields */}
            <div className="rounded-2xl bg-[#faf9f5] border border-[#dedcd4] p-4 text-xs text-[#555d56] space-y-1.5">
              <div className="font-bold text-[#252b27] flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-[#555d56]" />
                Protected Security Attributes (Immutable)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-0.5 text-[#555d56]">
                <div>
                  <span className="font-semibold text-[#252b27]">Listing Owner:</span> {listing.sellerId.substring(0, 10)}...
                </div>
                <div>
                  <span className="font-semibold text-[#252b27]">Created:</span> {new Date(listing.createdAt).toLocaleDateString()}
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-[#252b27]">Expires:</span> {new Date(listing.expiresAt).toLocaleDateString()} (Fixed: cannot be extended via edit)
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dedcd4]">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-10 border-[#dedcd4] text-[#555d56] hover:bg-[#edf1ec] hover:text-[#204b39]">
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isUploading} className="h-10 min-w-[140px] bg-[#204b39] hover:bg-[#183a2c] text-white font-semibold shadow-xs">
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving Changes...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
