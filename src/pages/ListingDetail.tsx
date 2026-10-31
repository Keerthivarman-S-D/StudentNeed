import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Heart,
  MessageSquare,
  AlertCircle,
  Loader2,
  BookmarkCheck,
  Check,
  Edit3,
  ImageOff
} from 'lucide-react';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
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
import { EditListingModal } from '../components/EditListingModal';
import { broadcastSyncEvent } from '../lib/crossTabSync';
import { ReportListingModal } from '../components/ReportListingModal';
import { cn } from '../lib/utils';
import { Listing, User, Reservation } from '../types';
import { getOptimizedImageUrl, getOptimizedAvatarUrl, getResponsiveImageSrcSet } from '../lib/cloudinary';
import { RESERVATION_ENDPOINTS } from '../config/api';
import { formatErrorMessage } from '../lib/errorHandler';


export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { listings, listingsLoading, users, savedListings, toggleSaveListing, cancelListing } = useAppContext();
  const { currentUser } = useAuth();
  const currentUserId = auth.currentUser?.uid || currentUser?.id;

  const [fetchedListing, setFetchedListing] = useState<Listing | null>(null);
  const [fetchedSeller, setFetchedSeller] = useState<User | null>(null);
  const [isFetchingDirect, setIsFetchingDirect] = useState(false);
  const [isFetchingSeller, setIsFetchingSeller] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Edit Listing state
  const [showEditModal, setShowEditModal] = useState(false);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  // Report Listing state
  const [showReportModal, setShowReportModal] = useState(false);

  const handleConfirmCancelPost = async () => {
    if (!listing?.id) return;
    if (listing.status === 'completed') {
      setChatError('This listing has already been completed and cannot be cancelled.');
      setShowCancelModal(false);
      return;
    }
    setChatError(null);
    setIsCancelling(true);
    try {
      await cancelListing(listing.id);
      if (fetchedListing) {
        setFetchedListing(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
      setShowCancelModal(false);
      setCancelSuccessMsg('This listing has been cancelled.');
      setTimeout(() => {
        setCancelSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      console.error('Failed to cancel listing:', err);
      setChatError(formatErrorMessage(err, 'Failed to cancel listing. Please try again.'));
      setShowCancelModal(false);
    } finally {
      setIsCancelling(false);
    }
  };

  // Reservation states
  const [userReservation, setUserReservation] = useState<Reservation | null>(null);

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
            const expiresAt = data.expiresAt?.toDate
              ? data.expiresAt.toDate().toISOString()
              : typeof data.expiresAt === 'string'
              ? data.expiresAt
              : undefined;

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
              expiresAt,
              expirationDays: typeof data.expirationDays === 'number' ? data.expirationDays : undefined,
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

  // 2. Resolve seller details
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
    campus: 'MIT Campus',
    rating: 5.0,
    avatarUrl: undefined,
    exchangesCompleted: 0,
    role: 'student',
    isVerified: true,
    createdAt: new Date().toISOString(),
  } : null);

  const isOwner = Boolean(currentUserId && listing?.sellerId && currentUserId === listing.sellerId);
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

  // Helper to ensure deterministic chat exists
  const getOrCreateChatId = async () => {
    if (!currentUserId) {
      navigate('/login', { state: { from: `/listing/${id}` } });
      return null;
    }

    const sellerId = listing?.sellerId;
    if (!sellerId) {
      setChatError('Seller details are unavailable for this listing.');
      return null;
    }

    if (currentUserId === sellerId) {
      setChatError('You cannot contact yourself regarding your own listing.');
      return null;
    }

    const chatId = `listing_${listing.id}_${[currentUserId, sellerId].sort().join('_')}`;
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

  // Contact Student Handler
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

  // Direct Reservation Request Handler
  const handleReserveItem = async () => {
    setChatError(null);

    if (!currentUserId) {
      navigate('/login', { state: { from: `/listing/${id}` } });
      return;
    }

    if (!listing) return;

    if (currentUserId === listing.sellerId) {
      setChatError('You cannot reserve your own listing.');
      return;
    }

    if (listing.status === 'cancelled' || listing.status === 'completed') {
      setChatError(`Cannot reserve this item: listing is ${listing.status}.`);
      return;
    }

    // Check for duplicate active reservation or in-flight operation
    if (isReserving) return;

    if (userReservation && (userReservation.status === 'pending' || userReservation.status === 'accepted')) {
      const chatId = userReservation.chatId || `listing_${listing.id}_${[currentUserId, listing.sellerId].sort().join('_')}`;
      navigate(`/chat/${chatId}`);
      return;
    }

    setIsReserving(true);

    try {
      const chatId = await getOrCreateChatId();
      if (!chatId) return;

      const resId = `res_${listing.id}_${currentUserId}`;
      const resRef = doc(db, 'reservations', resId);
      const chatDocRef = doc(db, 'chats', chatId);

      // Execute atomic transaction to prevent race conditions and duplicate reservation documents
      await runTransaction(db, async (transaction) => {
        const resSnap = await transaction.get(resRef);

        if (resSnap.exists()) {
          const resData = resSnap.data();
          const existingStatus = resData?.status;

          if (existingStatus === 'pending' || existingStatus === 'accepted') {
            throw new Error(`ALREADY_ACTIVE:${existingStatus}`);
          }

          if (existingStatus === 'rejected' || existingStatus === 'cancelled') {
            transaction.update(resRef, {
              status: 'pending',
              updatedAt: serverTimestamp(),
            });
            transaction.update(chatDocRef, {
              reservationId: resId,
              updatedAt: serverTimestamp(),
            });
            return;
          }
        }

        // New pending reservation document
        transaction.set(resRef, {
          listingId: listing.id,
          buyerId: currentUserId,
          sellerId: listing.sellerId,
          chatId: chatId,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(chatDocRef, {
          reservationId: resId,
          updatedAt: serverTimestamp(),
        });
      });

      // Notify other open tabs of the new reservation
      broadcastSyncEvent({ type: 'RESERVATION_CREATED', listingId: listing.id });

      // Dispatch server-side verified notification to seller
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          fetch(RESERVATION_ENDPOINTS.notifyCreated, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ reservationId: resId }),
          }).catch((notifyErr) => console.warn('Reservation creation notification notice:', notifyErr));
        }
      } catch {}

      navigate(`/chat/${chatId}`);
    } catch (err: any) {
      if (err instanceof Error && err.message.startsWith('ALREADY_ACTIVE:')) {
        const activeStatus = err.message.split(':')[1];
        setChatError(`You already have an active reservation request (${activeStatus}).`);
        const chatId = await getOrCreateChatId();
        if (chatId) navigate(`/chat/${chatId}`);
        return;
      }
      console.error('Failed to reserve item:', err);
      setChatError(formatErrorMessage(err, 'Failed to submit reservation request. Please try again.'));
    } finally {
      setIsReserving(false);
    }
  };

  // Main type color mapper preserved for test assertions and compatibility
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'Sale': return 'success';
      case 'Borrow': return 'warning';
      case 'Donate': return 'default';
      case 'Exchange': return 'secondary';
      default: return 'outline';
    }
  };

  const isExpired = listing ? (listing.status === 'expired' || (Boolean(listing.expiresAt) && new Date(listing.expiresAt!).getTime() <= Date.now())) : false;

  if (listingsLoading || isFetchingDirect || isFetchingSeller) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center min-h-[60vh] bg-[#f7f6f2]">
        <div className="h-10 w-10 rounded-full border-3 border-[#204b39] border-t-transparent animate-spin mb-4" />
        <p className="text-[#555d56] font-medium text-sm">Loading listing and student details...</p>
      </div>
    );
  }

  if (!listing || !seller) {
    return (
      <div className="min-h-[70vh] bg-[#f7f6f2] flex items-center justify-center">
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#252b27]">Listing not found</h2>
          <p className="text-[#555d56] mt-2 mb-6 text-sm">
            This item may have been completed, expired, or removed by campus moderation.
          </p>
          <Button
            onClick={() => navigate('/marketplace')}
            className="bg-[#204b39] text-white hover:bg-[#183a2c] font-semibold px-6 rounded-xl"
          >
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#252b27]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Title and Breadcrumbs */}
        <div className="mb-6 space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
            {listing.title}
          </h1>
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-[#555d56]" aria-label="Breadcrumb">
            <Link to="/marketplace" className="hover:text-[#252b27] transition-colors">
              Marketplace
            </Link>
            <span>/</span>
            <Link
              to={`/marketplace?category=${encodeURIComponent(listing.category)}`}
              className="hover:text-[#252b27] transition-colors"
            >
              {listing.category}
            </Link>
            <span>/</span>
            <span className="truncate max-w-[200px] sm:max-w-xs text-[#252b27] font-medium">
              {listing.title}
            </span>
          </nav>
        </div>

        {/* Status Banners */}
        {listing.status === 'cancelled' && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white p-4 text-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-red-900">Listing Cancelled</h4>
                <p className="text-xs text-red-700 mt-0.5">
                  This post has been cancelled by the student and is no longer available on the campus marketplace.
                </p>
              </div>
            </div>
          </div>
        )}

        {cancelSuccessMsg && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-50 p-3.5 text-sm font-medium text-green-800 border border-green-200">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <span>{cancelSuccessMsg}</span>
          </div>
        )}

        {chatError && (
          <div className="mb-6 flex items-center justify-between rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{chatError}</span>
            </div>
            <button
              type="button"
              onClick={() => setChatError(null)}
              className="text-xs font-semibold underline hover:text-red-800 ml-2 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content: Left Gallery/About + Right Action/Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Image Gallery & About this item */}
          <div className="lg:col-span-7 flex flex-col">

            {/* Primary Main Photo Container */}
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#f4f3ee] border border-[#dedcd4] flex items-center justify-center shadow-none">
              {listing.images && listing.images.length > 0 && (listing.images[selectedImageIndex] || listing.images[0]) ? (
                <img
                  src={getOptimizedImageUrl(listing.images[selectedImageIndex] || listing.images[0], { width: 900, quality: 'auto:good' })}
                  srcSet={getResponsiveImageSrcSet(listing.images[selectedImageIndex] || listing.images[0], [480, 720, 1080]) || undefined}
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  alt={listing.title}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-50 text-brand-muted h-full w-full select-none">
                  <ImageOff className="h-12 w-12 text-zinc-300 mb-2" />
                  <span className="text-sm font-medium text-zinc-400">No image</span>
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {listing.images && listing.images.length > 1 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3.5">
                {listing.images.slice(0, 4).map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={cn(
                      "relative aspect-[16/10] overflow-hidden rounded-xl border-2 transition-all cursor-pointer bg-[#f4f3ee]",
                      selectedImageIndex === idx
                        ? "border-[#252b27] ring-1 ring-[#252b27]"
                        : "border-[#dedcd4] hover:border-zinc-400 opacity-80 hover:opacity-100"
                    )}
                    aria-label={`View photo ${idx + 1}`}
                  >
                    <img
                      src={getOptimizedImageUrl(imgUrl, { width: 240, quality: 'auto' })}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* "About this item" Card */}
            <div className="mt-6 rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-none">
              <h2 className="text-base sm:text-lg font-bold text-[#252b27] mb-3">
                About this item
              </h2>
              <p className="text-sm leading-relaxed text-[#252b27] whitespace-pre-wrap">
                {listing.description}
              </p>
              <p className="text-xs text-[#555d56] mt-5 pt-4 border-t border-[#f4f3ee]">
                Please check the item and its functions when you meet.
              </p>
            </div>
          </div>

          {/* Right Column: Price/CTA Card, Listed By, Meet on Campus */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Primary Action Card */}
            <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-none">

              {/* Type & Category Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-0.5 text-xs font-medium text-zinc-700">
                  {listing.type === 'Sale' ? 'For Sale' : listing.type}
                </span>
                <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-0.5 text-xs font-medium text-zinc-700">
                  {listing.category}
                </span>
                {listing.status === 'completed' && (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700">
                    Completed
                  </span>
                )}
                {listing.status === 'cancelled' && (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-xs font-medium text-red-700">
                    Cancelled
                  </span>
                )}
                {isExpired && (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-xs font-medium text-red-700">
                    Expired
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="text-3xl font-bold text-[#252b27] tracking-tight mt-5 mb-1.5">
                {listing.type === 'Sale' && listing.price !== undefined
                  ? `₹${listing.price}`
                  : listing.type === 'Donate'
                  ? 'Free'
                  : listing.type === 'Exchange'
                  ? 'Exchange'
                  : listing.type === 'Borrow'
                  ? 'Borrow'
                  : 'Free'}
              </div>

              {/* Condition / Subtitle Line */}
              <div className="text-xs sm:text-sm text-[#555d56] mb-6">
                {listing.condition && (
                  <span>{listing.condition}</span>
                )}
                {listing.condition && listing.description && (
                  <span> · {listing.description.slice(0, 40)}</span>
                )}
                {!listing.condition && (
                  <span>Campus item · {listing.category}</span>
                )}
              </div>

              {/* Action Buttons for Buyer / Viewer */}
              {!isOwner ? (
                <div className="flex flex-col gap-2.5">
                  {/* Primary CTA: Reserve item */}
                  <button
                    type="button"
                    onClick={handleReserveItem}
                    disabled={isReserving || isStartingChat || listing.status === 'cancelled' || listing.status === 'completed' || isExpired}
                    className={cn(
                      "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs",
                      userReservation && (userReservation.status === 'pending' || userReservation.status === 'accepted')
                        ? "bg-[#edf1ec] text-[#204b39] border border-[#204b39]/30 hover:bg-[#e2eae1]"
                        : "bg-[#204b39] text-white hover:bg-[#183a2c] disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed"
                    )}
                  >
                    {isReserving ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <BookmarkCheck className="h-4.5 w-4.5" />
                    )}
                    <span>
                      {isReserving
                        ? 'Reserving...'
                        : userReservation && (userReservation.status === 'pending' || userReservation.status === 'accepted')
                        ? 'View Request in Chat'
                        : 'Reserve item'}
                    </span>
                  </button>

                  {/* Message Student */}
                  <button
                    type="button"
                    onClick={handleContactStudent}
                    disabled={isStartingChat}
                    className="w-full h-11 rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isStartingChat ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4.5 w-4.5 text-[#252b27]" />
                    )}
                    <span>{isStartingChat ? 'Opening Chat...' : 'Message student'}</span>
                  </button>

                  {/* Save to Wishlist */}
                  <button
                    type="button"
                    onClick={() => toggleSaveListing(listing.id)}
                    className="w-full h-11 rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Heart
                      className={cn(
                        "h-4.5 w-4.5 transition-colors stroke-[1.75]",
                        isSaved ? "fill-red-500 text-red-500" : "text-[#252b27]"
                      )}
                    />
                    <span>{isSaved ? 'Saved to wishlist' : 'Save to wishlist'}</span>
                  </button>

                  <p className="text-xs text-[#555d56] mt-2 leading-relaxed">
                    Reserve to express interest. Discuss the exchange directly with the owner.
                  </p>
                </div>
              ) : (
                /* Owner Actions */
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="w-full h-11 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Edit3 className="h-4.5 w-4.5" />
                    <span>Edit Listing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="w-full h-11 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Cancel Post</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className="w-full h-11 rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Manage in Profile</span>
                  </button>
                </div>
              )}
            </div>

            {/* "LISTED BY" Card */}
            <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 shadow-none">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#555d56] mb-3">
                LISTED BY
              </h3>
              <div className="flex items-center gap-3">
                {seller.avatarUrl ? (
                  <img
                    src={getOptimizedAvatarUrl(seller.avatarUrl, 80)}
                    alt={seller.name}
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-10 rounded-full object-cover border border-[#dedcd4]"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 text-sm font-bold">
                    {seller.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm text-[#252b27]">{seller.name}</p>
                  <p className="text-xs text-[#555d56]">
                    {seller.department || 'Student'} · {seller.campus || 'MIT Campus'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#555d56] mt-3 pt-3 border-t border-[#f4f3ee]">
                Campus student · Anna University
              </p>
            </div>

            {/* "Meet on campus" Card */}
            <div className="rounded-2xl bg-[#edf1ec] p-6 shadow-none">
              <h3 className="text-base font-bold text-[#252b27] mb-2">
                Meet on campus
              </h3>
              <p className="text-sm font-semibold text-[#252b27] mb-1">
                {listing.location || 'MIT Library'}
              </p>
              <p className="text-xs text-[#555d56] leading-relaxed">
                Suggested by the student, not an official pickup location. Agree on the time in chat.
              </p>
            </div>

          </div>
        </div>

        {/* Full-width Safety Notice Card */}
        <div className="mt-8 rounded-2xl bg-[#edf1ec] p-4 sm:p-5 flex items-start gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#204b39] text-[#204b39] shrink-0 mt-0.5 text-[11px] font-bold">
            i
          </div>
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-[#204b39] block sm:inline mr-2">
              A simple student-to-student exchange
            </span>
            <span className="text-[#555d56]">
              Meet in a public campus spot, inspect the item and confirm the details together. StudentNeed does not arrange delivery or process payments.
            </span>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 pb-12 text-xs text-[#555d56]">
          StudentNeed · MIT Campus, Anna University · Campus meetups only
        </footer>

      </div>

      {/* Confirmation Modal for Owner Cancelling Post */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#dedcd4] space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#252b27]">Cancel Listing?</h3>
                <p className="text-xs text-[#555d56]">This action will unpublish your post</p>
              </div>
            </div>
            <p className="text-sm text-[#555d56] leading-relaxed">
              Are you sure you want to cancel &ldquo;{listing.title}&rdquo;? It will be marked as cancelled and removed from active marketplace discovery.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#f4f3ee]">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[#555d56] hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Keep Listing
              </button>
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-4 py-2 text-xs transition-colors cursor-pointer"
                disabled={isCancelling}
                onClick={handleConfirmCancelPost}
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {listing && showEditModal && (
        <EditListingModal
          listing={listing}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
          }}
        />
      )}

      {/* Report Listing Modal */}
      {listing && showReportModal && (
        <ReportListingModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          listingId={listing.id}
          listingTitle={listing.title}
        />
      )}
    </div>
  );
}
