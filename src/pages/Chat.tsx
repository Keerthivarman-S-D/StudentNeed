import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useNotifications } from '../context/NotificationContext';
import { useAppContext } from '../context/AppContext';
import { 
  Chat, 
  ChatMessage, 
  User, 
  Listing, 
  Reservation, 
  CAMPUS_MEETUP_LOCATIONS, 
  CampusMeetupLocation, 
  ItemRequest 
} from '../types';
import { RESERVATION_ENDPOINTS, NOTIFICATION_ENDPOINTS } from '../config/api';
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
  IndianRupee,
  ShieldCheck,
  ShieldAlert,
  Search,
  Package,
  Inbox
} from 'lucide-react';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { markChatAsRead, chatUnreadCounts } = useNotifications();
  const { users } = useAppContext();
  const currentUserId = auth.currentUser?.uid || currentUser?.id;

  // Active chat state
  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [itemRequest, setItemRequest] = useState<ItemRequest | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [loading, setLoading] = useState(Boolean(chatId));
  const [authError, setAuthError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  
  // Messaging input states
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const lastSentTimestampRef = useRef<number>(0);

  // Reservation action states
  const [isActionLoading, setIsActionLoading] = useState<'reserving' | 'accepting' | 'rejecting' | 'completing' | 'cancelling' | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationSuccess, setReservationSuccess] = useState<string | null>(null);

  // Meetup action states
  const [selectedMeetupLocation, setSelectedMeetupLocation] = useState<CampusMeetupLocation | ''>('');
  const [isMeetupLoading, setIsMeetupLoading] = useState<'proposing' | 'confirming' | 'cancelling' | null>(null);
  const [meetupError, setMeetupError] = useState<string | null>(null);
  const [meetupSuccess, setMeetupSuccess] = useState<string | null>(null);

  // Conversation Sidebar state
  const [sidebarChats, setSidebarChats] = useState<Chat[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [recentMessagesMap, setRecentMessagesMap] = useState<Record<string, { text: string; createdAt: any }>>({});
  const [sidebarUsersMap, setSidebarUsersMap] = useState<Record<string, User>>({});

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

  // 1. Subscribe to User's Conversations for Sidebar
  useEffect(() => {
    if (!currentUserId) {
      setSidebarChats([]);
      setSidebarLoading(false);
      return;
    }

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUserId),
      limit(50)
    );

    const messageUnsubs: Record<string, () => void> = {};

    const unsubChats = onSnapshot(
      chatsQuery,
      (snapshot) => {
        const loadedChats: Chat[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            participants: data.participants || [],
            listingId: data.listingId,
            requestId: data.requestId,
            reservationId: data.reservationId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });

        // Sort chats by recent activity
        loadedChats.sort((a, b) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        setSidebarChats(loadedChats);
        setSidebarLoading(false);

        // Fetch latest preview message for each chat
        const currentChatIds = new Set(loadedChats.map(c => c.id));
        Object.keys(messageUnsubs).forEach(id => {
          if (!currentChatIds.has(id)) {
            messageUnsubs[id]();
            delete messageUnsubs[id];
          }
        });

        loadedChats.forEach((c) => {
          if (!messageUnsubs[c.id]) {
            const lastMsgQuery = query(
              collection(db, 'chats', c.id, 'messages'),
              orderBy('createdAt', 'desc'),
              limit(1)
            );
            messageUnsubs[c.id] = onSnapshot(lastMsgQuery, (msgSnap) => {
              if (!msgSnap.empty) {
                const msgData = msgSnap.docs[0].data();
                setRecentMessagesMap((prev) => ({
                  ...prev,
                  [c.id]: {
                    text: msgData.text || '',
                    createdAt: msgData.createdAt,
                  },
                }));
              }
            }, (err) => console.warn('Sidebar message preview note:', err));
          }

          // Fetch other participant profile if not already cached
          const otherId = c.participants.find((p) => p !== currentUserId);
          if (otherId && !sidebarUsersMap[otherId]) {
            const existingUser = users.find(u => u.id === otherId);
            if (existingUser) {
              setSidebarUsersMap(prev => ({ ...prev, [otherId]: existingUser }));
            } else {
              getDoc(doc(db, 'users', otherId))
                .then((snap) => {
                  if (snap.exists()) {
                    setSidebarUsersMap((prev) => ({
                      ...prev,
                      [otherId]: { id: snap.id, ...snap.data() } as User,
                    }));
                  }
                })
                .catch(() => {});
            }
          }
        });
      },
      (err) => {
        console.warn('Sidebar conversations listener notice:', err);
        setSidebarLoading(false);
      }
    );

    return () => {
      unsubChats();
      Object.values(messageUnsubs).forEach((unsub) => unsub());
    };
  }, [currentUserId, users]);

  // 2. Subscribe to Active Chat Document and verify participant
  useEffect(() => {
    if (!chatId || !currentUserId) {
      setLoading(false);
      setChat(null);
      setOtherUser(null);
      setListing(null);
      setItemRequest(null);
      setReservation(null);
      setMessages([]);
      return;
    }

    setLoading(true);
    setAuthError(null);
    setGeneralError(null);

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
        } else {
          setListing(null);
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
        } else {
          setItemRequest(null);
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

  // 3. Subscribe to Reservation Document in real time
  useEffect(() => {
    if (!chat || !listing || !buyerId || !currentUserId) return;

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
        (err) => console.warn('Reservation listener notice:', err)
      );
      return () => unsubscribeRes();
    }

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
      (err) => console.warn('Reservation query listener notice:', err)
    );

    return () => unsubscribeQuery();
  }, [chat, listing, buyerId, currentUserId, isBuyer]);

  // 4. Subscribe to Messages subcollection in real time
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

  // Track conversation read receipt strictly in user's isolated private document
  useEffect(() => {
    if (!chatId || !currentUserId || authError) return;

    const tryMarkRead = () => {
      if (document.visibilityState === 'visible') {
        markChatAsRead(chatId);
      }
    };

    tryMarkRead();

    window.addEventListener('focus', tryMarkRead);
    document.addEventListener('visibilitychange', tryMarkRead);

    return () => {
      window.removeEventListener('focus', tryMarkRead);
      document.removeEventListener('visibilitychange', tryMarkRead);
    };
  }, [chatId, currentUserId, authError, messages.length, markChatAsRead]);

  // 5. Send Message
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
      const messageDocRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: currentUserId,
        text: trimmed,
        createdAt: serverTimestamp(),
      });

      // Update chats/{chatId}.updatedAt
      await updateDoc(doc(db, 'chats', chatId), {
        updatedAt: serverTimestamp(),
      });

      // Mark sender's own read receipt up to date
      markChatAsRead(chatId);

      setInputText('');

      // Dispatch Web Push notification to counterparty via trusted backend
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          fetch(NOTIFICATION_ENDPOINTS.notifyMessage, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              chatId,
              messageId: messageDocRef.id,
            }),
          }).catch((pushErr) => console.warn('Push notify-message non-fatal error:', pushErr));
        }
      } catch (pushErr) {
        console.warn('Failed to dispatch push notification:', pushErr);
      }
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      setSendError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // 6. Reservation Handlers
  const handleRequestReservation = async () => {
    setReservationError(null);
    setReservationSuccess(null);

    if (!listing || !chat || !currentUserId || !buyerId || !sellerId) {
      setReservationError('Unable to identify listing or student details.');
      return;
    }

    if (currentUserId === sellerId) {
      setReservationError('You cannot reserve your own listing.');
      return;
    }

    if (listing.status === 'cancelled' || listing.status === 'completed') {
      setReservationError(`Cannot reserve this item: listing is ${listing.status}.`);
      return;
    }

    if (reservation && (reservation.status === 'pending' || reservation.status === 'accepted')) {
      setReservationError(`You already have an active reservation (${reservation.status}) for this item.`);
      return;
    }

    setIsActionLoading('reserving');

    try {
      const resId = `res_${listing.id}_${buyerId}`;
      const resRef = doc(db, 'reservations', resId);

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

      await setDoc(resRef, {
        listingId: listing.id,
        buyerId: currentUserId,
        sellerId: sellerId,
        chatId: chat.id,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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

    if (currentUserId !== reservation.sellerId) {
      setReservationError('Only the seller is authorized to accept or reject reservation requests.');
      return;
    }

    if (reservation.status !== 'pending') {
      setReservationError(`Cannot update status: reservation is already ${reservation.status}.`);
      return;
    }

    setIsActionLoading(targetStatus === 'accepted' ? 'accepting' : 'rejecting');

    try {
      if (targetStatus === 'accepted') {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be signed in to accept a reservation.');
        }
        const idToken = await user.getIdToken();
        const response = await fetch(RESERVATION_ENDPOINTS.accept, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ reservationId: reservation.id }),
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData?.error || 'Failed to accept reservation.');
        }
      } else {
        const resRef = doc(db, 'reservations', reservation.id);
        await updateDoc(resRef, {
          status: targetStatus,
          updatedAt: serverTimestamp(),
        });

        if (listing?.id && currentUserId === listing.sellerId) {
          await updateDoc(doc(db, 'listings', listing.id), {
            status: 'available',
            updatedAt: serverTimestamp(),
          });
        }
      }

      if (chat?.id) {
        await updateDoc(doc(db, 'chats', chat.id), {
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
        err.message || (targetStatus === 'accepted'
          ? "Couldn't accept the reservation. Please try again."
          : "Couldn't reject the reservation. Please try again.")
      );
    } finally {
      setIsActionLoading(null);
    }
  };

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

    setIsActionLoading('completing');

    try {
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        const response = await fetch(RESERVATION_ENDPOINTS.complete, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
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

    setIsActionLoading('cancelling');

    try {
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        const response = await fetch(RESERVATION_ENDPOINTS.cancel, {
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

  // Campus Meetup Handlers
  const handleProposeMeetup = async (locationOverride?: CampusMeetupLocation) => {
    setMeetupError(null);
    setMeetupSuccess(null);

    const loc = locationOverride || selectedMeetupLocation;

    if (!reservation || !currentUserId || isMeetupLoading) return;

    if (reservation.status !== 'accepted') {
      setMeetupError('A meetup can only be arranged once the reservation has been accepted.');
      return;
    }

    if (currentUserId !== reservation.buyerId && currentUserId !== reservation.sellerId) {
      setMeetupError('Only the buyer or seller can arrange campus meetup locations.');
      return;
    }

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

  // Timestamp formatting
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const ms = date.getTime();
    if (isNaN(ms)) return '';
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Filtered sidebar conversations
  const filteredSidebarChats = useMemo(() => {
    if (!searchFilter.trim()) return sidebarChats;
    const q = searchFilter.toLowerCase().trim();
    return sidebarChats.filter((c) => {
      const otherId = c.participants.find((p) => p !== currentUserId);
      const user = otherId ? sidebarUsersMap[otherId] : null;
      const userName = user?.name?.toLowerCase() || '';
      const previewText = recentMessagesMap[c.id]?.text?.toLowerCase() || '';
      return userName.includes(q) || previewText.includes(q) || c.id.toLowerCase().includes(q);
    });
  }, [sidebarChats, searchFilter, currentUserId, sidebarUsersMap, recentMessagesMap]);

  // Quick conversation starters for empty chats
  const quickStarters = listing
    ? [
        'Hi! Is this still available?',
        'Can we meet at the Library to check it out?',
        'What condition is the item in?'
      ]
    : itemRequest
    ? [
        'Hi! I can help you with this request.',
        'I have what you need! When can we meet?',
        'Can we meet on campus to discuss?'
      ]
    : [
        'Hi there! Glad to connect on StudentNeed.',
        'When is a convenient time to meet on campus?'
      ];

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#252b27]">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        
        {/* Main 2-Panel Card */}
        <div className="flex h-[calc(100vh-6.5rem)] sm:h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl border border-[#dedcd4] bg-white shadow-xs">
          
          {/* ========================================================= */}
          {/* LEFT PANEL: Conversation Sidebar                           */}
          {/* ========================================================= */}
          <aside 
            className={cn(
              "w-full md:w-80 lg:w-96 flex flex-col border-r border-[#dedcd4] bg-white shrink-0",
              chatId ? "hidden md:flex" : "flex"
            )}
            aria-label="Conversation list"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-[#dedcd4]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-[#252b27]">Messages</h1>
                  {sidebarChats.length > 0 && (
                    <span className="rounded-full bg-[#edf1ec] px-2 py-0.5 text-xs font-semibold text-[#204b39]">
                      {sidebarChats.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#717870]" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search conversations..."
                  className="h-9 w-full rounded-xl border border-[#dedcd4] bg-[#f7f6f2] pl-8 pr-8 text-xs text-[#252b27] placeholder:text-[#8a918a] outline-none transition-colors focus:border-[#204b39] focus:bg-white"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#717870] hover:text-[#252b27]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Conversation Threads List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#dedcd4]/60">
              {sidebarLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-zinc-200 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-28 rounded bg-zinc-200 animate-pulse" />
                        <div className="h-3 w-40 rounded bg-zinc-200 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredSidebarChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] mb-3">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#252b27]">
                    {searchFilter ? 'No conversations found' : 'No messages yet'}
                  </h3>
                  <p className="text-xs text-[#555d56] mt-1 max-w-[200px]">
                    {searchFilter
                      ? 'Try searching with a different student name.'
                      : 'When you connect with peers about an item or request, your messages will appear here.'}
                  </p>
                </div>
              ) : (
                filteredSidebarChats.map((c) => {
                  const otherId = c.participants.find((p) => p !== currentUserId);
                  const participant = otherId ? sidebarUsersMap[otherId] : null;
                  const isSelected = chatId === c.id;
                  const preview = recentMessagesMap[c.id];
                  const unreadCount = chatUnreadCounts[c.id] || 0;
                  const isRequestChat = Boolean(c.requestId);

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/chat/${c.id}`)}
                      className={cn(
                        "w-full text-left px-3.5 py-2.5 sm:px-4 sm:py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer",
                        isSelected
                          ? "bg-[#edf1ec] border-l-4 border-l-[#204b39]"
                          : "hover:bg-[#f7f6f2]"
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0 mt-0.5">
                        {participant?.avatarUrl ? (
                          <img
                            src={participant.avatarUrl}
                            alt={participant.name || 'Student'}
                            className="h-9 w-9 rounded-full object-cover border border-[#dedcd4]"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#204b39] text-white text-xs font-bold">
                            {(participant?.name || 'S').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#204b39] px-1 text-[10px] font-bold text-white shadow-xs">
                            {unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Text info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-[#252b27] truncate">
                            {participant?.name || 'Campus Student'}
                          </span>
                          <span className="text-[10px] text-[#717870] shrink-0 font-medium">
                            {formatRelativeTime(preview?.createdAt || c.updatedAt || c.createdAt)}
                          </span>
                        </div>

                        {/* Subtitle context tag */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center text-[10px] font-semibold text-[#204b39] bg-[#edf1ec] px-1.5 py-0.2 rounded border border-[#dedcd4]">
                            {isRequestChat ? 'Request' : 'Item'}
                          </span>
                        </div>

                        {/* Last message preview */}
                        <p className={cn(
                          "text-xs truncate leading-snug",
                          unreadCount > 0 ? "font-bold text-[#252b27]" : "text-[#555d56]"
                        )}>
                          {preview?.text || 'Start conversation...'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ========================================================= */}
          {/* RIGHT PANEL: Active Conversation or Empty View             */}
          {/* ========================================================= */}
          <section 
            className={cn(
              "flex-1 flex flex-col bg-white min-w-0 h-full",
              !chatId ? "hidden md:flex" : "flex"
            )}
            aria-label="Active conversation"
          >
            {!chatId ? (
              /* Desktop Empty Selection State */
              <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#faf9f5]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] mb-4 shadow-2xs">
                  <MessageSquare className="h-8 w-8" />
                </div>
                <h2 className="text-lg font-bold text-[#252b27]">Select a conversation</h2>
                <p className="text-sm text-[#555d56] mt-1.5 max-w-sm">
                  Choose a thread from the messages list to view details and coordinate your campus pickup.
                </p>
              </div>
            ) : loading ? (
              /* Conversation Loading State */
              <div className="flex h-full flex-col items-center justify-center p-8 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#204b39]" />
                <p className="text-xs font-semibold text-[#555d56]">Loading conversation...</p>
              </div>
            ) : authError ? (
              /* Access Denied */
              <div className="flex h-full flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-3 border border-red-200">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-[#252b27] mb-1">Access Denied</h2>
                <p className="text-xs text-[#555d56] mb-5">{authError}</p>
                <button
                  type="button"
                  onClick={() => navigate('/chat')}
                  className="rounded-xl bg-[#204b39] px-4 py-2 text-xs font-semibold text-white hover:bg-[#183a2c]"
                >
                  Back to Messages
                </button>
              </div>
            ) : generalError && !chat ? (
              /* General Load Error */
              <div className="flex h-full flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-3 border border-amber-200">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-[#252b27] mb-1">Unable to Load Conversation</h2>
                <p className="text-xs text-[#555d56] mb-5">{generalError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-xl border border-[#dedcd4] bg-white px-4 py-2 text-xs font-semibold text-[#252b27] hover:bg-[#f7f6f2]"
                >
                  Retry
                </button>
              </div>
            ) : (
              /* Active Chat UI */
              <>
                {/* 1. Header */}
                <div className="flex items-center justify-between border-b border-[#dedcd4] bg-white px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-3">
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => navigate('/chat')}
                      className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#555d56] hover:bg-[#edf1ec] hover:text-[#252b27] transition-colors"
                      aria-label="Back to conversations"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="flex items-center gap-2.5">
                      {otherUser?.avatarUrl ? (
                        <img
                          src={otherUser.avatarUrl}
                          alt={otherUser.name || 'Student'}
                          className="h-10 w-10 rounded-full object-cover border border-[#dedcd4]"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#204b39] text-xs font-bold text-white">
                          {(otherUser?.name || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm sm:text-base font-bold text-[#252b27]">
                            {otherUser?.name || 'Campus Student'}
                          </h2>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1ec] px-2 py-0.5 text-[10px] font-bold text-[#204b39] border border-[#dedcd4]">
                            <ShieldCheck className="h-3 w-3 text-[#204b39]" />
                            Verified
                          </span>
                        </div>
                        <p className="text-xs text-[#717870]">
                          {otherUser?.department ? `${otherUser.department} · ` : ''}Anna University
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Item / Request Preview Pill */}
                  {listing && (
                    <Link
                      to={`/listing/${listing.id}`}
                      className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-[#dedcd4] bg-[#edf1ec] px-3 py-1.5 text-xs font-semibold text-[#204b39] hover:bg-emerald-100 transition-colors shadow-2xs"
                    >
                      <Package className="h-3.5 w-3.5 text-[#204b39] shrink-0" />
                      <span className="max-w-[160px] truncate">{listing.title}</span>
                      {listing.price !== undefined && (
                        <span className="font-bold text-[#252b27]">₹{listing.price}</span>
                      )}
                      <ExternalLink className="h-3 w-3 text-[#717870] shrink-0" />
                    </Link>
                  )}

                  {itemRequest && (
                    <Link
                      to="/requests"
                      className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-[#dedcd4] bg-[#edf1ec] px-3 py-1.5 text-xs font-semibold text-[#204b39] hover:bg-emerald-100 transition-colors shadow-2xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[#204b39] shrink-0" />
                      <span className="max-w-[160px] truncate">Request: {itemRequest.title}</span>
                      <ExternalLink className="h-3 w-3 text-[#717870] shrink-0" />
                    </Link>
                  )}
                </div>

                {/* 2. Request Context Bar (strictly required for requests chat) */}
                {itemRequest && (
                  <div className="border-b border-[#dedcd4] bg-[#edf1ec]/60 px-4 py-2.5 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#204b39] border border-[#dedcd4]">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#252b27] max-w-[200px] truncate">
                              {itemRequest.title}
                            </span>
                            {itemRequest.budget !== undefined && itemRequest.budget > 0 && (
                              <span className="inline-flex items-center text-xs font-bold text-[#204b39] bg-white border border-[#dedcd4] px-1.5 py-0.2 rounded">
                                <IndianRupee className="h-3 w-3 mr-0.5" />
                                Budget: ₹{itemRequest.budget}
                              </span>
                            )}
                            {itemRequest.status === 'expired' || (itemRequest.expiresAt && new Date(itemRequest.expiresAt).getTime() <= Date.now()) ? (
                              <span className="text-[10px] font-semibold rounded-full bg-amber-50 border border-amber-300 px-2 py-0.2 text-amber-800">
                                Expired
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold rounded-full bg-white border border-[#dedcd4] px-2 py-0.2 text-[#252b27]">
                                {itemRequest.status.charAt(0).toUpperCase() + itemRequest.status.slice(1)}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#717870] mt-0.5 font-medium">
                            {itemRequest.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-[#204b39]" />
                                {itemRequest.location}
                              </span>
                            )}
                            {itemRequest.neededBy && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-[#717870]" />
                                Needed by: {itemRequest.neededBy}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="self-end sm:self-auto shrink-0">
                        <Link to="/requests">
                          <button
                            type="button"
                            className="rounded-lg border border-[#dedcd4] bg-white px-2.5 py-1 text-xs font-semibold text-[#252b27] hover:bg-[#f7f6f2] transition-colors"
                          >
                            Back to Requests
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Reservation Status & Action Bar (for listing chats) */}
                {listing && (
                  <div className="border-b border-[#dedcd4] bg-[#edf1ec]/40 px-4 py-2.5 sm:px-6">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left Side: Listing Info & Status Badge */}
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#204b39] border border-[#dedcd4]">
                          <Tag className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#252b27] truncate max-w-[180px] sm:max-w-[240px]">
                              {listing.title}
                            </span>
                            {listing.price !== undefined && (
                              <span className="text-xs font-bold text-[#204b39] bg-white px-1.5 py-0.2 rounded border border-[#dedcd4]">
                                ₹{listing.price}
                              </span>
                            )}

                            {/* Status Badge */}
                            {listing.status === 'cancelled' ? (
                              <span className="rounded-full bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.2">
                                Cancelled
                              </span>
                            ) : reservation?.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.2">
                                <Clock className="h-3 w-3 text-amber-600" />
                                Pending Confirmation
                              </span>
                            ) : reservation?.status === 'accepted' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1ec] text-[#204b39] border border-[#dedcd4] text-[10px] font-bold px-2 py-0.2">
                                <Check className="h-3 w-3 text-[#204b39]" />
                                Reserved
                              </span>
                            ) : reservation?.status === 'rejected' ? (
                              <span className="rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold px-2 py-0.2">
                                Declined
                              </span>
                            ) : reservation?.status === 'cancelled' ? (
                              <span className="rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2 py-0.2">
                                Cancelled
                              </span>
                            ) : (
                              <span className="rounded-full bg-white border border-[#dedcd4] text-zinc-600 text-[10px] font-medium px-2 py-0.2">
                                Available
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-[#555d56] mt-0.5">
                            {listing.status === 'cancelled' && 'This listing has been cancelled by the seller.'}
                            {listing.status !== 'cancelled' && reservation?.status === 'pending' && isBuyer && 'Your reservation request is pending seller confirmation.'}
                            {listing.status !== 'cancelled' && reservation?.status === 'pending' && isSeller && `Incoming reservation request from ${otherUser?.name || 'student'}. Accept to coordinate pickup.`}
                            {listing.status !== 'cancelled' && reservation?.status === 'accepted' && 'Item is reserved. Coordinate campus meetup point below.'}
                            {listing.status !== 'cancelled' && reservation?.status === 'rejected' && 'The reservation request for this listing was declined.'}
                            {listing.status !== 'cancelled' && reservation?.status === 'cancelled' && 'This reservation was cancelled.'}
                            {listing.status !== 'cancelled' && !reservation && isBuyer && 'Interested in this item? Request to reserve it from the seller.'}
                            {listing.status !== 'cancelled' && !reservation && isSeller && 'Waiting for student reservation request.'}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Action Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {isBuyer && listing.status !== 'cancelled' && (!reservation || reservation.status === 'rejected' || reservation.status === 'cancelled') && (
                          <button
                            type="button"
                            onClick={handleRequestReservation}
                            disabled={isActionLoading === 'reserving'}
                            className="inline-flex items-center gap-1.5 text-xs h-8 px-3.5 font-semibold bg-[#204b39] hover:bg-[#183a2c] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
                          </button>
                        )}

                        {isBuyer && reservation?.status === 'pending' && (
                          <button
                            type="button"
                            onClick={handleCancelReservation}
                            disabled={isActionLoading !== null}
                            className="inline-flex items-center gap-1 text-xs h-8 px-3 font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isActionLoading === 'cancelling' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                            Cancel Request
                          </button>
                        )}

                        {isSeller && reservation?.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateReservationStatus('accepted')}
                              disabled={isActionLoading !== null}
                              className="inline-flex items-center gap-1 text-xs h-8 px-3.5 font-semibold bg-[#204b39] hover:bg-[#183a2c] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isActionLoading === 'accepting' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateReservationStatus('rejected')}
                              disabled={isActionLoading !== null}
                              className="inline-flex items-center gap-1 text-xs h-8 px-3 font-semibold border border-[#dedcd4] bg-white text-[#555d56] hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isActionLoading === 'rejecting' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                              Reject
                            </button>
                          </div>
                        )}

                        {reservation?.status === 'accepted' && (currentUserId === reservation.buyerId || currentUserId === reservation.sellerId) && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCompleteExchange}
                              disabled={isActionLoading !== null}
                              className="inline-flex items-center gap-1.5 text-xs h-8 px-3.5 font-semibold bg-[#204b39] hover:bg-[#183a2c] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isActionLoading === 'completing' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Complete Exchange
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelReservation}
                              disabled={isActionLoading !== null}
                              className="inline-flex items-center gap-1 text-xs h-8 px-2.5 font-medium border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reservation notifications */}
                    {reservationError && (
                      <div className="mt-2.5 flex items-center justify-between rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                          <span>{reservationError}</span>
                        </div>
                        <button type="button" onClick={() => setReservationError(null)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {reservationSuccess && (
                      <div className="mt-2.5 flex items-center justify-between rounded-xl bg-[#edf1ec] p-2.5 text-xs text-[#204b39] border border-[#dedcd4]">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-[#204b39]" />
                          <span>{reservationSuccess}</span>
                        </div>
                        <button type="button" onClick={() => setReservationSuccess(null)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Campus Meetup Section - Only for Accepted */}
                    {reservation?.status === 'accepted' && (
                      <div className="mt-3 pt-3 border-t border-[#dedcd4]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-[#204b39]" />
                            <span className="text-xs font-bold text-[#252b27] uppercase tracking-wider">
                              Campus Meetup Point
                            </span>
                          </div>
                          {reservation.meetup?.status === 'confirmed' ? (
                            <span className="text-[10px] font-bold text-[#204b39] bg-white border border-[#dedcd4] px-2 py-0.2 rounded-full">
                              Agreed: {reservation.meetup.location}
                            </span>
                          ) : reservation.meetup?.status === 'proposed' ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-full">
                              Proposal Pending
                            </span>
                          ) : null}
                        </div>

                        {(!reservation.meetup || reservation.meetup.status === 'not_set' || reservation.meetup.status === 'cancelled') && (
                          <div className="rounded-xl border border-[#dedcd4] bg-white p-3 space-y-2">
                            <p className="text-xs text-[#555d56]">
                              Select a safe campus meetup landmark for item handover:
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {CAMPUS_MEETUP_LOCATIONS.map((loc) => {
                                const isSelected = selectedMeetupLocation === loc;
                                return (
                                  <button
                                    key={loc}
                                    type="button"
                                    onClick={() => setSelectedMeetupLocation(loc)}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer",
                                      isSelected
                                        ? "bg-[#204b39] text-white border-[#204b39]"
                                        : "bg-[#f7f6f2] text-[#252b27] border-[#dedcd4] hover:bg-zinc-100"
                                    )}
                                  >
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{loc}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-end pt-1">
                              <button
                                type="button"
                                disabled={!selectedMeetupLocation || isMeetupLoading !== null}
                                onClick={() => handleProposeMeetup()}
                                className="text-xs h-7 px-3 bg-[#204b39] text-white rounded-lg font-semibold hover:bg-[#183a2c] disabled:opacity-50 cursor-pointer"
                              >
                                {isMeetupLoading === 'proposing' ? 'Proposing...' : 'Propose Spot'}
                              </button>
                            </div>
                          </div>
                        )}

                        {reservation.meetup?.status === 'proposed' && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="text-xs text-amber-950">
                              {reservation.meetup.proposedBy === currentUserId ? (
                                <>You proposed meeting at <strong>{reservation.meetup.location}</strong>. Waiting for other student.</>
                              ) : (
                                <>Proposed meetup at <strong>{reservation.meetup.location}</strong>.</>
                              )}
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {reservation.meetup.proposedBy !== currentUserId ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleCancelMeetup}
                                    className="text-xs px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-700"
                                  >
                                    Suggest Other
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleConfirmMeetup}
                                    className="text-xs px-3 py-1 rounded-lg bg-[#204b39] text-white font-semibold"
                                  >
                                    Confirm
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleCancelMeetup}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-amber-900"
                                >
                                  Cancel Proposal
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {reservation.meetup?.status === 'confirmed' && (
                          <div className="rounded-xl border border-[#dedcd4] bg-[#edf1ec] p-3 flex items-center justify-between gap-2">
                            <p className="text-xs text-[#204b39] font-medium">
                              Meet at <strong>{reservation.meetup.location}</strong>. Inspect item before completing handover.
                            </p>
                            <button
                              type="button"
                              onClick={handleCancelMeetup}
                              className="text-xs px-2.5 py-1 rounded-lg border border-[#dedcd4] bg-white text-[#252b27] shrink-0"
                            >
                              Change Spot
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Safety Notice Banner */}
                <div className="border-b border-[#dedcd4] bg-[#edf1ec]/40 px-4 py-2 sm:px-6">
                  <div className="flex items-center gap-2 text-[11px] text-[#555d56] leading-tight">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#204b39]" />
                    <p>
                      <strong>Safety Reminder:</strong> StudentNeed only connects students. Always inspect items in person at a verified public campus spot before concluding any exchange.
                    </p>
                  </div>
                </div>

                {/* 5. Messages Feed */}
                <div 
                  ref={messageListRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-[#faf9f5]"
                >
                  {messages.length === 0 ? (
                    /* Empty Messages State */
                    <div className="flex h-full flex-col items-center justify-center text-center p-4 sm:p-6 space-y-2.5 my-auto max-w-sm mx-auto">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#dedcd4] text-[#204b39] shadow-2xs">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-[#252b27]">No messages yet</h3>
                        <p className="text-xs text-[#555d56] leading-normal">
                          Start the conversation with {otherUser?.name || 'this student'} about campus pickup or item details.
                        </p>
                      </div>

                      {/* Quick Starters */}
                      <div className="pt-1 flex flex-col items-center gap-1.5 w-full">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#717870]">Quick Starters</span>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {quickStarters.map((starter, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setInputText(starter)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#dedcd4] bg-white hover:bg-[#edf1ec] hover:border-[#204b39]/30 text-[#252b27] transition-colors shadow-2xs cursor-pointer"
                            >
                              {starter}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Message Bubbles */
                    messages.map((msg, idx) => {
                      const isCurrentUser = msg.senderId === currentUserId;
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      const showDate = !prevMsg || formatDateHeader(msg.createdAt) !== formatDateHeader(prevMsg.createdAt);

                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && (
                            <div className="flex justify-center my-3">
                              <span className="rounded-full bg-[#dedcd4]/60 px-3 py-0.5 text-[10px] font-medium text-[#555d56]">
                                {formatDateHeader(msg.createdAt)}
                              </span>
                            </div>
                          )}
                          <div
                            className={cn(
                              'flex flex-col',
                              isCurrentUser ? 'items-end' : 'items-start'
                            )}
                          >
                            <div
                              className={cn(
                                'rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-sm max-w-[85%] sm:max-w-[70%] break-words [overflow-wrap:anywhere] shadow-2xs',
                                isCurrentUser
                                  ? 'bg-[#204b39] text-white rounded-tr-xs'
                                  : 'bg-white text-[#252b27] border border-[#dedcd4] rounded-tl-xs'
                              )}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            </div>
                            <span className="mt-1 px-1 text-[10px] text-[#717870]">
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send Error Notice */}
                {sendError && (
                  <div className="flex items-center justify-between border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      <span>{sendError}</span>
                    </div>
                    <button type="button" onClick={() => setSendError(null)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* 6. Message Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-[#dedcd4] bg-white p-2.5 sm:p-3.5 flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Type your message to coordinate pickup..."
                      disabled={isSending}
                      maxLength={2000}
                      className="w-full bg-[#f7f6f2] border border-[#dedcd4] focus:bg-white focus:border-[#204b39] text-sm text-[#252b27] placeholder:text-[#8a918a] h-10 sm:h-11 rounded-xl px-3.5 sm:px-4 pr-14 outline-none transition-colors"
                      autoFocus
                    />
                    {inputText.length > 1800 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#717870] font-mono">
                        {inputText.length}/2000
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    aria-label="Send message"
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 shrink-0 px-4 sm:px-5 h-10 sm:h-11 rounded-xl font-semibold text-sm transition-all duration-150",
                      inputText.trim() && !isSending
                        ? "bg-[#204b39] hover:bg-[#183a2c] text-white shadow-xs cursor-pointer active:scale-[0.98]"
                        : isSending
                        ? "bg-[#204b39]/80 text-white cursor-wait opacity-90"
                        : "bg-[#dedcd4] text-[#717870] cursor-not-allowed shadow-none"
                    )}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Send className={cn("h-4 w-4", inputText.trim() ? "text-white" : "text-[#717870]")} />
                    )}
                    <span className="hidden sm:inline">{isSending ? 'Sending' : 'Send'}</span>
                  </button>
                </form>
              </>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
