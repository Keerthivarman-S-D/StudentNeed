import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Listing, ItemRequest, RequestStatus, UpdateListingInput, isValidApprovedLocation } from '../types';
import { mockUsers } from '../data';
import { REQUEST_ENDPOINTS } from '../config/api';

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
  wantedItem?: string;
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
  expiresAt?: any;
  deleteAt?: any;
};

type AppContextType = {
  listings: Listing[];
  listingsLoading: boolean;
  listingsError: string | null;
  hasMoreListings: boolean;
  loadMoreListings: () => void;
  addListing: (listing: NewListingInput | Listing) => Promise<string>;
  updateListing: (listingId: string, updates: UpdateListingInput) => Promise<void>;
  cancelListing: (listingId: string) => Promise<void>;
  requests: ItemRequest[];
  requestsLoading: boolean;
  requestsError: string | null;
  hasMoreRequests: boolean;
  loadMoreRequests: () => void;
  addRequest: (request: NewRequestInput | ItemRequest) => Promise<string>;
  renewRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  updateRequestStatus: (requestId: string, status: RequestStatus) => Promise<void>;
  savedListings: string[];
  toggleSaveListing: (id: string) => void;
  users: User[];
  fetchUserProfile: (userId: string) => Promise<User | null>;
};

function parseListingSnapshot(docSnap: any): Listing {
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
    condition: data.type === 'Borrow' ? undefined : (data.condition || undefined),
    category: data.category || 'Other',
    location: data.location || '',
    sellerId: data.sellerId || '',
    images: Array.isArray(data.images)
      ? data.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
      : [],
    status: data.status || 'available',
    expirationDays: data.expirationDays ? Number(data.expirationDays) : 15,
    expiresAt,
    wantedItem: data.wantedItem || undefined,
    createdAt,
    updatedAt,
  };
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState<boolean>(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState<boolean>(true);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [isLoadingMoreListings, setIsLoadingMoreListings] = useState<boolean>(false);
  const LISTINGS_PAGE_SIZE = 10;

  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsLimit, setRequestsLimit] = useState<number>(20);
  const [hasMoreRequests, setHasMoreRequests] = useState<boolean>(true);

  const [savedListings, setSavedListings] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sn_saved_listings');
      return saved ? JSON.parse(saved) : ['l2', 'l4'];
    } catch {
      return ['l2', 'l4'];
    }
  });

  const [userCache, setUserCache] = useState<Map<string, User>>(() => {
    const initialMap = new Map<string, User>();
    mockUsers.forEach((u) => initialMap.set(u.id, u));
    return initialMap;
  });

  const [authUser, setAuthUser] = useState<any>(auth.currentUser);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Sync saved listings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sn_saved_listings', JSON.stringify(savedListings));
    } catch {
      // Ignore storage errors
    }
  }, [savedListings]);

  const loadMoreListings = async () => {
    if (!lastListingDoc || isLoadingMoreListings || !hasMoreListings) return;
    setIsLoadingMoreListings(true);
    try {
      const nextQuery = query(
        collection(db, 'listings'),
        orderBy('createdAt', 'desc'),
        startAfter(lastListingDoc),
        limit(LISTINGS_PAGE_SIZE)
      );

      const snapshot = await getDocs(nextQuery);
      const docs = snapshot.docs;
      const nextListings = docs.map(parseListingSnapshot);

      setListings((prev) => [...prev, ...nextListings]);
      setLastListingDoc(docs.length > 0 ? docs[docs.length - 1] : null);
      setHasMoreListings(docs.length >= LISTINGS_PAGE_SIZE);
      setIsLoadingMoreListings(false);

      const sellerIds = Array.from(new Set(nextListings.map((l) => l.sellerId).filter(Boolean)));
      prefetchUsers(sellerIds);
    } catch (err: any) {
      console.error('Error loading more listings:', err);
      setIsLoadingMoreListings(false);
    }
  };

  const loadMoreRequests = () => {
    setRequestsLimit((prev) => prev + 20);
  };

  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    if (!userId) return null;
    if (userCache.has(userId)) {
      return userCache.get(userId)!;
    }
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString();

        const fetchedUser: User = {
          id: userDoc.id,
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

        setUserCache((prev) => {
          const next = new Map(prev);
          next.set(userId, fetchedUser);
          return next;
        });
        return fetchedUser;
      }
      return null;
    } catch (err) {
      console.warn(`[Profile Cache] Could not fetch user ${userId}:`, err);
      return null;
    }
  };

  const prefetchUsers = (userIds: string[]) => {
    const missing = userIds.filter((id) => id && !userCache.has(id));
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async (id) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', id));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const createdAt = data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : typeof data.createdAt === 'string'
              ? data.createdAt
              : new Date().toISOString();

            return {
              id: userDoc.id,
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
            } as User;
          }
        } catch {
          // ignore individual fetch errors
        }
        return null;
      })
    ).then((fetchedUsers) => {
      const valid = fetchedUsers.filter((u): u is User => u !== null);
      if (valid.length > 0) {
        setUserCache((prev) => {
          const next = new Map(prev);
          valid.forEach((u) => next.set(u.id, u));
          return next;
        });
      }
    });
  };

  // Fetch initial listings with pagination cursor (no unnecessary real-time listener)
  useEffect(() => {
    if (!authUser) {
      setListings([]);
      setListingsLoading(false);
      setListingsError(null);
      setHasMoreListings(false);
      setLastListingDoc(null);
      return;
    }

    let isMounted = true;
    setListingsLoading(true);
    setListingsError(null);

    const fetchInitialListings = async () => {
      try {
        const listingsQuery = query(
          collection(db, 'listings'),
          orderBy('createdAt', 'desc'),
          limit(LISTINGS_PAGE_SIZE)
        );

        const snapshot = await getDocs(listingsQuery);
        if (!isMounted) return;

        const docs = snapshot.docs;
        const liveListings = docs.map(parseListingSnapshot);

        setListings(liveListings);
        setLastListingDoc(docs.length > 0 ? docs[docs.length - 1] : null);
        setHasMoreListings(docs.length >= LISTINGS_PAGE_SIZE);
        setListingsLoading(false);
        setListingsError(null);

        // Prefetch seller profiles on demand
        const sellerIds = Array.from(new Set(liveListings.map((l) => l.sellerId).filter(Boolean)));
        prefetchUsers(sellerIds);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error listening to listings:', err);
        setListingsLoading(false);
        setListingsError('Unable to load campus listings right now. Please refresh.');
        try {
          handleFirestoreError(err, OperationType.LIST, 'listings');
        } catch {
          // error logged
        }
      }
    };

    fetchInitialListings();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  // Subscribe to real-time requests with limit
  useEffect(() => {
    if (!authUser) {
      setRequests([]);
      setRequestsLoading(false);
      setRequestsError(null);
      setHasMoreRequests(false);
      return;
    }

    setRequestsLoading(true);
    setRequestsError(null);

    let unsubscribe: (() => void) | null = null;
    try {
      const requestsQuery = query(
        collection(db, 'requests'),
        orderBy('createdAt', 'desc'),
        limit(requestsLimit)
      );

      unsubscribe = onSnapshot(
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

            const rawExpiresAt = data.expiresAt?.toDate
              ? data.expiresAt.toDate().toISOString()
              : typeof data.expiresAt === 'string'
              ? data.expiresAt
              : undefined;

            const deleteAt = data.deleteAt?.toDate
              ? data.deleteAt.toDate().toISOString()
              : typeof data.deleteAt === 'string'
              ? data.deleteAt
              : undefined;

            const renewedAt = data.renewedAt?.toDate
              ? data.renewedAt.toDate().toISOString()
              : typeof data.renewedAt === 'string'
              ? data.renewedAt
              : undefined;

            const renewalCount = typeof data.renewalCount === 'number'
              ? data.renewalCount
              : Number(data.renewalCount) || 0;

            // Safe legacy fallback policy:
            // 1. If explicit expiresAt exists, use it.
            // 2. If missing and createdAt is within 24h, expiresAt = createdAt + 24h.
            // 3. If missing and created >24h ago with active status (open/active), grant 24h grace window from now
            //    so legacy requests are not abruptly wiped or hidden during migration.
            let expiresAt = rawExpiresAt;
            if (!expiresAt && createdAt) {
              const createdMs = new Date(createdAt).getTime();
              if (!isNaN(createdMs)) {
                if (Date.now() - createdMs < 24 * 60 * 60 * 1000) {
                  expiresAt = new Date(createdMs + 24 * 60 * 60 * 1000).toISOString();
                } else if (data.status === 'open' || data.status === 'active' || !data.status) {
                  // Legacy active grace period ensures existing requests remain manageable
                  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                } else {
                  expiresAt = new Date(createdMs + 24 * 60 * 60 * 1000).toISOString();
                }
              }
            }

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
              expiresAt,
              deleteAt,
              renewedAt,
              renewalCount,
            };
          });

          setRequests(liveRequests);
          setHasMoreRequests(snapshot.docs.length >= requestsLimit);
          setRequestsLoading(false);
          setRequestsError(null);

          // Prefetch requester profiles on demand
          const requesterIds = Array.from(new Set(liveRequests.map((r) => r.requesterId).filter(Boolean)));
          prefetchUsers(requesterIds);
        },
        (err) => {
          console.error('Error listening to requests:', err);
          setRequestsLoading(false);
          setRequestsError('Unable to load campus requests right now. Please refresh.');
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
      setRequestsError('Unable to load campus requests right now. Please refresh.');
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [authUser, requestsLimit]);

  const addListing = async (listingInput: NewListingInput | Listing): Promise<string> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to publish a listing.');
    }

    const trimmedTitle = (listingInput.title || '').trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
      throw new Error('Listing title must be between 3 and 50 characters.');
    }

    const trimmedDesc = (listingInput.description || '').trim();
    if (trimmedDesc.length < 10 || trimmedDesc.length > 100) {
      throw new Error('Listing description must be between 10 and 100 characters.');
    }

    const trimmedLoc = (listingInput.location || '').trim();
    if (!isValidApprovedLocation(trimmedLoc)) {
      throw new Error('Please select an approved campus pickup location.');
    }

    const sellerId = auth.currentUser.uid;
    const docRef = doc(collection(db, 'listings'));

    const validDays = [7, 15, 30];
    const durationDays = validDays.includes(Number(listingInput.expirationDays))
      ? Number(listingInput.expirationDays)
      : 15;
    const expiresAtDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const expiresAtTimestamp = Timestamp.fromDate(expiresAtDate);

    const rawImages = Array.isArray(listingInput.images) ? listingInput.images : [];
    const sanitizedImages = rawImages
      .filter((img): img is string => typeof img === 'string' && img.trim().length > 0 && img.startsWith('https://'));

    if (sanitizedImages.length > 3) {
      throw new Error('Maximum 3 images allowed per listing.');
    }
    const finalImages = sanitizedImages.slice(0, 3);

    const newListingData: Record<string, any> = {
      title: trimmedTitle,
      description: trimmedDesc,
      type: listingInput.type,
      category: listingInput.category,
      location: trimmedLoc,
      sellerId: sellerId, // strictly enforced from authenticated user
      images: finalImages,
      status: listingInput.status || 'available',
      expirationDays: durationDays,
      expiresAt: expiresAtTimestamp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (listingInput.type !== 'Borrow' && listingInput.condition) {
      newListingData.condition = listingInput.condition;
    }

    if (listingInput.type === 'Sale') {
      const parsedPrice = Number(listingInput.price);
      if (isNaN(parsedPrice) || parsedPrice < 1) {
        throw new Error('Minimum listing price is ₹1.');
      }
      if (parsedPrice > 10000) {
        throw new Error('Maximum listing price is ₹10,000.');
      }
      newListingData.price = parsedPrice;
    } else if (listingInput.price !== undefined && listingInput.price !== null && !isNaN(Number(listingInput.price))) {
      const parsedPrice = Number(listingInput.price);
      if (parsedPrice < 1 || parsedPrice > 10000) {
        throw new Error('Price must be between ₹1 and ₹10,000.');
      }
      newListingData.price = parsedPrice;
    }

    if (listingInput.type === 'Exchange' && listingInput.wantedItem?.trim()) {
      newListingData.wantedItem = listingInput.wantedItem.trim();
    }

    try {
      await setDoc(docRef, newListingData);

      // Prepend to local state for instantaneous UX
      const newlyCreated: Listing = {
        id: docRef.id,
        title: newListingData.title,
        description: newListingData.description,
        price: newListingData.price,
        type: newListingData.type,
        condition: newListingData.condition,
        category: newListingData.category,
        location: newListingData.location,
        sellerId: newListingData.sellerId,
        images: newListingData.images,
        status: newListingData.status,
        expirationDays: newListingData.expirationDays,
        expiresAt: expiresAtDate.toISOString(),
        wantedItem: newListingData.wantedItem,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setListings((prev) => [newlyCreated, ...prev]);

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
      if (trimmed.length < 3 || trimmed.length > 50) {
        throw new Error('Listing title must be between 3 and 50 characters.');
      }
      updatePayload.title = trimmed;
    }

    if (updates.description !== undefined) {
      const trimmed = updates.description.trim();
      if (trimmed.length < 10 || trimmed.length > 100) {
        throw new Error('Listing description must be between 10 and 100 characters.');
      }
      updatePayload.description = trimmed;
    }

    if (updates.type !== undefined) {
      updatePayload.type = updates.type;
    }

    if (updates.category !== undefined) {
      updatePayload.category = updates.category;
    }

    const effectiveType = updates.type || currentListing?.type;
    if (updates.condition !== undefined && effectiveType !== 'Borrow') {
      updatePayload.condition = updates.condition;
    }

    if (updates.location !== undefined) {
      const trimmed = updates.location.trim();
      if (!isValidApprovedLocation(trimmed)) {
        throw new Error('Please select an approved campus pickup location.');
      }
      updatePayload.location = trimmed;
    }

    if (updates.price !== undefined) {
      if (updates.price === null || isNaN(Number(updates.price))) {
        // Leave undefined or keep price
      } else {
        const num = Number(updates.price);
        if (num < 1) {
          throw new Error('Minimum listing price is ₹1.');
        }
        if (num > 10000) {
          throw new Error('Maximum listing price is ₹10,000.');
        }
        updatePayload.price = num;
      }
    }

    if (updates.wantedItem !== undefined) {
      updatePayload.wantedItem = updates.wantedItem.trim();
    }

    if (Array.isArray(updates.images)) {
      const sanitized = updates.images
        .filter((img): img is string => typeof img === 'string' && img.trim().length > 0 && img.startsWith('https://'));
      if (sanitized.length > 3) {
        throw new Error('Maximum 3 images allowed per listing.');
      }
      updatePayload.images = sanitized.slice(0, 3);
    }

    try {
      await updateDoc(docRef, updatePayload);
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l))
      );
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
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: 'cancelled', updatedAt: new Date().toISOString() } : l))
      );
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

    const now = Date.now();
    const expiresAtDate = new Date(now + 24 * 60 * 60 * 1000);
    const deleteAtDate = new Date(now + 31 * 24 * 60 * 60 * 1000); // 30-day retention after 24h expiry

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
      expiresAt: Timestamp.fromDate(expiresAtDate),
      deleteAt: Timestamp.fromDate(deleteAtDate),
      renewalCount: 0,
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

  const renewRequest = async (requestId: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required: please log in to renew a request.');
    }

    const currentUid = auth.currentUser.uid;
    const currentReq = requests.find((r) => r.id === requestId);
    if (currentReq && currentReq.requesterId !== currentUid) {
      throw new Error('Unauthorized: only the requester can renew this request.');
    }

    if (currentReq?.status === 'completed' || currentReq?.status === 'cancelled') {
      throw new Error('Completed or cancelled requests cannot be renewed.');
    }

    // 1. Attempt trusted server renewal endpoint
    let serverRenewed = false;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(REQUEST_ENDPOINTS.renew, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        serverRenewed = true;
      }
    } catch (apiErr) {
      console.warn('Backend renewal endpoint notice, falling back to direct Firestore update:', apiErr);
    }

    // 2. Direct Firestore fallback if server endpoint unavailable
    if (!serverRenewed) {
      const docRef = doc(db, 'requests', requestId);
      const now = Date.now();
      const expiresAtTimestamp = Timestamp.fromDate(new Date(now + 24 * 60 * 60 * 1000));
      const deleteAtTimestamp = Timestamp.fromDate(new Date(now + 31 * 24 * 60 * 60 * 1000));
      try {
        await updateDoc(docRef, {
          status: 'open',
          expiresAt: expiresAtTimestamp,
          deleteAt: deleteAtTimestamp,
          renewedAt: serverTimestamp(),
          renewalCount: (currentReq?.renewalCount || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      } catch (err: unknown) {
        handleFirestoreError(err, OperationType.UPDATE, `requests/${requestId}`);
      }
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
        hasMoreListings,
        loadMoreListings,
        addListing,
        updateListing,
        cancelListing,
        requests,
        requestsLoading,
        requestsError,
        hasMoreRequests,
        loadMoreRequests,
        addRequest,
        renewRequest,
        cancelRequest,
        updateRequestStatus,
        savedListings,
        toggleSaveListing,
        users: Array.from(userCache.values()),
        fetchUserProfile,
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

