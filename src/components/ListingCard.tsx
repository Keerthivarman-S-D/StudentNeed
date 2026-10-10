import { Link } from 'react-router-dom';
import { Heart, MapPin, Clock, Timer, ImageOff, ArrowLeftRight } from 'lucide-react';
import { Listing } from '../types';
import { useAppContext } from '../context/AppContext';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';
import { memo, useMemo } from 'react';
import { getOptimizedImageUrl } from '../lib/cloudinary';

export const ListingCard = memo(function ListingCard({ listing }: { listing: Listing }) {
  const { savedListings, toggleSaveListing, users } = useAppContext();
  
  const isSaved = savedListings.includes(listing.id);
  const seller = users.find(u => u.id === listing.sellerId);

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'Sale': return 'success';
      case 'Borrow': return 'warning';
      case 'Donate': return 'default';
      case 'Exchange': return 'secondary';
      default: return 'outline';
    }
  };

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(listing.createdAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, [listing.createdAt]);

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

  // Clean, non-overlapping badge display
  const renderTypeBadge = () => {
    if (listing.status === 'cancelled') {
      return (
        <Badge variant="destructive" className="bg-red-700 text-white shadow-xs font-semibold">
          Cancelled
        </Badge>
      );
    }
    if (expirationInfo?.isExpired) {
      return (
        <Badge variant="destructive" className="bg-red-800 text-white shadow-xs font-semibold">
          Expired
        </Badge>
      );
    }

    return (
      <Badge variant={getTypeColor(listing.type) as any} className="shadow-2xs font-semibold">
        {listing.type === 'Sale' ? 'For Sale' : listing.type}
      </Badge>
    );
  };

  return (
    <Link 
      to={`/listing/${listing.id}`} 
      className="group flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-xs transition-all duration-200 hover:shadow-md hover:border-emerald-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
    >
      {/* Product Image Section */}
      <div className="relative aspect-square overflow-hidden bg-zinc-100 flex items-center justify-center">
        {listing.images && listing.images.length > 0 && listing.images[0] ? (
          <img 
            src={getOptimizedImageUrl(listing.images[0], { width: 400, quality: 'auto' })} 
            alt={listing.title} 
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-zinc-50 text-zinc-400 h-full w-full select-none">
            <ImageOff className="h-8 w-8 text-zinc-300 mb-1.5" />
            <span className="text-xs font-medium text-zinc-400">No image</span>
          </div>
        )}

        {/* Top-Left: Primary Type / Status Badge */}
        <div className="absolute left-3 top-3 z-10">
          {renderTypeBadge()}
        </div>

        {/* Top-Right: Favorite Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSaveListing(listing.id);
          }}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-zinc-600 backdrop-blur-xs transition-all hover:bg-white hover:text-red-600 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal cursor-pointer shadow-xs"
          aria-label={isSaved ? `Remove ${listing.title} from saved` : `Save ${listing.title}`}
        >
          <Heart 
            className={cn("h-4.5 w-4.5 transition-colors", isSaved ? "fill-red-500 text-red-500" : "text-zinc-600")} 
          />
        </button>

        {/* Bottom-Left: Non-overlapping Expiration Indicator */}
        {!expirationInfo?.isExpired && expirationInfo?.text && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-xs flex items-center gap-1 border",
              expirationInfo.isUrgent
                ? "bg-amber-600/95 text-white border-amber-400/40"
                : "bg-black/65 text-white border-white/20"
            )}>
              <Timer className="h-3 w-3" />
              {expirationInfo.text}
            </span>
          </div>
        )}
      </div>
      
      {/* Item Information */}
      <div className="flex flex-1 flex-col p-4">
        {/* Title & Price / Type Tag Row */}
        <div className="mb-2 flex items-start justify-between gap-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold text-brand-charcoal leading-snug group-hover:text-emerald-800 transition-colors">
            {listing.title}
          </h3>
          
          <div className="shrink-0 text-right">
            {listing.type === 'Sale' && listing.price !== undefined ? (
              <span className="font-bold text-base text-brand-charcoal">
                ₹{listing.price}
              </span>
            ) : listing.type === 'Donate' ? (
              <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                Free
              </span>
            ) : listing.type === 'Exchange' ? (
              <span className="inline-block rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
                Swap
              </span>
            ) : listing.type === 'Borrow' ? (
              <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                Borrow
              </span>
            ) : null}
          </div>
        </div>
        
        {/* Exchange Wanted Item Row */}
        {listing.type === 'Exchange' && listing.wantedItem && (
          <div className="mb-2.5 flex items-center gap-1.5 text-xs text-purple-900 bg-purple-50/80 px-2.5 py-1 rounded-lg border border-purple-200">
            <ArrowLeftRight className="h-3.5 w-3.5 text-purple-700 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 shrink-0">Wants:</span>
            <span className="truncate font-medium">{listing.wantedItem}</span>
          </div>
        )}
        
        {/* Metadata Footer */}
        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          {/* Location and Student Info */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span className="truncate font-medium text-zinc-700">{listing.location}</span>
            <span className="text-zinc-400">•</span>
            <span className="truncate text-brand-charcoal font-semibold">{seller?.name || 'Student'}</span>
          </div>
          
          {/* Timestamp and Condition */}
          <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100 pt-2.5">
            <span className="flex items-center gap-1 text-[11px] text-zinc-600">
              <Clock className="h-3 w-3 text-zinc-500" />
              {timeAgo}
            </span>
            {listing.condition && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 border border-zinc-200/60">
                {listing.condition}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});
