import React, { useState } from 'react';
import { X, Loader2, AlertCircle, ShieldAlert, CheckCircle2, ImagePlus, Trash2 } from 'lucide-react';
import { Listing, Category, Condition, UpdateListingInput, ActiveListingType, ListingType, APPROVED_CAMPUS_LOCATIONS, isValidApprovedLocation } from '../types';
import { useAppContext } from '../context/AppContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';

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
    <div id="edit-listing-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-brand-border my-8">
        <div className="flex items-center justify-between pb-4 border-b border-brand-border/60">
          <div>
            <h2 className="text-xl font-bold text-brand-charcoal">Edit Listing</h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Update listing details while preserving security immutability guarantees.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-xl bg-brand-teal-light border border-brand-teal-border p-3.5 flex items-center gap-2 text-brand-teal-hover text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-teal" />
            <span>{successMessage}</span>
          </div>
        )}

        {isTerminal ? (
          <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Listing is locked
            </div>
            <p>
              This listing is marked as <strong className="capitalize">{listing.status}</strong>. Terminal exchange records cannot be edited to ensure trust and transaction history integrity.
            </p>
            <div className="pt-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Title <span className="text-red-500">*</span>
                </label>
                <span className={`text-[11px] ${title.trim().length >= 3 && title.trim().length <= 50 ? 'text-zinc-400' : 'text-amber-600 font-medium'}`}>
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
              <label className="block text-xs font-semibold text-brand-charcoal mb-1">
                Offering Type <span className="text-red-500">*</span>
              </label>
              {type === 'Borrow' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    Legacy Borrow Listing
                  </div>
                  <p className="text-amber-700">
                    Borrow listings have been retired from the active marketplace. Choose an active option to convert this listing:
                  </p>
                  <div className="flex gap-2 pt-1">
                    {ACTIVE_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setType(t);
                          if (!price && t === 'Sale') setPrice('100');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-semibold text-zinc-800 hover:bg-amber-100 hover:border-amber-400 transition shadow-xs text-xs"
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
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 focus:outline-hidden"
                >
                  <option value="Sale">Sell</option>
                  <option value="Donate">Donate</option>
                  <option value="Exchange">Exchange</option>
                </select>
              )}
            </div>

            <div className={`grid ${type !== 'Borrow' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <div>
                <label className="block text-xs font-semibold text-brand-charcoal mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 focus:outline-hidden"
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
                  <label className="block text-xs font-semibold text-brand-charcoal mb-1">
                    Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as Condition)}
                    className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 focus:outline-hidden"
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

            {type === 'Sale' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-brand-charcoal">
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
                  <p className="mt-1 text-xs text-red-500">Price must be between ₹1 and ₹10,000.</p>
                )}
              </div>
            )}

            {type === 'Exchange' && (
              <div>
                <label className="block text-xs font-semibold text-brand-charcoal mb-1">
                  Wanted in exchange <span className="text-red-500">*</span>
                </label>
                <Input
                  value={wantedItem}
                  onChange={(e) => setWantedItem(e.target.value)}
                  placeholder="e.g. Scientific Calculator, Lab Coat, Engineering Book"
                  required
                  maxLength={100}
                />
                <p className="mt-1 text-[11px] text-brand-muted">Specify the item or equipment you wish to trade for.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-brand-charcoal mb-1">
                Campus / Meetup Location <span className="text-red-500">*</span>
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 focus:outline-hidden"
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

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Description <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    description.trim().length >= 10 && description.trim().length <= 100
                      ? 'text-zinc-400'
                      : 'text-amber-600 font-semibold'
                  }`}
                >
                  {description.length} / 100
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-brand-border bg-white p-3 text-sm text-brand-charcoal focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 focus:outline-hidden"
                placeholder="Provide detailed description of the item (10–100 characters)..."
                required
                maxLength={100}
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Must be between 10 and 100 characters.
              </p>
            </div>

            {/* Photos (Optional, max 3) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Photos <span className="text-zinc-400 font-normal">(Optional, max {MAX_IMAGES})</span>
                </label>
                <span className="text-[11px] text-zinc-400">{images.length} / {MAX_IMAGES}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {images.map((imgUrl, index) => (
                  <div key={index} className="relative h-20 w-20 rounded-xl overflow-hidden border border-brand-border bg-zinc-100 shrink-0">
                    <img src={imgUrl} alt={`Listing photo ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition"
                      title="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {images.length < MAX_IMAGES && (
                  <label className="h-20 w-20 flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-border hover:border-brand-teal/60 bg-brand-bg cursor-pointer text-brand-muted hover:text-brand-charcoal transition">
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-brand-teal" />
                    ) : (
                      <>
                        <ImagePlus className="h-5 w-5 mb-1 text-zinc-400" />
                        <span className="text-[10px] font-medium">Add photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
              {isUploading && (
                <p className="text-xs text-brand-teal mt-2 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-teal" />
                  Uploading photo…
                </p>
              )}
            </div>

            {/* Security Notice on Protected Fields */}
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 text-xs text-zinc-600 space-y-1">
              <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-zinc-600" />
                Protected Security Attributes (Immutable)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-1 text-zinc-500">
                <div>
                  <span className="font-medium text-zinc-700">Listing Owner:</span> {listing.sellerId.substring(0, 10)}...
                </div>
                <div>
                  <span className="font-medium text-zinc-700">Created:</span> {new Date(listing.createdAt).toLocaleDateString()}
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-zinc-700">Expires:</span> {new Date(listing.expiresAt).toLocaleDateString()} (Fixed: cannot be extended via edit)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isUploading}>
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
