import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where,
  limit,
  orderBy, 
  addDoc, 
  setDoc,
  updateDoc, 
  getDoc, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Chat, ChatMessage, User, Listing, Reservation, CAMPUS_MEETUP_LOCATIONS, CampusMeetupLocation, ItemRequest } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { 
  Send, 
  ChevronLeft, 
  Loader2, 
  AlertCircle, 
  MessageSquare, 
  ExternalLink,
  Check,
  X,
  Clock,
  BookmarkCheck,
  Tag,
  MapPin,
  Building2,
  CheckCircle2,
  IndianRupee
} from 'lucide-react';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const currentUserId = auth.currentUser?.uid || currentUser?.id;

  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [itemRequest, setItemRequest] = useState<ItemRequest | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  
  // Messaging input states
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const lastSentTimestampRef = useRef<number>(0);

  // Reservation action states
  const [isActionLoading, setIsActionLoading] = useState<'reserving' | 'accepting' | 'rejecting' | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationSuccess, setReservationSuccess] = useState<string | null>(null);

  // Meetup action states
  const [selectedMeetupLocation, setSelectedMeetupLocation] = useState<CampusMeetupLocation | ''>('');
  const [isMeetupLoading, setIsMeetupLoading] = useState<'proposing' | 'confirming' | 'cancelling' | null>(null);
  const [meetupError, setMeetupError] = useState<string | null>(null);
  const [meetupSuccess, setMeetupSuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  // 1. Subscribe to Chat Document and verify participant
  useEffect(() => {
    if (!chatId || !currentUserId) {
      setLoading(false);
      return;
    }

    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribeChat = onSnapshot(
      chatDocRef,
      async (docSnap) => {
        if (!docSnap.exists()) {
          setAuthError('Conversation not found.');
          setLoading(false);
          return;
        }

        const data = docSnap.data();
        const participants: string[] = data.participants || [];

        // Verify authenticated user is a participant
        if (!participants.includes(currentUserId)) {
          setAuthError('Access denied. You are not a participant in this conversation.');
          setLoading(false);
          return;
        }

        const chatData: Chat = {
          id: docSnap.id,
          participants,
          listingId: data.listingId,
          requestId: data.requestId,
          reservationId: data.reservationId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
        setChat(chatData);

        // Fetch other participant profile
        const otherParticipantId = participants.find((p) => p !== currentUserId);
        if (otherParticipantId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', otherParticipantId));
            if (userSnap.exists()) {
              setOtherUser({ id: userSnap.id, ...userSnap.data() } as User);
            }
          } catch (err) {
            console.error('Failed to load other participant details:', err);
          }
        }

        // Fetch listing details if attached
        if (data.listingId) {
          try {
            const listingSnap = await getDoc(doc(db, 'listings', data.listingId));
            if (listingSnap.exists()) {
              setListing({ id: listingSnap.id, ...listingSnap.data() } as Listing);
            }
          } catch (err) {
            console.error('Failed to load listing info:', err);
          }
        }

        // Fetch request details if attached
        if (data.requestId) {
          try {
            const requestSnap = await getDoc(doc(db, 'requests', data.requestId));
            if (requestSnap.exists()) {
              setItemRequest({ id: requestSnap.id, ...requestSnap.data() } as ItemRequest);
            }
          } catch (err) {
            console.error('Failed to load request info:', err);
          }
        }
      },
      (err) => {
        console.error('Chat document subscription error:', err);
        setGeneralError('Failed to load conversation. Please check your network.');
        setLoading(false);
      }
    );

    return () => unsubscribeChat();
  }, [chatId, currentUserId]);

  // Determine roles based on reservation if present, falling back to listing
  const sellerId = reservation?.sellerId || listing?.sellerId;
  const buyerId = reservation?.buyerId || chat?.participants.find((p) => p !== sellerId);
  const isSeller = Boolean(currentUserId && sellerId && currentUserId === sellerId);
  const isBuyer = Boolean(currentUserId && buyerId && currentUserId === buyerId);

  // 2. Subscribe to Reservation Document in real time
  useEffect(() => {
    if (!chat || !listing || !buyerId || !currentUserId) return;

    // If chat already has a reservationId, listen to it directly
    if (chat.reservationId) {
      const resRef = doc(db, 'reservations', chat.reservationId);
      const unsubscribeRes = onSnapshot(
        resRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setReservation({
              id: docSnap.id,
              listingId: data.listingId,
              buyerId: data.buyerId,
              sellerId: data.sellerId,
              chatId: data.chatId || chat.id,
              status: data.status,
              meetup: data.meetup || undefined,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          } else {
            setReservation(null);
          }
        },
        (err) => {
          console.warn('Reservation listener notice:', err);
        }
      );
      return () => unsubscribeRes();
    }

    // When reservationId is not yet on chat, use role-scoped queries to avoid permission errors on non-existent documents
    const q = isBuyer
      ? query(
          collection(db, 'reservations'),
          where('buyerId', '==', currentUserId),
          where('listingId', '==', listing.id),
          limit(1)
        )
      : query(
          collection(db, 'reservations'),
          where('sellerId', '==', currentUserId),
          where('listingId', '==', listing.id),
          limit(1)
        );

    const unsubscribeQuery = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setReservation(null);
          return;
        }
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setReservation({
          id: docSnap.id,
          listingId: data.listingId,
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          chatId: data.chatId || chat.id,
          status: data.status,
          meetup: data.meetup || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      },
      (err) => {
        console.warn('Reservation query listener notice:', err);
      }
    );

    return () => unsubscribeQuery();
  }, [chat, listing, buyerId, currentUserId, isBuyer]);

  // 3. Subscribe to Messages subcollection in real time
  useEffect(() => {
    if (!chatId || !currentUserId || authError) {
      return;
    }

    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const loadedMessages: ChatMessage[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            senderId: data.senderId,
            text: data.text,
            createdAt: data.createdAt,
          };
        });

        setMessages(loadedMessages);
        setLoading(false);
      },
      (err) => {
        console.error('Messages subscription error:', err);
        setGeneralError('Unable to sync messages in real time.');
        setLoading(false);
      }
    );

    return () => unsubscribeMessages();
  }, [chatId, currentUserId, authError]);

  // 4. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !chatId || !currentUserId) return;

    if (trimmed.length > 2000) {
      setSendError('Message is too long (maximum 2,000 characters).');
      return;
    }

    const now = Date.now();
    if (now - lastSentTimestampRef.current < 350) {
      return;
    }
    lastSentTimestampRef.current = now;

    setIsSending(true);
    setSendError(null);

    try {
      // Create message document in chats/{chatId}/messages
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: currentUserId,
        text: trimmed,
        createdAt: serverTimestamp(),
      });

      // Update chats/{chatId}.updatedAt
      await updateDoc(doc(db, 'chats', chatId), {
        updatedAt: serverTimestamp(),
      });

      setInputText('');
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      setSendError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // 5. Reservation Handlers
  const handleRequestReservation = async () => {
    setReservationError(null);
    setReservationSuccess(null);

    if (!listing || !chat || !currentUserId || !buyerId || !sellerId) {
      setReservationError('Unable to identify listing or student details.');
      return;
    }

    // Prevent student from reserving their own listing
    if (currentUserId === sellerId) {
      setReservationError('You cannot reserve your own listing.');
      return;
    }

    if (listing.status === 'cancelled' || listing.status === 'completed') {
      setReservationError(`Cannot reserve this item: listing is ${listing.status}.`);
      return;
    }

    // Prevent duplicate active reservations
    if (reservation && (reservation.status === 'pending' || reservation.status === 'accepted')) {
      setReservationError(`You already have an active reservation (${reservation.status}) for this item.`);
      return;
    }

    setIsActionLoading('reserving');

    try {
      const resId = `res_${listing.id}_${buyerId}`;
      const resRef = doc(db, 'reservations', resId);

      // Verify server-side state via a secure query instead of getDoc to avoid permission error on non-existent doc
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
          setReservationError(`An active reservation already exists with status "${existingStatus}".`);
          setIsActionLoading(null);
          return;
        }

        if (existingStatus === 'rejected' || existingStatus === 'cancelled') {
          // Re-request reservation: allowed for original buyer (rejected/cancelled -> pending)
          await updateDoc(doc(db, 'reservations', existingDoc.id), {
            status: 'pending',
            updatedAt: serverTimestamp(),
          });

          await updateDoc(doc(db, 'chats', chat.id), {
            reservationId: existingDoc.id,
            updatedAt: serverTimestamp(),
          });

          setReservationSuccess('Reservation re-requested! Waiting for seller confirmation.');
          return;
        }
      }

      // Create reservation with required fields and initial status "pending"
      await setDoc(resRef, {
        listingId: listing.id,
        buyerId: currentUserId,
        sellerId: sellerId,
        chatId: chat.id,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update chat document with reservationId & updatedAt
      await updateDoc(doc(db, 'chats', chat.id), {
        reservationId: resId,
        updatedAt: serverTimestamp(),
      });

      setReservationSuccess('Reservation request submitted! Waiting for seller confirmation.');
    } catch (err: any) {
      console.error('Error creating reservation:', err);
      setReservationError("Couldn't request reservation. Please try again.");
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleUpdateReservationStatus = async (targetStatus: 'accepted' | 'rejected') => {
    setReservationError(null);
    setReservationSuccess(null);

    if (!reservation || !currentUserId || isActionLoading) return;

    // Authorization check: Only the seller can accept or reject
    if (currentUserId !== reservation.sellerId) {
      setReservationError('Only the seller is authorized to accept or reject reservation requests.');
      return;
    }

    // Status transition enforcement: only pending -> accepted or pending -> rejected
    if (reservation.status !== 'pending') {
      setReservationError(`Cannot update status: reservation is already ${reservation.status}.`);
      return;
    }

    setIsActionLoading(targetStatus === 'accepted' ? 'accepting' : 'rejecting');

    try {
      const resRef = doc(db, 'reservations', reservation.id);
      await updateDoc(resRef, {
        status: targetStatus,
        updatedAt: serverTimestamp(),
      });

      // Also update chat timestamp
      if (chat?.id) {
        await updateDoc(doc(db, 'chats', chat.id), {
          updatedAt: serverTimestamp(),
        });
      }

      // Synchronize listing status: 'reserved' when accepted, 'available' when rejected
      if (listing?.id && currentUserId === listing.sellerId) {
        await updateDoc(doc(db, 'listings', listing.id), {
          status: targetStatus === 'accepted' ? 'reserved' : 'available',
          updatedAt: serverTimestamp(),
        });
      }

      setReservationSuccess(
        targetStatus === 'accepted'
          ? 'Reservation accepted! Coordinate pickup details with the student.'
          : 'Reservation declined.'
      );
    } catch (err: any) {
      console.error(`Error updating reservation to ${targetStatus}:`, err);
      setReservationError(
        targetStatus === 'accepted'
          ? "Couldn't accept the reservation. Please try again."
          : "Couldn't reject the reservation. Please try again."
      );
    } finally {
      setIsActionLoading(null);
    }
  };

  // Legitimate Exchange Completion (Accepted -> Completed)
  const handleCompleteExchange = async () => {
    setReservationError(null);
    setReservationSuccess(null);

    if (!reservation || !currentUserId || isActionLoading) return;

    if (reservation.status !== 'accepted') {
      setReservationError('Only accepted reservations can be completed.');
      return;
    }

    if (currentUserId !== reservation.buyerId && currentUserId !== reservation.sellerId) {
      setReservationError('Only the buyer or seller can complete the exchange.');
      return;
    }

    setIsActionLoading('completing' as any);

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/reservations/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ reservationId: reservation.id }),
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData?.error || 'Failed to mark exchange as completed.');
        }
      } else {
        const resRef = doc(db, 'reservations', reservation.id);
        await updateDoc(resRef, {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
        if (listing?.id) {
          await updateDoc(doc(db, 'listings', listing.id), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          });
        }
      }

      setReservationSuccess('Exchange successfully completed! Thank you for trading on campus.');
    } catch (err: any) {
      console.error('Error completing exchange:', err);
      setReservationError("Couldn't complete exchange. Please try again.");
    } finally {
      setIsActionLoading(null);
    }
  };

  // Reservation Cancellation (Pending -> Cancelled by Buyer, Accepted -> Cancelled by Buyer or Seller)
  const handleCancelReservation = async () => {
    setReservationError(null);
    setReservationSuccess(null);

    if (!reservation || !currentUserId || isActionLoading) return;

    if (reservation.status !== 'pending' && reservation.status !== 'accepted') {
      setReservationError(`Cannot cancel a reservation with status '${reservation.status}'.`);
      return;
    }

    if (reservation.status === 'pending' && currentUserId !== reservation.buyerId) {
      setReservationError('Only the buyer can cancel a pending reservation request.');
      return;
    }

    if (
      reservation.status === 'accepted' &&
      currentUserId !== reservation.buyerId &&
      currentUserId !== reservation.sellerId
    ) {
      setReservationError('Only the buyer or seller can cancel an accepted reservation.');
      return;
    }

    setIsActionLoading('cancelling' as any);

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/reservations/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ reservationId: reservation.id }),
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData?.error || 'Failed to cancel reservation.');
        }
      } else {
        const resRef = doc(db, 'reservations', reservation.id);
        await updateDoc(resRef, {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
        if (reservation.status === 'accepted' && listing?.id) {
          await updateDoc(doc(db, 'listings', listing.id), {
            status: 'available',
            updatedAt: serverTimestamp(),
          });
        }
      }

      setReservationSuccess('Reservation successfully cancelled.');
    } catch (err: any) {
      console.error('Error cancelling reservation:', err);
      setReservationError("Couldn't cancel reservation. Please try again.");
    } finally {
      setIsActionLoading(null);
    }
  };

  // Campus Meetup Handlers (Only for Accepted Reservations)
  const handleProposeMeetup = async (locationOverride?: CampusMeetupLocation) => {
    setMeetupError(null);
    setMeetupSuccess(null);

    const loc = locationOverride || selectedMeetupLocation;

    if (!reservation || !currentUserId || isMeetupLoading) return;

    // Must be accepted
    if (reservation.status !== 'accepted') {
      setMeetupError('A meetup can only be arranged once the reservation has been accepted.');
      return;
    }

    // Must be participant
    if (currentUserId !== reservation.buyerId && currentUserId !== reservation.sellerId) {
      setMeetupError('Only the buyer or seller can arrange campus meetup locations.');
      return;
    }

    // Must be valid predefined location
    if (!loc || !CAMPUS_MEETUP_LOCATIONS.includes(loc as any)) {
      setMeetupError('Please select a valid campus meetup location.');
      return;
    }

    setIsMeetupLoading('proposing');

    try {
      const resRef = doc(db, 'reservations', reservation.id);
      await updateDoc(resRef, {
        meetup: {
          location: loc,
          status: 'proposed',
          proposedBy: currentUserId,
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      if (chat?.id) {
        await updateDoc(doc(db, 'chats', chat.id), {
          updatedAt: serverTimestamp(),
        });
      }

      setMeetupSuccess(`Proposed meetup at ${loc}. Awaiting confirmation from ${otherUser?.name || 'the other student'}.`);
      setSelectedMeetupLocation('');
    } catch (err: any) {
      console.error('Error proposing meetup location:', err);
      setMeetupError(err?.message || 'Failed to propose meetup location.');
    } finally {
      setIsMeetupLoading(null);
    }
  };

  const handleConfirmMeetup = async () => {
    setMeetupError(null);
    setMeetupSuccess(null);

    if (!reservation || !currentUserId || isMeetupLoading) return;

    if (reservation.status !== 'accepted') {
      setMeetupError('A meetup can only be confirmed for accepted reservations.');
      return;
    }

    if (!reservation.meetup || reservation.meetup.status !== 'proposed') {
      setMeetupError('There is no pending meetup proposal to confirm.');
      return;
    }

    if (currentUserId === reservation.meetup.proposedBy) {
      setMeetupError('You cannot confirm your own proposed location. The other student must confirm.');
      return;
    }

    if (currentUserId !== reservation.buyerId && currentUserId !== reservation.sellerId) {
      setMeetupError('Only the buyer or seller can confirm the meetup.');
      return;
    }

    setIsMeetupLoading('confirming');

    try {
      const resRef = doc(db, 'reservations', reservation.id);
      await updateDoc(resRef, {
        meetup: {
          location: reservation.meetup.location,
          status: 'confirmed',
          proposedBy: reservation.meetup.proposedBy,
          confirmedBy: currentUserId,
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      if (chat?.id) {
        await updateDoc(doc(db, 'chats', chat.id), {
          updatedAt: serverTimestamp(),
        });
      }

      setMeetupSuccess(`Meetup confirmed at ${reservation.meetup.location}!`);
    } catch (err: any) {
      console.error('Error confirming meetup:', err);
      setMeetupError(err?.message || 'Failed to confirm meetup location.');
    } finally {
      setIsMeetupLoading(null);
    }
  };

  const handleCancelMeetup = async () => {
    setMeetupError(null);
    setMeetupSuccess(null);

    if (!reservation || !currentUserId || isMeetupLoading) return;

    if (reservation.status !== 'accepted') {
      setMeetupError('Cannot modify meetup for non-accepted reservations.');
      return;
    }

    if (!reservation.meetup || (reservation.meetup.status !== 'proposed' && reservation.meetup.status !== 'confirmed')) {
      setMeetupError('No active or proposed meetup to change.');
      return;
    }

    if (currentUserId !== reservation.buyerId && currentUserId !== reservation.sellerId) {
      setMeetupError('Only the buyer or seller can modify the meetup.');
      return;
    }

    setIsMeetupLoading('cancelling');

    try {
      const resRef = doc(db, 'reservations', reservation.id);
      await updateDoc(resRef, {
        meetup: {
          location: reservation.meetup.location,
          status: 'cancelled',
          proposedBy: reservation.meetup.proposedBy,
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      if (chat?.id) {
        await updateDoc(doc(db, 'chats', chat.id), {
          updatedAt: serverTimestamp(),
        });
      }

      setMeetupSuccess('Meetup location reset. You can now select and propose a new location.');
    } catch (err: any) {
      console.error('Error resetting meetup location:', err);
      setMeetupError(err?.message || 'Failed to reset meetup location.');
    } finally {
      setIsMeetupLoading(null);
    }
  };

  // Helper to format timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Loading View
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-900" />
        <p className="text-sm font-medium text-zinc-500">Loading conversation...</p>
      </div>
    );
  }

  // Unauthorized / Auth Error View
  if (authError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Access Denied</h2>
        <p className="text-sm text-zinc-600 mb-6">{authError}</p>
        <Button onClick={() => navigate('/marketplace')} className="w-full">
          Back to Marketplace
        </Button>
      </div>
    );
  }

  // General Error View
  if (generalError && !chat) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Something Went Wrong</h2>
        <p className="text-sm text-zinc-600 mb-6">{generalError}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex h-[calc(100vh-9.5rem)] md:h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              {otherUser?.avatarUrl ? (
                <img
                  src={otherUser.avatarUrl}
                  alt={otherUser.name || 'Student'}
                  className="h-10 w-10 rounded-full object-cover border border-zinc-200"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                  {(otherUser?.name || 'S').charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <h2 className="text-sm font-semibold text-zinc-900 sm:text-base">
                  {otherUser?.name || 'Student'}
                </h2>
                <p className="text-xs text-zinc-500">
                  {otherUser?.department ? `${otherUser.department} • ` : ''}Campus Verified
                </p>
              </div>
            </div>
          </div>

          {/* Attached Listing Preview Pill */}
          {listing && (
            <Link
              to={`/listing/${listing.id}`}
              className="hidden sm:flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              title="View item details"
            >
              <span className="max-w-[150px] truncate">{listing.title}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
            </Link>
          )}

          {/* Attached Request Preview Pill */}
          {itemRequest && (
            <Link
              to="/requests"
              className="hidden sm:flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              title="View campus requests"
            >
              <span className="max-w-[150px] truncate">Request: {itemRequest.title}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
            </Link>
          )}
        </div>

        {/* Attached Listing Mobile Pill */}
        {listing && (
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-1.5 sm:hidden text-xs">
            <span className="text-zinc-500 truncate mr-2">Regarding: <strong className="text-zinc-800">{listing.title}</strong></span>
            <Link to={`/listing/${listing.id}`} className="text-zinc-900 font-medium underline shrink-0">
              View Item
            </Link>
          </div>
        )}

        {/* Attached Request Mobile Pill */}
        {itemRequest && (
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-1.5 sm:hidden text-xs">
            <span className="text-zinc-500 truncate mr-2">Regarding Request: <strong className="text-zinc-800">{itemRequest.title}</strong></span>
            <Link to="/requests" className="text-zinc-900 font-medium underline shrink-0">
              View Requests
            </Link>
          </div>
        )}

        {/* Reservation Status & Action Bar */}
        {listing && (
          <div className="border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {/* Left Side: Listing Info & Status Badge */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal-light text-brand-teal-hover border border-brand-teal-border">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-charcoal truncate max-w-[180px] sm:max-w-[240px]">
                      {listing.title}
                    </span>
                    {listing.price !== undefined && (
                      <span className="text-xs font-bold text-brand-charcoal">₹{listing.price}</span>
                    )}

                    {/* Status Badge */}
                    {listing.status === 'cancelled' ? (
                      <Badge variant="destructive" className="gap-1 font-medium bg-red-600 text-white">
                        Cancelled
                      </Badge>
                    ) : reservation?.status === 'pending' ? (
                      <Badge variant="warning" className="gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    ) : reservation?.status === 'accepted' ? (
                      <Badge variant="success" className="gap-1 font-medium">
                        <Check className="h-3 w-3" />
                        Accepted
                      </Badge>
                    ) : reservation?.status === 'rejected' ? (
                      <Badge variant="secondary" className="gap-1 font-medium text-brand-muted">
                        <X className="h-3 w-3" />
                        Declined
                      </Badge>
                    ) : reservation?.status === 'cancelled' ? (
                      <Badge variant="secondary" className="gap-1 font-medium text-brand-muted">
                        <X className="h-3 w-3" />
                        Cancelled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-brand-muted font-normal">
                        No active request
                      </Badge>
                    )}
                  </div>

                  {/* Contextual Description */}
                  <p className="text-[11px] text-brand-muted mt-0.5">
                    {listing.status === 'cancelled' && 'This listing has been cancelled by the seller.'}
                    {listing.status !== 'cancelled' && reservation?.status === 'pending' && isBuyer && 'Your reservation request is pending seller confirmation.'}
                    {listing.status !== 'cancelled' && reservation?.status === 'pending' && isSeller && `Incoming reservation request from ${otherUser?.name || 'student'}.`}
                    {listing.status !== 'cancelled' && reservation?.status === 'accepted' && 'Item is reserved. Arrange pickup and exchange details in chat.'}
                    {listing.status !== 'cancelled' && reservation?.status === 'rejected' && 'The reservation request for this listing was declined.'}
                    {listing.status !== 'cancelled' && reservation?.status === 'cancelled' && 'This reservation was cancelled.'}
                    {listing.status !== 'cancelled' && !reservation && isBuyer && 'Interested in this item? Request to reserve it from the seller.'}
                    {listing.status !== 'cancelled' && !reservation && isSeller && 'Waiting for student reservation request.'}
                  </p>
                </div>
              </div>

              {/* Right Side: Dynamic Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {/* Cancelled Listing notice for Buyer */}
                {isBuyer && listing.status === 'cancelled' && (
                  <span className="text-xs text-red-600 font-medium">Listing Cancelled</span>
                )}

                {/* Buyer: Request Reservation button */}
                {isBuyer && listing.status !== 'cancelled' && (!reservation || reservation.status === 'rejected' || reservation.status === 'cancelled') && (
                  <Button
                    size="sm"
                    onClick={handleRequestReservation}
                    disabled={isActionLoading === 'reserving'}
                    className="gap-1.5 text-xs h-8 px-3 font-medium bg-brand-teal text-white hover:bg-brand-teal-hover shadow-xs"
                  >
                    {isActionLoading === 'reserving' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    )}
                    {isActionLoading === 'reserving'
                      ? 'Requesting...'
                      : reservation?.status === 'rejected'
                      ? 'Re-request Reservation'
                      : reservation?.status === 'cancelled'
                      ? 'Reserve Again'
                      : 'Request Reservation'}
                  </Button>
                )}

                {/* Buyer: Cancel Pending Request button */}
                {isBuyer && reservation?.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelReservation}
                    disabled={isActionLoading !== null}
                    className="gap-1 text-xs h-8 px-3 font-medium border-red-200 text-red-600 hover:bg-red-50"
                  >
                    {isActionLoading === ('cancelling' as any) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Cancel Request
                  </Button>
                )}

                {/* Seller: Accept / Reject buttons */}
                {isSeller && reservation?.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateReservationStatus('accepted')}
                      disabled={isActionLoading !== null}
                      className="gap-1 text-xs h-8 px-3 font-medium bg-brand-teal hover:bg-brand-teal-hover text-white shadow-xs"
                    >
                      {isActionLoading === 'accepting' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateReservationStatus('rejected')}
                      disabled={isActionLoading !== null}
                      className="gap-1 text-xs h-8 px-3 font-medium border-brand-border text-brand-charcoal hover:bg-slate-100"
                    >
                      {isActionLoading === 'rejecting' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}

                {/* Complete Exchange and Cancel Actions (Only when Accepted) */}
                {reservation?.status === 'accepted' && (currentUserId === reservation.buyerId || currentUserId === reservation.sellerId) && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleCompleteExchange}
                      disabled={isActionLoading !== null}
                      className="gap-1.5 text-xs h-8 px-3 font-semibold bg-brand-teal text-white hover:bg-brand-teal-hover shadow-xs"
                    >
                      {isActionLoading === ('completing' as any) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      )}
                      Complete Exchange
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelReservation}
                      disabled={isActionLoading !== null}
                      className="gap-1 text-xs h-8 px-2.5 font-medium border-red-200 text-red-600 hover:bg-red-50"
                    >
                      {isActionLoading === ('cancelling' as any) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Notification messages for reservation actions */}
            {reservationError && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span>{reservationError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReservationError(null)}
                  className="text-zinc-500 hover:text-zinc-700 ml-2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {reservationSuccess && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800 border border-emerald-200">
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{reservationSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReservationSuccess(null)}
                  className="text-emerald-600 hover:text-emerald-800 ml-2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Campus Meetup Section - ONLY for ACCEPTED Reservations */}
            {reservation?.status === 'accepted' && (
              <div className="mt-3.5 pt-3.5 border-t border-zinc-200">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Campus Meetup Point
                    </span>
                  </div>

                  {/* Status Badge */}
                  {(!reservation.meetup || reservation.meetup.status === 'not_set') && (
                    <Badge variant="outline" className="text-zinc-600 bg-white border-zinc-300 text-[11px]">
                      Not Set
                    </Badge>
                  )}
                  {reservation.meetup?.status === 'proposed' && (
                    <Badge variant="warning" className="gap-1 font-medium text-[11px]">
                      <Clock className="h-3 w-3" />
                      Proposal Pending
                    </Badge>
                  )}
                  {reservation.meetup?.status === 'confirmed' && (
                    <Badge variant="success" className="gap-1 font-medium text-[11px]">
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmed
                    </Badge>
                  )}
                  {reservation.meetup?.status === 'cancelled' && (
                    <Badge variant="secondary" className="gap-1 font-medium text-[11px]">
                      <X className="h-3 w-3" />
                      Cancelled
                    </Badge>
                  )}
                </div>

                {/* Sub-view based on Meetup Status */}
                {/* State 1: Not Set or Cancelled */}
                {(!reservation.meetup || reservation.meetup.status === 'not_set' || reservation.meetup.status === 'cancelled') && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-800">
                        Select a campus exchange landmark
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Choose a safe, well-lit campus location to meet in person for the item handover.
                      </p>
                    </div>

                    {/* Predefined Campus Locations Selector */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {CAMPUS_MEETUP_LOCATIONS.map((loc) => {
                        const isSelected = selectedMeetupLocation === loc;
                        return (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setSelectedMeetupLocation(loc)}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all text-left',
                              isSelected
                                ? 'border-brand-teal bg-brand-teal text-white shadow-xs'
                                : 'border-brand-border bg-brand-bg text-brand-charcoal hover:bg-slate-100 hover:border-brand-teal/40'
                            )}
                          >
                            <Building2 className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-white' : 'text-brand-muted')} />
                            <span className="truncate">{loc}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-brand-muted">
                        {selectedMeetupLocation ? `Selected: ${selectedMeetupLocation}` : 'Pick a location to propose'}
                      </span>
                      <Button
                        size="sm"
                        disabled={!selectedMeetupLocation || isMeetupLoading !== null}
                        onClick={() => handleProposeMeetup()}
                        className="text-xs h-8 px-3 gap-1.5 bg-brand-teal text-white hover:bg-brand-teal-hover shadow-xs"
                      >
                        {isMeetupLoading === 'proposing' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5" />
                        )}
                        Propose Location
                      </Button>
                    </div>
                  </div>
                )}

                {/* State 2: Proposed */}
                {reservation.meetup?.status === 'proposed' && (
                  <div className={cn(
                    'rounded-xl border p-3.5 space-y-3',
                    reservation.meetup.proposedBy === currentUserId
                      ? 'border-amber-200 bg-amber-50/60'
                      : 'border-blue-200 bg-blue-50/60'
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          reservation.meetup.proposedBy === currentUserId
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        )}>
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-900">
                            {reservation.meetup.proposedBy === currentUserId ? (
                              <>You proposed meeting at <strong className="text-amber-950 underline decoration-amber-300">{reservation.meetup.location}</strong></>
                            ) : (
                              <><strong className="text-blue-950">{otherUser?.name || 'Other student'}</strong> proposed meeting at <strong className="underline decoration-blue-300">{reservation.meetup.location}</strong></>
                            )}
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            {reservation.meetup.proposedBy === currentUserId
                              ? `Waiting for ${otherUser?.name || 'the other student'} to confirm this location.`
                              : 'Review this campus location. Confirm if it works for you, or suggest another.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {reservation.meetup.proposedBy !== currentUserId ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelMeetup}
                            disabled={isMeetupLoading !== null}
                            className="text-xs h-8 px-3 border-zinc-300 text-zinc-700 hover:bg-white"
                          >
                            Suggest Different Spot
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleConfirmMeetup}
                            disabled={isMeetupLoading !== null}
                            className="text-xs h-8 px-3 gap-1.5 bg-brand-teal hover:bg-brand-teal-hover text-white shadow-xs"
                          >
                            {isMeetupLoading === 'confirming' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Confirm Meetup at {reservation.meetup.location}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelMeetup}
                          disabled={isMeetupLoading !== null}
                          className="text-xs h-8 px-3 border-amber-300 text-amber-900 hover:bg-amber-100/70"
                        >
                          {isMeetupLoading === 'cancelling' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          Cancel Proposal
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* State 3: Confirmed */}
                {reservation.meetup?.status === 'confirmed' && (
                  <div className="rounded-xl border border-brand-teal-border bg-brand-teal-light p-3.5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal text-white shadow-2xs">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-brand-charcoal">
                              Confirmed Meetup Point
                            </span>
                            <Badge variant="success" className="text-[10px] py-0 px-1.5">
                              Agreed
                            </Badge>
                          </div>
                          <p className="text-sm font-extrabold text-brand-teal-hover mt-0.5">
                            {reservation.meetup.location}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelMeetup}
                          disabled={isMeetupLoading !== null}
                          className="text-xs h-7 px-2.5 border-brand-teal-border text-brand-teal-hover hover:bg-white"
                        >
                          {isMeetupLoading === 'cancelling' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          Change Location
                        </Button>
                      </div>
                    </div>

                    <p className="text-[11px] text-brand-charcoal leading-relaxed border-t border-brand-teal-border/60 pt-2">
                      Both students agreed to meet at <strong>{reservation.meetup.location}</strong>. Meet during daylight hours and inspect the item before completing the handover.
                    </p>
                  </div>
                )}

                {/* Meetup Error and Success notifications */}
                {meetupError && (
                  <div className="mt-2.5 flex items-center justify-between rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                      <span>{meetupError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMeetupError(null)}
                      className="text-zinc-500 hover:text-zinc-700 ml-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {meetupSuccess && (
                  <div className="mt-2.5 flex items-center justify-between rounded-lg bg-brand-teal-light p-2 text-xs text-brand-teal-hover border border-brand-teal-border">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-teal" />
                      <span>{meetupSuccess}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMeetupSuccess(null)}
                      className="text-brand-teal hover:text-brand-teal-hover ml-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Request Context Bar */}
        {itemRequest && (
          <div className="border-b border-brand-border bg-brand-bg px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal-light text-brand-teal-hover mt-0.5 border border-brand-teal-border">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-brand-charcoal truncate max-w-[180px] sm:max-w-[260px]">
                      {itemRequest.title}
                    </span>
                    {itemRequest.budget && (
                      <span className="flex items-center text-xs font-bold text-brand-teal-hover bg-brand-teal-light border border-brand-teal-border px-1.5 py-0.5 rounded">
                        <IndianRupee className="h-3 w-3 mr-0.5" />
                        Budget: ₹{itemRequest.budget}
                      </span>
                    )}
                    <Badge
                      variant={itemRequest.status === 'open' ? 'default' : itemRequest.status === 'matched' ? 'success' : 'secondary'}
                      className="text-[10px] py-0 px-1.5 font-medium"
                    >
                      {itemRequest.status.charAt(0).toUpperCase() + itemRequest.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-brand-muted mt-1">
                    {itemRequest.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-brand-teal" />
                        {itemRequest.location}
                      </span>
                    )}
                    {itemRequest.neededBy && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-brand-muted" />
                        Needed by: {itemRequest.neededBy}
                      </span>
                    )}
                    <span className="text-brand-muted">• Campus Request</span>
                  </div>

                  {itemRequest.description && (
                    <p className="text-[11px] text-zinc-600 line-clamp-1 italic mt-1">
                      "{itemRequest.description}"
                    </p>
                  )}
                </div>
              </div>

              <div className="self-end sm:self-auto shrink-0">
                <Link to="/requests">
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 text-brand-charcoal border-brand-border hover:bg-slate-100">
                    Back to Requests
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* In-Chat Safety Notice Banner */}
        <div className="border-b border-amber-200/80 bg-amber-50/70 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-amber-900 leading-snug">
            <span className="text-sm shrink-0 select-none">⚠️</span>
            <p>
              <strong>Safety Notice:</strong> StudentNeed only connects students. We do not guarantee the product or money involved in a transaction. Please meet in person, inspect the item, and complete the deal safely.
            </p>
          </div>
        </div>

        {/* Messages List Area */}
        <div 
          ref={messageListRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-brand-bg/60"
        >
          {messages.length === 0 ? (
            /* Empty State */
            <div className="flex h-full flex-col items-center justify-center text-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-brand-border text-brand-teal mb-3 shadow-xs">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-brand-charcoal mb-1">No messages yet</h3>
              <p className="text-xs sm:text-sm text-brand-muted max-w-xs">
                Start the conversation with {otherUser?.name || 'this student'} about campus pickup or item details.
              </p>
            </div>
          ) : (
            /* Message Bubbles */
            messages.map((msg) => {
              const isCurrentUser = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] sm:max-w-[70%] break-words shadow-xs ${
                      isCurrentUser
                        ? 'bg-brand-teal text-white rounded-tr-sm'
                        : 'bg-white text-brand-charcoal border border-brand-border rounded-tl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-brand-muted">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Send Error Alert */}
        {sendError && (
          <div className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{sendError}</span>
          </div>
        )}

        {/* Message Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-zinc-200 bg-white p-3 sm:p-4 flex items-center gap-2"
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            disabled={isSending}
            maxLength={2000}
            className="flex-1 bg-zinc-50 border-zinc-200 focus:bg-white text-sm"
            autoFocus
          />
          <Button
            type="submit"
            disabled={!inputText.trim() || isSending}
            size="default"
            className="gap-1.5 shrink-0 px-4 font-medium"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{isSending ? 'Sending' : 'Send'}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
