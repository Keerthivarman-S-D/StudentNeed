import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Listing, ItemRequest, RequestStatus, UpdateListingInput } from '../types';
import { mockUsers } from '../data';

export type NewListingInput = {
  title: string;
  description: string;
  price?: number;
  type: Listing['type'];
  condition: Listing['condition'];
  category: Listing['category'];
  location: string;
  sellerId?: string;
  images?: string[];
  status?: Listing['status'];
  expirationDays?: number;
  expiresAt?: any;
};

export type NewRequestInput = {
  title: string;
  description: string;
  category: ItemRequest['category'];
  neededBy: string;
  location: string;
  budget?: number;
  status?: RequestStatus;
  requesterId?: string;
};

type AppContextType = {
  listings: Listing[];
  listingsLoading: boolean;
  listingsError: string | null;
  addListing: (listing: NewListingInput | Listing) => Promise<string>;
  updateListing: (listingId: string, updates: UpdateListingInput) => Promise<void>;
  cancelListing: (listingId: string) => Promise<void>;
  requests: ItemRequest[];
  requestsLoading: boolean;
  requestsError: string | null;
  addRequest: (request: NewRequestInput | ItemRequest) => Promise<string>;
  cancelRequest: (requestId: string) => Promise<void>;
  updateRequestStatus: (requestId: string, status: RequestStatus) => Promise<void>;
  savedListings: string[];
  toggleSaveListing: (id: string) => void;
  users: User[];
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState<boolean>(true);
  const [listingsError, setListingsError] = useState<string | null>(null);

  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [savedListings, setSavedListings] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sn_saved_listings');
      return saved ? JSON.parse(saved) : ['l2', 'l4'];
    } catch {
      return ['l2', 'l4'];
    }
  });
  const [users, setUsers] = useState<User[]>(mockUsers);

  // Sync saved listings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sn_saved_listings', JSON.stringify(savedListings));
    } catch {
      // Ignore storage errors
    }
  }, [savedListings]);

  // Listen to Firestore listings, requests & users
  useEffect(() => {
    let unsubscribeListings: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;
    let unsubscribeUsers: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up any previous subscriptions
      if (unsubscribeListings) {
        unsubscribeListings();
        unsubscribeListings = null;
      }
      if (unsubscribeRequests) {
        unsubscribeRequests();
        unsubscribeRequests = null;
      }
      if (unsubscribeUsers) {
        unsubscribeUsers();
        unsubscribeUsers = null;
      }

      setListingsLoading(true);
      setListingsError(null);
      setRequestsLoading(true);
      setRequestsError(null);

      if (user) {
        // Authenticated student: subscribe to real-time Firestore listings
        try {
          const listingsQuery = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
          unsubscribeListings = onSnapshot(
            listingsQuery,
            (snapshot) => {
              const liveListings: Listing[] = snapshot.docs.map((docSnap) => {
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

                // Compute or fallback expiresAt
                const rawExpires = data.expiresAt;
                let expiresAt = '';
                if (rawExpires?.toDate) {
                  expiresAt = rawExpires.toDate().toISOString();
                } else if (typeof rawExpires === 'string') {
                  expiresAt = rawExpires;
                } else if (data.createdAt) {
                  const cDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                  expiresAt = new Date(cDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
                } else {
                  expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                }

                return {
                  id: docSnap.id,
                  title: data.title || '',
                  description: data.description || '',
                  price: data.price !== undefined ? Number(data.price) : undefined,
                  type: data.type || 'Sale',
                  condition: data.condition || 'Good',
                  category: data.category || 'Other',
                  location: data.location || '',
                  sellerId: data.sellerId || '',
                  images: Array.isArray(data.images) && data.images.length > 0
                    ? data.images
                    : ['https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800'],
                  status: data.status || 'available',
                  expirationDays: data.expirationDays ? Number(data.expirationDays) : 15,
                  expiresAt,
                  createdAt,
                  updatedAt,
                };
              });

              setListings(liveListings);
              setListingsLoading(false);
              setListingsError(null);
            },
            (err) => {
              console.error('Error listening to listings:', err);
              setListingsLoading(false);
              setListingsError(err.message || 'Failed to load live marketplace listings.');
              try {
                handleFirestoreError(err, OperationType.LIST, 'listings');
              } catch {
                // error logged
              }
            }
          );
        } catch (err: any) {
          console.error('Failed to initialize listings query:', err);
          setListingsLoading(false);
          setListingsError(err.message || 'Failed to initialize listings.');
        }

        // Authenticated student: subscribe to real-time Firestore requests
        try {
          const requestsQuery = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
          unsubscribeRequests = onSnapshot(
            requestsQuery,
            (snapshot) => {
              const liveRequests: ItemRequest[] = snapshot.docs.map((docSnap) => {
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

                return {
                  id: docSnap.id,
                  title: data.title || '',
                  description: data.description || '',
                  category: data.category || 'Other',
                  neededBy: data.neededBy || '',
                  location: data.location || '',
                  budget: data.budget !== undefined ? Number(data.budget) : undefined,
                  status: data.status || 'open',
                  requesterId: data.requesterId || '',
                  createdAt,
                  updatedAt,
                };
              });

              setRequests(liveRequests);
              setRequestsLoading(false);
              setRequestsError(null);
            },
            (err) => {
              console.error('Error listening to requests:', err);
              setRequestsLoading(false);
              setRequestsError(err.message || 'Failed to load live student requests.');
              try {
                handleFirestoreError(err, OperationType.LIST, 'requests');
              } catch {
                // error logged
              }
            }
          );
        } catch (err: any) {
          console.error('Failed to initialize requests query:', err);
          setRequestsLoading(false);
          setRequestsError(err.message || 'Failed to initialize requests.');
        }

        // Also listen to users collection so seller & requester details are available
        try {
          unsubscribeUsers = onSnapshot(
            collection(db, 'users'),
            (snapshot) => {
              const liveUsers: User[] = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                const createdAt = data.createdAt?.toDate
                  ? data.createdAt.toDate().toISOString()
                  : typeof data.createdAt === 'string'
                  ? data.createdAt
                  : new Date().toISOString();

                return {
                  id: docSnap.id,
                  name: data.name || 'Student',
                  email: data.email || '',
                  department: data.department || 'Anna Univ',
                  campus: data.campus || 'Main Campus',
                  rating: typeof data.rating === 'number' ? data.rating : 5.0,
                  avatarUrl: data.avatarUrl,
                  exchangesCompleted: data.exchangesCompleted || 0,
                  role: data.role || 'student',
                  isVerified: Boolean(data.isVerified),
                  createdAt,
                };
              });

              // Merge live users with mock users as fallback for unmigrated demo data
              const userMap = new Map<string, User>();
              mockUsers.forEach((u) => userMap.set(u.id, u));
              liveUsers.forEach((u) => userMap.set(u.id, u));
              setUsers(Array.from(userMap.values()));
            },
            (err) => {
              console.warn('Could not sync all users collection:', err);
            }
          );
        } catch (err) {
          console.warn('User listener error:', err);
        }
      } else {
        // Not authenticated yet
        setListings([]);
        setListingsLoading(false);
        setListingsError(null);
        setRequests([]);
        setRequestsLoading(false);
        setRequestsError(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeListings) unsubscribeListings();
      if (unsubscribeRequests) unsubscribeRequests();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, []);

  const addListing = async (listingInput: NewListingInput | Listing): Promise<string> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to publish a listing.');
    }

    const sellerId = auth.currentUser.uid;
    const docRef = doc(collection(db, 'listings'));

    const isBorrowOrExchange = listingInput.type === 'Borrow' || listingInput.type === 'Exchange';

    const validDays = [7, 15, 30];
    const durationDays = validDays.includes(Number(listingInput.expirationDays))
      ? Number(listingInput.expirationDays)
      : 15;
    const expiresAtDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const expiresAtTimestamp = Timestamp.fromDate(expiresAtDate);

    const rawImages = Array.isArray(listingInput.images) ? listingInput.images : [];
    const sanitizedImages = rawImages
      .filter((img): img is string => typeof img === 'string' && img.trim().length > 0 && img.startsWith('https://'))
      .slice(0, 5);

    const newListingData: Record<string, any> = {
      title: listingInput.title.trim(),
      description: listingInput.description.trim(),
      type: listingInput.type,
      condition: listingInput.condition,
      category: listingInput.category,
      location: listingInput.location.trim(),
      sellerId: sellerId, // strictly enforced from authenticated user
      images: isBorrowOrExchange
        ? []
        : (sanitizedImages.length > 0
            ? sanitizedImages
            : ['https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800']),
      status: listingInput.status || 'available',
      expirationDays: durationDays,
      expiresAt: expiresAtTimestamp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (listingInput.price !== undefined && listingInput.price !== null && !isNaN(Number(listingInput.price))) {
      newListingData.price = Number(listingInput.price);
    }

    try {
      await setDoc(docRef, newListingData);
      return docRef.id;
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, `listings/${docRef.id}`);
    }
  };

  const updateListing = async (listingId: string, updates: UpdateListingInput): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to edit a listing.');
    }

    const currentUid = auth.currentUser.uid;
    const docRef = doc(db, 'listings', listingId);

    const currentListing = listings.find(l => l.id === listingId);
    if (currentListing && currentListing.sellerId !== currentUid) {
      throw new Error('Unauthorized: only the owner can edit this listing.');
    }
    if (currentListing?.status === 'completed') {
      throw new Error('This listing has already been completed and cannot be edited.');
    }
    if (currentListing?.status === 'cancelled') {
      throw new Error('This listing has been cancelled and cannot be edited.');
    }

    // Build partial update payload with ONLY legitimate editable fields.
    // Explicitly omit sellerId, createdAt, expiresAt, expirationDays, and status
    // to strictly preserve security immutability rules and expiration protection.
    const updatePayload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.title !== undefined) {
      const trimmed = updates.title.trim();
      if (!trimmed) throw new Error('Listing title cannot be empty.');
      updatePayload.title = trimmed;
    }

    if (updates.description !== undefined) {
      const trimmed = updates.description.trim();
      if (!trimmed) throw new Error('Listing description cannot be empty.');
      updatePayload.description = trimmed;
    }

    if (updates.category !== undefined) {
      updatePayload.category = updates.category;
    }

    if (updates.condition !== undefined) {
      updatePayload.condition = updates.condition;
    }

    if (updates.location !== undefined) {
      const trimmed = updates.location.trim();
      if (!trimmed) throw new Error('Campus/pickup location cannot be empty.');
      updatePayload.location = trimmed;
    }

    if (updates.price !== undefined) {
      if (updates.price === null || isNaN(Number(updates.price))) {
        // Leave undefined or keep price
      } else {
        updatePayload.price = Math.max(0, Number(updates.price));
      }
    }

    if (Array.isArray(updates.images) && updates.images.length > 0) {
      updatePayload.images = updates.images;
    }

    try {
      await updateDoc(docRef, updatePayload);
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `listings/${listingId}`);
    }
  };

  const cancelListing = async (listingId: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to cancel a listing.');
    }

    const currentUid = auth.currentUser.uid;
    const docRef = doc(db, 'listings', listingId);

    const currentListing = listings.find(l => l.id === listingId);
    if (currentListing && currentListing.sellerId !== currentUid) {
      throw new Error('Unauthorized: only the owner can cancel this listing.');
    }
    if (currentListing?.status === 'cancelled') {
      return;
    }
    if (currentListing?.status === 'completed') {
      throw new Error('This listing has already been completed and cannot be cancelled.');
    }

    try {
      await updateDoc(docRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `listings/${listingId}`);
    }
  };

  const addRequest = async (requestInput: NewRequestInput | ItemRequest): Promise<string> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to post a request.');
    }

    const requesterId = auth.currentUser.uid;
    const docRef = doc(collection(db, 'requests'));

    const newRequestData: Record<string, any> = {
      title: requestInput.title.trim(),
      description: requestInput.description.trim(),
      category: requestInput.category,
      neededBy: requestInput.neededBy.trim(),
      location: requestInput.location.trim(),
      requesterId: requesterId, // strictly enforced from authenticated user
      status: requestInput.status || 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (requestInput.budget !== undefined && requestInput.budget !== null && !isNaN(Number(requestInput.budget))) {
      newRequestData.budget = Number(requestInput.budget);
    }

    try {
      await setDoc(docRef, newRequestData);
      return docRef.id;
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, `requests/${docRef.id}`);
    }
  };

  const cancelRequest = async (requestId: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to cancel a request.');
    }

    const currentUid = auth.currentUser.uid;
    const docRef = doc(db, 'requests', requestId);

    const currentReq = requests.find(r => r.id === requestId);
    if (currentReq && currentReq.requesterId !== currentUid) {
      throw new Error('Unauthorized: only the requester can cancel this request.');
    }
    if (currentReq?.status === 'cancelled') {
      return;
    }

    try {
      await updateDoc(docRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `requests/${requestId}`);
    }
  };

  const updateRequestStatus = async (requestId: string, status: RequestStatus): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to update a request.');
    }

    const docRef = doc(db, 'requests', requestId);
    try {
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `requests/${requestId}`);
    }
  };

  const toggleSaveListing = (id: string) => {
    setSavedListings((prev) =>
      prev.includes(id) ? prev.filter((listingId) => listingId !== id) : [...prev, id]
    );
  };

  return (
    <AppContext.Provider
      value={{
        listings,
        listingsLoading,
        listingsError,
        addListing,
        updateListing,
        cancelListing,
        requests,
        requestsLoading,
        requestsError,
        addRequest,
        cancelRequest,
        updateRequestStatus,
        savedListings,
        toggleSaveListing,
        users,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

