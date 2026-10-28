import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Heart, ExternalLink, ArrowRight, Package } from 'lucide-react';
import { GenUIListingCardsComponent, GenUIListingCardItem } from '../../types/genui';
import { useAppContext } from '../../context/AppContext';

interface GenUIListingCardsProps {
  spec: GenUIListingCardsComponent;
  onSelectListing?: (listingId: string) => void;
}

export function GenUIListingCards({ spec, onSelectListing }: GenUIListingCardsProps) {
  const { savedListings, toggleSaveListing } = useAppContext();
  const navigate = useNavigate();

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    // If clicked target was not a button, navigate
    if ((e.target as HTMLElement).closest('button')) return;
    if (onSelectListing) {
      onSelectListing(id);
    } else {
      navigate(`/listing/${id}`);
    }
  };

  if (!spec.items || spec.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#dedcd4] bg-[#faf9f5] p-5 text-center">
        <Package className="h-8 w-8 text-[#717870] mx-auto mb-2 opacity-60" />
        <p className="text-xs font-semibold text-[#252b27]">{spec.title || 'No Items Found'}</p>
        <p className="text-[11px] text-[#555d56] mt-1 mb-3">
          {spec.emptyFallbackText || 'No listings currently match your query.'}
        </p>
        {spec.ctaAction && (
          <Link
            to={spec.ctaAction.url}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#204b39] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#183a2c] transition"
          >
            {spec.ctaAction.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Header bar */}
      {spec.title && (
        <div className="flex items-center justify-between text-xs font-bold text-[#252b27]">
          <span>{spec.title}</span>
          <span className="rounded-full bg-[#edf1ec] px-2 py-0.5 text-[10px] font-semibold text-[#204b39]">
            {spec.items.length} item{spec.items.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Cards Collection Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {spec.items.map((item: GenUIListingCardItem) => {
          const isSaved = savedListings.includes(item.id) || item.isSaved;

          // Type styling
          let typeBadgeBg = "bg-emerald-100 text-emerald-800";
          if (item.type === 'Donate') typeBadgeBg = "bg-blue-100 text-blue-800";
          if (item.type === 'Borrow') typeBadgeBg = "bg-purple-100 text-purple-800";
          if (item.type === 'Exchange') typeBadgeBg = "bg-amber-100 text-amber-800";

          const imageUrl = item.images && item.images.length > 0 ? item.images[0] : null;

          return (
            <div
              key={item.id}
              onClick={(e) => handleCardClick(item.id, e)}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-[#dedcd4] bg-white transition hover:shadow-md hover:border-[#204b39]/40 cursor-pointer"
            >
              {/* Photo Area with 16:10 Aspect Ratio */}
              <div className="relative aspect-16/10 w-full overflow-hidden bg-[#edf1ec]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#edf1ec] text-[#717870]">
                    <span className="text-[11px] font-medium">{item.category}</span>
                  </div>
                )}

                {/* Listing Type Badge */}
                <span className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold shadow-xs ${typeBadgeBg}`}>
                  {item.type}
                </span>

                {/* Save Heart Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSaveListing(item.id);
                  }}
                  aria-label={isSaved ? "Remove from saved items" : "Save item"}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#252b27] shadow-sm backdrop-blur-xs transition hover:scale-110 active:scale-95"
                >
                  <Heart
                    className={`h-4 w-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-[#555d56]'}`}
                  />
                </button>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h5 className="text-xs font-bold text-[#252b27] line-clamp-1 group-hover:text-[#204b39] transition">
                    {item.title}
                  </h5>
                </div>

                {/* Price & Condition */}
                <div className="flex items-baseline justify-between mt-0.5 mb-2">
                  <div className="text-sm font-black text-[#204b39]">
                    {item.type === 'Donate' ? (
                      <span className="text-emerald-700 font-bold">Free</span>
                    ) : item.type === 'Exchange' ? (
                      <span className="text-amber-700 text-xs font-bold">Item Swap</span>
                    ) : (
                      `₹${item.price ?? 0}`
                    )}
                  </div>
                  {item.condition && (
                    <span className="text-[10px] text-[#717870] font-medium">
                      {item.condition}
                    </span>
                  )}
                </div>

                {/* Location & Seller Footer */}
                <div className="mt-auto pt-2 border-t border-[#dedcd4]/60 flex items-center justify-between text-[10px] text-[#555d56]">
                  <span className="flex items-center gap-1 truncate max-w-[140px]">
                    <MapPin className="h-3 w-3 text-[#204b39] shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </span>

                  <Link
                    to={`/listing/${item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 font-bold text-[#204b39] hover:underline"
                  >
                    <span>View</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All In Marketplace CTA */}
      {spec.ctaAction && (
        <div className="pt-1 text-right">
          <Link
            to={spec.ctaAction.url}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#204b39] hover:underline"
          >
            <span>{spec.ctaAction.label}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
