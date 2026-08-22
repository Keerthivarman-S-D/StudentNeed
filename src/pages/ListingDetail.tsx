import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Clock, Heart, MessageSquare, ChevronLeft, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { listings, users, savedListings, toggleSaveListing } = useAppContext();
  const { currentUser } = useAuth();
  
  const [showContactModal, setShowContactModal] = useState(false);

  const listing = listings.find(l => l.id === id);
  const seller = users.find(u => u.id === listing?.sellerId);
  const isSaved = listing ? savedListings.includes(listing.id) : false;

  if (!listing || !seller) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-300 mb-4" />
        <h2 className="text-xl font-bold text-zinc-900">Listing not found</h2>
        <p className="text-zinc-500 mt-2 mb-6">This item may have been removed or is no longer available.</p>
        <Button onClick={() => navigate('/marketplace')}>Back to Marketplace</Button>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'Sale': return 'success';
      case 'Borrow': return 'warning';
      case 'Donate': return 'default';
      case 'Exchange': return 'secondary';
      default: return 'outline';
    }
  };

  const isOwner = currentUser?.id === seller.id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button 
        onClick={() => navigate(-1)}
        className="group flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back
      </button>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
        {/* Image Gallery */}
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-zinc-100 border border-zinc-200">
          <img 
            src={listing.images[0]} 
            alt={listing.title} 
            className="h-full w-full object-cover"
          />
          <div className="absolute left-4 top-4">
            <Badge variant={getTypeColor(listing.type) as any} className="text-sm px-3 py-1 shadow-md">
              {listing.type}
            </Badge>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <div className="mb-6 border-b border-zinc-100 pb-6">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">{listing.title}</h1>
            {listing.price !== undefined && (
              <p className="text-3xl font-extrabold text-zinc-900 mb-4">₹{listing.price}</p>
            )}
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {listing.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {new Date(listing.createdAt).toLocaleDateString()}
              </span>
              <Badge variant="outline" className="bg-zinc-50 font-medium">
                {listing.condition}
              </Badge>
              <Badge variant="outline" className="bg-zinc-50 font-medium">
                {listing.category}
              </Badge>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-3">Description</h3>
            <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>

          <div className="mb-8 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-3">
              <img 
                src={seller.avatarUrl} 
                alt={seller.name} 
                className="h-12 w-12 rounded-full object-cover border border-zinc-200 bg-white"
              />
              <div>
                <p className="font-semibold text-zinc-900">{seller.name}</p>
                <p className="text-sm text-zinc-500">{seller.department} • {seller.rating} ★</p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex gap-4">
            {!isOwner ? (
              <>
                <Button 
                  size="lg" 
                  className="flex-1 text-base gap-2"
                  onClick={() => setShowContactModal(true)}
                >
                  <MessageSquare className="h-5 w-5" />
                  Contact Student
                </Button>
                <Button 
                  size="icon" 
                  variant="outline" 
                  className={cn("h-11 w-11 shrink-0 transition-colors", isSaved && "border-red-500 bg-red-50")}
                  onClick={() => toggleSaveListing(listing.id)}
                >
                  <Heart className={cn("h-5 w-5", isSaved && "fill-red-500 text-red-500")} />
                </Button>
              </>
            ) : (
              <Button size="lg" variant="outline" className="flex-1 text-base">
                Edit Listing
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mock Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Request Sent!</h3>
            <p className="text-zinc-600 mb-6">
              We've notified <strong>{seller.name}</strong> that you're interested in this item. 
              They will review your request and get back to you shortly.
            </p>
            <Button 
              className="w-full" 
              onClick={() => setShowContactModal(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
