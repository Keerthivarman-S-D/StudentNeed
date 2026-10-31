import React, { useContext } from 'react';
import { Heart } from 'lucide-react';
import { AppProvider, useAppContext, AppContext } from '../context/AppContext';
import { ListingCard } from './ListingCard';
import { SampleItem } from '../pages/Launch';

interface LiveShowcaseSectionProps {
  sampleItems: SampleItem[];
  sampleWishlist: Record<string, boolean>;
  toggleSampleWishlist: (id: string, e: React.MouseEvent) => void;
}

function LiveShowcaseContent({
  sampleItems,
  sampleWishlist,
  toggleSampleWishlist,
}: LiveShowcaseSectionProps) {
  const { listings, listingsLoading } = useAppContext();

  const liveListings = listings
    .filter(
      (l) =>
        (l.status === 'active' || l.status === 'available') &&
        Boolean(l.expiresAt) &&
        new Date(l.expiresAt).getTime() > Date.now()
    )
    .slice(0, 4);

  if (listingsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-[#dedcd4] bg-[#faf9f5] h-72" />
        ))}
      </div>
    );
  }

  if (liveListings.length >= 4) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {liveListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {sampleItems.map((item) => (
        <div
          key={item.id}
          className="group flex flex-col overflow-hidden rounded-2xl border border-[#dedcd4] bg-white shadow-2xs hover:shadow-md hover:border-[#204b39]/40 transition-all"
        >
          <div className="relative aspect-4/3 overflow-hidden bg-zinc-100">
            <img
              src={item.image}
              alt={item.title}
              width={600}
              height={450}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
            <span className="absolute left-3 top-3 inline-block rounded-md bg-[#edf1ec] border border-[#dedcd4] px-2 py-0.5 text-[10px] font-bold text-[#204b39] shadow-2xs">
              {item.type}
            </span>
            <button
              type="button"
              onClick={(e) => toggleSampleWishlist(item.id, e)}
              className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-zinc-400 backdrop-blur-xs transition-colors hover:text-red-500 hover:bg-white cursor-pointer shadow-xs"
              aria-label={`Wishlist ${item.title}`}
            >
              <Heart
                className={`h-4 w-4 ${sampleWishlist[item.id] ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`}
              />
            </button>
          </div>
          <div className="flex flex-1 flex-col p-4 justify-between space-y-3">
            <div>
              <h3 className="line-clamp-2 text-sm font-bold text-[#252b27] group-hover:text-[#204b39] transition-colors leading-snug">
                {item.title}
              </h3>
              <p className="text-xs text-[#555d56] mt-1">
                {item.category} • {item.condition}
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-[#dedcd4]/60 pt-2.5">
              <span className="text-sm font-bold text-[#252b27]">{item.price}</span>
              <span className="text-xs text-[#555d56]">{item.campusInfo}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LiveShowcaseSection(props: LiveShowcaseSectionProps) {
  const existingContext = useContext(AppContext);
  if (existingContext) {
    return <LiveShowcaseContent {...props} />;
  }
  return (
    <AppProvider>
      <LiveShowcaseContent {...props} />
    </AppProvider>
  );
}
