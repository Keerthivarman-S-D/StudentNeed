import { Link } from 'react-router-dom';
import { Heart, ImageOff } from 'lucide-react';
import { Listing } from '../types';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { memo, useMemo } from 'react';
import { getOptimizedImageUrl, getResponsiveImageSrcSet } from '../lib/cloudinary';

export const ListingCard = memo(function ListingCard({ listing }: { listing: Listing }) {
  const { savedListings, toggleSaveListing } = useAppContext();

  const isSaved = savedListings.includes(listing.id);

  // Type color mapper preserved for compatibility and warning badge support
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'Sale': return 'success';
      case 'Borrow': return 'warning';
      case 'Donate': return 'default';
      case 'Exchange': return 'secondary';
      default: return 'outline';
    }
  };

  const expirationInfo = useMemo(() => {
    if (listing.status === 'expired') {
      return { text: 'Expired', isExpired: true, isUrgent: true };
    }
    if (!listing.expiresAt) return null;
    const diff = new Date(listing.expiresAt).getTime() - Date.now();
    if (diff <= 0) {
      return { text: 'Expired', isExpired: true, isUrgent: true };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days >= 1) {
      return { text: `${days}d left`, isExpired: false, isUrgent: days <= 2 };
    }
    return { text: `${Math.max(1, hours)}h left`, isExpired: false, isUrgent: true };
  }, [listing.expiresAt, listing.status]);

  // Clean, non-overlapping badge display matching visual design
  const renderTypeBadge = () => {
    if (listing.status === 'cancelled') {
      return (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          Cancelled
        </span>
      );
    }
    if (expirationInfo?.isExpired) {
      return (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          Expired
        </span>
      );
    }
    if (listing.type === 'Borrow') {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Borrow
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700">
        {listing.type === 'Sale' ? 'For Sale' : listing.type}
      </span>
    );
  };

  const priceDisplay = useMemo(() => {
    if (listing.type === 'Sale') {
      return listing.price !== undefined ? `₹${listing.price}` : '₹0';
    }
    if (listing.type === 'Donate') return 'Free';
    if (listing.type === 'Exchange') return 'Exchange';
    if (listing.type === 'Borrow') return 'Borrow';
    return 'Free';
  }, [listing.type, listing.price]);

  const meetupLocation = useMemo(() => {
    return `${listing.location || 'MIT Campus'} · Student-chosen meetup`;
  }, [listing.location]);

  const primaryImage = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  const imageSrcSet = useMemo(() => {
    return primaryImage ? getResponsiveImageSrcSet(primaryImage, [300, 480, 640]) : '';
  }, [primaryImage]);

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group flex flex-col rounded-2xl border border-[#dedcd4] bg-white p-3.5 shadow-2xs transition-all duration-200 hover:border-[#204b39]/40 hover:shadow-xs hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] h-full"
    >
      {/* Product Image Section */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#f4f3ee] flex items-center justify-center">
        {primaryImage ? (
          <img
            src={getOptimizedImageUrl(primaryImage, { width: 480, height: 320, quality: 'auto:good' })}
            srcSet={imageSrcSet || undefined}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-zinc-50 text-zinc-400 h-full w-full select-none">
            <ImageOff className="h-8 w-8 text-zinc-300 mb-1.5" />
            <span className="text-xs font-medium text-zinc-400">No image</span>
          </div>
        )}
      </div>

      {/* Item Information */}
      <div className="flex flex-1 flex-col pt-3 px-0.5">
        {/* Badge & Favorite Heart Row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          {renderTypeBadge()}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSaveListing(listing.id);
            }}
            className="rounded-full p-1 text-[#555d56] hover:text-red-500 hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] cursor-pointer"
            aria-label={isSaved ? `Remove ${listing.title} from saved` : `Save ${listing.title}`}
          >
            <Heart
              className={cn(
                "h-4.5 w-4.5 transition-colors stroke-[1.75]",
                isSaved ? "fill-red-500 text-red-500" : "text-[#555d56]"
              )}
            />
          </button>
        </div>

        {/* Title */}
        <h3 className="line-clamp-1 text-sm sm:text-base font-semibold text-[#252b27] group-hover:text-[#204b39] transition-colors mb-0.5 mt-1">
          {listing.title}
        </h3>

        {/* Condition · Category */}
        <div className="mb-2">
          {listing.condition && (
            <p className="line-clamp-1 text-xs text-[#555d56]">
              {listing.condition} · {listing.category}
            </p>
          )}
          {!listing.condition && (
            <p className="line-clamp-1 text-xs text-[#555d56]">
              {listing.category}
            </p>
          )}
        </div>

        {/* Price & Location anchored to bottom */}
        <div className="mt-auto pt-1">
          <div className="text-lg sm:text-xl font-bold text-[#252b27] tracking-tight">
            {priceDisplay}
          </div>

          {/* Meetup Info */}
          <div className="mt-1.5 text-[11px] sm:text-xs text-[#555d56] flex items-center gap-1 line-clamp-1">
            <span className="truncate">{meetupLocation}</span>
          </div>
        </div>
      </div>
    </Link>
  );
});
