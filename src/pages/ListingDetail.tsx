import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Clock, 
  Heart, 
  MessageSquare, 
  ChevronLeft, 
  AlertCircle, 
  Loader2,
  BookmarkCheck,
  Check,
  X,
  Inbox
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { Listing, User, Reservation } from '../types';

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { listings, listingsLoading, users, savedListings, toggleSaveListing } = useAppContext();
  const { currentUser } = useAuth();
  const currentUserId = auth.currentUser?.uid || currentUser?.id;
  
  const [fetchedListing, setFetchedListing] = useState<Listing | null>(null);
  const [fetchedSeller, setFetchedSeller] = useState<User | null>(null);
  const [isFetchingDirect, setIsFetchingDirect] = useState(false);
  const [isFetchingSeller, setIsFetchingSeller] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Reservation states
  const [userReservation, setUserReservation] = useState<Reservation | null>(null);
  const [incomingReservations, setIncomingReservations] = useState<Reservation[]>([]);

  // 1. Resolve listing from context or fetch directly if accessed via deep link
  const listingFromContext = listings.find(l => l.id === id);
  const listing = listingFromContext || fetchedListing;

  useEffect(() => {
    if (!listingFromContext && id && !listingsLoading) {
      let isMounted = true;
      setIsFetchingDirect(true);

      const fetchSingleListing = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'listings', id));
          if (docSnap.exists() && isMounted) {
            const data = docSnap.data();
            const createdAt = data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : typeof data.createdAt === 'string'
              ? data.createdAt
              : new Date().toISOString();
            const updatedAt = data.updatedAt?.toDate
              ? data.updatedAt.toDate().toISOString()
              : typeof data.updatedAt === 'string'
              ? data.updatedAt
              : new Date().toISOString();

            setFetchedListing({
              id: docSnap.id,
              sellerId: data.sellerId,
              title: data.title,
              description: data.description,
              category: data.category,
              type: data.type,
              condition: data.condition,
              price: data.price,
              location: data.location,
              images: data.images || [],
              status: data.status,
              createdAt,
              updatedAt,
            });

            // Fetch seller user doc directly if needed
            if (data.sellerId) {
              setIsFetchingSeller(true);
              const userSnap = await getDoc(doc(db, 'users', data.sellerId));
              if (userSnap.exists() && isMounted) {
                setFetchedSeller({ id: userSnap.id, ...userSnap.data() } as User);
              }
              if (isMounted) setIsFetchingSeller(false);
            }
          }
        } catch (err) {
          console.error('Failed to fetch listing directly from Firestore:', err);
        } finally {
          if (isMounted) setIsFetchingDirect(false);
        }
      };

      fetchSingleListing();
      return () => {
        isMounted = false;
      };
    }
  }, [id, listingFromContext, listingsLoading]);

  // 2. Resolve seller details without synthetic flash
  const sellerFromContext = listing ? users.find(u => u.id === listing.sellerId) : null;

  useEffect(() => {
    if (!listing?.sellerId) return;
    if (sellerFromContext || fetchedSeller || isFetchingSeller) return;

    let isMounted = true;
    setIsFetchingSeller(true);

    const fetchSellerDirect = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', listing.sellerId));
        if (userSnap.exists() && isMounted) {
          setFetchedSeller({ id: userSnap.id, ...userSnap.data() } as User);
        }
      } catch (err) {
        console.warn('Could not fetch seller details directly:', err);
      } finally {
        if (isMounted) setIsFetchingSeller(false);
      }
    };

    fetchSellerDirect();
    return () => {
      isMounted = false;
    };
  }, [listing?.sellerId, sellerFromContext, fetchedSeller, isFetchingSeller]);

  const seller: User | null = sellerFromContext || fetchedSeller || (!isFetchingDirect && !isFetchingSeller && listing ? {
    id: listing.sellerId,
    name: 'Campus Student',
    email: '',
    department: 'General',
    campus: 'Main Campus',
    rating: 5.0,
    avatarUrl: undefined,
    exchangesCompleted: 0,
    role: 'student',
    isVerified: true,
    createdAt: new Date().toISOString(),
  } : null);

  const isOwner = Boolean(currentUserId && seller?.id && currentUserId === seller.id);
  const isSaved = listing ? savedListings.includes(listing.id) : false;

  // 3. Listen to prospective buyer's own reservation for this listing
  useEffect(() => {
    if (!listing?.id || !currentUserId || isOwner) {
      setUserReservation(null);
      return;
    }

    const q = query(
      collection(db, 'reservations'),
      where('buyerId', '==', currentUserId),
      where('listingId', '==', listing.id),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setUserReservation(null);
          return;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        setUserReservation({
          id: docSnap.id,
          listingId: data.listingId,
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          chatId: data.chatId,
          status: data.status,
          meetup: data.meetup || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      },
      (err) => {
        console.warn('User reservation listener error:', err);
      }
    );

    return () => unsub();
  }, [listing?.id, currentUserId, isOwner]);

  // 4. If owner, listen to incoming reservations for this listing
  useEffect(() => {
    if (!listing?.id || !currentUserId || !isOwner) {
      setIncomingReservations([]);
      return;
    }

    const q = query(
      collection(db, 'reservations'),
      where('sellerId', '==', currentUserId),
      where('listingId', '==', listing.id)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Reservation[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            listingId: data.listingId,
            buyerId: data.buyerId,
            sellerId: data.sellerId,
            chatId: data.chatId,
            status: data.status,
            meetup: data.meetup || undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        setIncomingReservations(list);
      },
      (err) => {
        console.warn('Incoming reservations query error:', err);
      }
    );

    return () => unsub();
  }, [listing?.id, currentUserId, isOwner]);

  if (listingsLoading || isFetchingDirect || isFetchingSeller) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600 mb-4" />
        <p className="text-zinc-500 font-medium">Loading item and seller details...</p>
      </div>
    );
  }

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

  // Helper to ensure deterministic chat exists
  const getOrCreateChatId = async () => {
    if (!currentUserId) {
      navigate('/login', { state: { from: `/listing/${id}` } });
      return null;
    }

    const sellerId = listing.sellerId;
    if (!sellerId) {
      setChatError('Seller details are unavailable for this listing.');
      return null;
    }

    if (currentUserId === sellerId) {
      setChatError('You cannot contact yourself regarding your own listing.');
      return null;
    }

    const chatId = [currentUserId, sellerId].sort().join('_');
    const chatDocRef = doc(db, 'chats', chatId);

    try {
      const chatDocSnap = await getDoc(chatDocRef);
      if (!chatDocSnap.exists()) {
        await setDoc(chatDocRef, {
          participants: [currentUserId, sellerId],
          listingId: listing.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // If document does not exist yet, rules evaluation on null resource may throw.
      // Proceed to initialize new chat document via the authorized create rule:
      try {
        await setDoc(chatDocRef, {
          participants: [currentUserId, sellerId],
          listingId: listing.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (createErr) {
        console.error('Failed to initialize chat document:', createErr);
        throw createErr;
      }
    }

    return chatId;
  };

  // 5. Contact Student Handler
  const handleContactStudent = async () => {
    setChatError(null);
    setIsStartingChat(true);

    try {
      const chatId = await getOrCreateChatId();
      if (chatId) {
        navigate(`/chat/${chatId}`);
      }
    } catch (err: unknown) {
      console.error('Failed to initialize chat document:', err);
      setChatError('Could not start chat. Please try again.');
    } finally {
      setIsStartingChat(false);
    }
  };

  // 6. Direct Reservation Request Handler
  const handleReserveItem = async () => {
    setChatError(null);

    if (!currentUserId) {
      navigate('/login', { state: { from: `/listing/${id}` } });
      return;
    }

    if (currentUserId === listing.sellerId) {
      setChatError('You cannot reserve your own listing.');
      return;
    }

    // Check for duplicate active reservation
    if (userReservation && (userReservation.status === 'pending' || userReservation.status === 'accepted')) {
      const chatId = userReservation.chatId || [currentUserId, listing.sellerId].sort().join('_');
      navigate(`/chat/${chatId}`);
      return;
    }

    setIsReserving(true);

    try {
      const chatId = await getOrCreateChatId();
      if (!chatId) return;

      const resId = `res_${listing.id}_${currentUserId}`;
      const resRef = doc(db, 'reservations', resId);

      // Verify server document using a secure query to prevent permission errors on non-existent documents
      const qExisting = query(
        collection(db, 'reservations'),
        where('buyerId', '==', currentUserId),
        where('listingId', '==', listing.id),
        limit(1)
      );
      const existingSnap = await getDocs(qExisting);

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();
        const existingStatus = existingData?.status;
        if (existingStatus === 'pending' || existingStatus === 'accepted') {
          setChatError(`You already have an active reservation request (${existingStatus}).`);
          navigate(`/chat/${chatId}`);
          return;
        }

        if (existingStatus === 'rejected') {
          // Re-request reservation for original buyer: transition rejected -> pending
          await updateDoc(doc(db, 'reservations', existingDoc.id), {
            status: 'pending',
            updatedAt: serverTimestamp(),
          });

          await updateDoc(doc(db, 'chats', chatId), {
            reservationId: existingDoc.id,
            updatedAt: serverTimestamp(),
          });

          navigate(`/chat/${chatId}`);
          return;
        }
      }

      // Create reservation with required fields and status 'pending'
      await setDoc(resRef, {
        listingId: listing.id,
        buyerId: currentUserId,
        sellerId: listing.sellerId,
        chatId: chatId,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update chat document with reservationId
      await updateDoc(doc(db, 'chats', chatId), {
        reservationId: resId,
        updatedAt: serverTimestamp(),
      });

      // Navigate to chat
      navigate(`/chat/${chatId}`);
    } catch (err: any) {
      console.error('Failed to reserve item:', err);
      setChatError(err?.message || 'Failed to submit reservation request. Please try again.');
    } finally {
      setIsReserving(false);
    }
  };

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

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-zinc-900 mb-3">Description</h3>
            <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>

          <div className="mb-6 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-3">
              {seller.avatarUrl ? (
                <img 
                  src={seller.avatarUrl} 
                  alt={seller.name} 
                  className="h-12 w-12 rounded-full object-cover border border-zinc-200 bg-white"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white font-bold text-lg">
                  {seller.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-zinc-900">{seller.name}</p>
                <p className="text-sm text-zinc-500">{seller.department} • {seller.rating} ★</p>
              </div>
            </div>
          </div>

          {/* Prospective Buyer's Existing Reservation Banner */}
          {!isOwner && userReservation && (
            <div className="mb-6 rounded-2xl border p-4 transition-all">
              {userReservation.status === 'pending' && (
                <div className="flex flex-col gap-2 rounded-xl bg-amber-50/80 p-3.5 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                      Reservation Status
                    </span>
                    <Badge variant="warning" className="gap-1 font-medium text-xs">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Your request to reserve this item is currently pending seller confirmation. You can coordinate details directly in the chat thread.
                  </p>
                </div>
              )}

              {userReservation.status === 'accepted' && (
                <div className="flex flex-col gap-2.5 rounded-xl bg-emerald-50/80 p-3.5 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Reservation Status
                    </span>
                    <Badge variant="success" className="gap-1 font-medium text-xs">
                      <Check className="h-3 w-3" />
                      Accepted
                    </Badge>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    The seller has accepted your reservation! Please coordinate campus pickup details in chat.
                  </p>
                  
                  {/* Meetup status info if available */}
                  {userReservation.meetup?.status === 'confirmed' && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-100/90 px-3 py-2 text-xs font-semibold text-emerald-900 border border-emerald-300/60">
                      <MapPin className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span>Meetup Confirmed: <strong>{userReservation.meetup.location}</strong></span>
                    </div>
                  )}

                  {userReservation.meetup?.status === 'proposed' && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-100/90 px-3 py-2 text-xs font-medium text-amber-900 border border-amber-300/60">
                      <Clock className="h-4 w-4 text-amber-700 shrink-0" />
                      <span>Meetup Proposed at <strong>{userReservation.meetup.location}</strong> (Awaiting confirmation)</span>
                    </div>
                  )}

                  {(!userReservation.meetup || userReservation.meetup.status === 'not_set' || userReservation.meetup.status === 'cancelled') && (
                    <div className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-xs text-zinc-600 border border-emerald-100">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span>Meetup: Not yet arranged (Select location in chat)</span>
                    </div>
                  )}
                </div>
              )}

              {userReservation.status === 'rejected' && (
                <div className="flex flex-col gap-2 rounded-xl bg-zinc-100 p-3.5 border border-zinc-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      Reservation Status
                    </span>
                    <Badge variant="secondary" className="gap-1 font-medium text-xs">
                      <X className="h-3 w-3" />
                      Declined
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-700 leading-relaxed">
                    The seller was unable to accept your previous reservation request. You may contact them via chat or submit a new request if terms change.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Seller / Owner Incoming Requests Banner */}
          {isOwner && incomingReservations.length > 0 && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-blue-700" />
                  <h4 className="text-sm font-semibold text-blue-900">
                    Incoming Reservation Requests ({incomingReservations.length})
                  </h4>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {incomingReservations.map((res) => (
                  <div 
                    key={res.id} 
                    className="flex items-center justify-between rounded-xl bg-white p-3 border border-blue-100 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {res.status === 'pending' && <Badge variant="warning">Pending Request</Badge>}
                      {res.status === 'accepted' && <Badge variant="success">Accepted</Badge>}
                      {res.status === 'rejected' && <Badge variant="secondary">Declined</Badge>}
                      {res.status === 'accepted' && res.meetup?.status === 'confirmed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                          <MapPin className="h-3 w-3" />
                          {res.meetup.location}
                        </span>
                      )}
                      {res.status === 'accepted' && res.meetup?.status === 'proposed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                          <Clock className="h-3 w-3" />
                          Proposed: {res.meetup.location}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      onClick={() => navigate(`/chat/${res.chatId}`)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Open Chat to Review
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chatError && (
            <div className="mb-4 flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{chatError}</span>
              </div>
              <button 
                type="button"
                onClick={() => setChatError(null)} 
                className="text-xs font-semibold underline hover:text-red-800 ml-2 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-auto flex flex-col sm:flex-row gap-3">
            {!isOwner ? (
              <>
                {/* Primary Reservation / Chat Action */}
                {userReservation && (userReservation.status === 'pending' || userReservation.status === 'accepted') ? (
                  <Button 
                    size="lg" 
                    className="flex-1 text-base gap-2 bg-zinc-900 text-white"
                    disabled={isStartingChat}
                    onClick={handleContactStudent}
                  >
                    {isStartingChat ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <MessageSquare className="h-5 w-5" />
                    )}
                    {isStartingChat ? 'Opening Chat...' : 'View Request in Chat'}
                  </Button>
                ) : (
                  <>
                    <Button 
                      size="lg" 
                      className="flex-1 text-base gap-2 bg-zinc-900 text-white hover:bg-zinc-800"
                      disabled={isReserving || isStartingChat}
                      onClick={handleReserveItem}
                    >
                      {isReserving ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <BookmarkCheck className="h-5 w-5" />
                      )}
                      {isReserving ? 'Reserving...' : 'Reserve Item'}
                    </Button>

                    <Button 
                      size="lg" 
                      variant="outline"
                      className="text-base gap-2"
                      disabled={isStartingChat || isReserving}
                      onClick={handleContactStudent}
                    >
                      {isStartingChat ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-5 w-5" />
                      )}
                      {isStartingChat ? 'Connecting...' : 'Chat'}
                    </Button>
                  </>
                )}

                <Button 
                  size="icon" 
                  variant="outline" 
                  className={cn("h-11 w-11 shrink-0 transition-colors self-end sm:self-auto", isSaved && "border-red-500 bg-red-50")}
                  onClick={() => toggleSaveListing(listing.id)}
                  title={isSaved ? "Saved" : "Save Listing"}
                >
                  <Heart className={cn("h-5 w-5", isSaved && "fill-red-500 text-red-500")} />
                </Button>
              </>
            ) : (
              <Button size="lg" variant="outline" className="flex-1 text-base" onClick={() => navigate('/profile')}>
                Manage My Listing
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
