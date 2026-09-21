import { Link } from 'react-router-dom';
import { Heart, MapPin, Clock, Timer, ImageOff } from 'lucide-react';
import { Listing } from '../types';
import { useAppContext } from '../context/AppContext';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';
import { useMemo } from 'react';

export function ListingCard({ listing }: { listing: Listing }) {
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

  return (
    <Link 
      to={`/listing/${listing.id}`} 
      className="group flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-xs transition-all hover:shadow-md hover:border-brand-teal/40 hover:shadow-brand-teal/5"
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-100 flex items-center justify-center">
        {listing.images && listing.images.length > 0 && listing.images[0] ? (
          <img 
            src={listing.images[0]} 
            alt={listing.title} 
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-zinc-50 text-zinc-400 h-full w-full select-none">
            <ImageOff className="h-8 w-8 text-zinc-300 mb-1.5" />
            <span className="text-xs font-medium text-zinc-400">No image</span>
          </div>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleSaveListing(listing.id);
          }}
          className="absolute right-3 top-3 rounded-full bg-white/80 p-2 text-zinc-600 backdrop-blur-sm transition-colors hover:text-red-500 hover:bg-white cursor-pointer"
          aria-label={isSaved ? "Remove from saved" : "Save listing"}
        >
          <Heart 
            className={cn("h-5 w-5 transition-all", isSaved && "fill-red-500 text-red-500")} 
          />
        </button>
        <div className="absolute left-3 top-3 flex gap-1.5 flex-wrap">
          <Badge variant={getTypeColor(listing.type) as any} className="shadow-sm">
            {listing.type}
          </Badge>
          {listing.status === 'cancelled' && (
            <Badge variant="destructive" className="bg-red-600 text-white shadow-sm">
              Cancelled
            </Badge>
          )}
          {expirationInfo?.isExpired && (
            <Badge variant="destructive" className="bg-red-700 text-white shadow-sm">
              Expired
            </Badge>
          )}
          {!expirationInfo?.isExpired && expirationInfo?.text && (
            <span className={cn(
              "text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs flex items-center gap-1 border",
              expirationInfo.isUrgent
                ? "bg-amber-500/90 text-white border-amber-600/30"
                : "bg-black/60 text-white border-white/20"
            )}>
              <Timer className="h-3 w-3" />
              {expirationInfo.text}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold text-brand-charcoal leading-tight group-hover:text-brand-teal-hover transition-colors">
            {listing.title}
          </h3>
          {listing.price !== undefined && (
            <p className="shrink-0 font-bold text-brand-charcoal">
              ₹{listing.price}
            </p>
          )}
        </div>
        
        {listing.type === 'Exchange' && listing.wantedItem && (
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-brand-teal-hover bg-brand-teal-light px-2 py-1 rounded-md border border-brand-teal-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal">Exchange:</span>
            <span className="truncate">{listing.wantedItem}</span>
          </div>
        )}
        
        <div className="mt-auto flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-sm text-brand-muted">
            <MapPin className="h-4 w-4 shrink-0 text-brand-muted group-hover:text-brand-teal transition-colors" />
            <span className="truncate">{listing.location}</span>
            <span className="mx-1">•</span>
            <span className="truncate text-brand-charcoal font-medium">{seller?.name || 'Student'}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100 pt-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeAgo}
            </span>
            {listing.condition && (
              <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
                {listing.condition}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
