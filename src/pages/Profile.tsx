import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Package, 
  Bookmark, 
  UserCircle2, 
  Loader2,
  BookmarkCheck,
  Clock,
  MapPin,
  MessageSquare,
  ExternalLink,
  AlertCircle,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Camera,
  Check,
  Heart
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';
import { formatCurrency, cn } from '../lib/utils';
import { ListingCard } from '../components/ListingCard';
import { EditListingModal } from '../components/EditListingModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Reservation, Listing } from '../types';
import { AUTH_ENDPOINTS, RESERVATION_ENDPOINTS } from '../config/api';
import { validatePassword } from '../lib/passwordSecurity';
import { PasswordRequirements } from '../components/PasswordRequirements';

export function Profile({ defaultTab }: { defaultTab?: 'listings' | 'reserved' | 'saved' | 'settings' } = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { listings, listingsLoading, savedListings, users, cancelListing, toggleSaveListing } = useAppContext();
  const { currentUser, firebaseUser, logout } = useAuth();
  
  const initialTab = defaultTab || (searchParams.get('tab') as any) || 'listings';
  const [activeTab, setActiveTab] = useState<'listings' | 'reserved' | 'saved' | 'settings'>(initialTab);
  const [reservedSubView, setReservedSubView] = useState<'outgoing' | 'incoming' | 'past'>('outgoing');
  const [savedListingTypeFilter, setSavedListingTypeFilter] = useState<'All' | 'Sale' | 'Donate' | 'Exchange'>('All');
  const [reservationActionLoading, setReservationActionLoading] = useState<string | null>(null);
  const [reservationFeedback, setReservationFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Listings Management State
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'reserved' | 'completed' | 'expired' | 'cancelled'>('active');
  const [listingToCancel, setListingToCancel] = useState<any | null>(null);
  const [listingToEdit, setListingToEdit] = useState<Listing | null>(null);
  const [isCancellingListing, setIsCancellingListing] = useState(false);
  const [listingCancelError, setListingCancelError] = useState<string | null>(null);

  // Delete Account State
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Reservations State
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [incomingReservations, setIncomingReservations] = useState<Reservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);

  // Settings State
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editYearOfStudy, setEditYearOfStudy] = useState('2nd Year');
  const [editBio, setEditBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const newPasswordValidation = validatePassword(newPassword);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageMessage, setImageMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    } else {
      const tabParam = searchParams.get('tab') as any;
      if (tabParam && ['listings', 'reserved', 'saved', 'settings'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, [defaultTab, searchParams]);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name || '');
      setEditDept(currentUser.department || 'Computer Science');
      setEditYearOfStudy(currentUser.yearOfStudy || '2nd Year');
      setEditBio(currentUser.bio || '');
    }
  }, [currentUser]);

  const handleTabChange = (newTab: 'listings' | 'reserved' | 'saved' | 'settings') => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4 bg-[#f7f6f2] min-h-[70vh]">
        <div className="h-16 w-16 rounded-3xl bg-white border border-[#dedcd4] flex items-center justify-center text-[#717870] mb-4 shadow-xs">
          <UserCircle2 className="h-9 w-9 text-[#717870]" />
        </div>
        <h2 className="text-xl font-bold text-[#252b27] mb-2">Not signed in</h2>
        <p className="text-[#555d56] mb-6 max-w-sm text-sm">
          Sign in to your verified student account to manage listings, track active reservations, and view saved items.
        </p>
        <Button onClick={() => navigate('/login')} className="bg-[#204b39] hover:bg-[#183a2c] text-white">
          Sign in
        </Button>
      </div>
    );
  }

  const myListings = listings.filter(l => l.sellerId === currentUser.id);
  const mySavedListings = listings.filter(
    l =>
      savedListings.includes(l.id) &&
      l.status !== 'cancelled' &&
      l.status !== 'hidden' &&
      l.status !== 'removed'
  );

  const filteredSavedListings = mySavedListings.filter(l => {
    if (savedListingTypeFilter === 'All') return true;
    return l.type === savedListingTypeFilter;
  });

  const filteredMyListings = myListings.filter(l => {
    const isExpired = l.status === 'expired' || (Boolean(l.expiresAt) && new Date(l.expiresAt!).getTime() <= Date.now());
    if (listingFilter === 'active') {
      return (l.status === 'available' || l.status === 'active') && !isExpired;
    }
    if (listingFilter === 'reserved') {
      return l.status === 'reserved' && !isExpired;
    }
    if (listingFilter === 'completed') {
      return l.status === 'completed';
    }
    if (listingFilter === 'expired') {
      return isExpired && l.status !== 'cancelled' && l.status !== 'completed';
    }
    if (listingFilter === 'cancelled') {
      return l.status === 'cancelled';
    }
    return true;
  });

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !currentUser) return;
    if (deleteConfirmEmail.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
      setDeleteAccountError(`Please type "${currentUser.email}" exactly to confirm.`);
      return;
    }
    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(AUTH_ENDPOINTS.deleteAccount, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account.');
      }
      await logout();
      navigate('/');
    } catch (err: any) {
      console.error('Account deletion error:', err);
      setDeleteAccountError(err.message || 'Failed to delete account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleConfirmCancelListing = async () => {
    if (!listingToCancel) return;
    if (listingToCancel.status === 'completed') {
      setListingCancelError('This listing is marked as completed and cannot be cancelled.');
      return;
    }
    if (listingToCancel.status === 'cancelled') {
      setListingToCancel(null);
      return;
    }
    setIsCancellingListing(true);
    setListingCancelError(null);
    try {
      await cancelListing(listingToCancel.id);
      setListingToCancel(null);
    } catch (err: any) {
      console.error('Failed to cancel listing from profile:', err);
      setListingCancelError(err?.message || 'Failed to cancel listing');
    } finally {
      setIsCancellingListing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setIsSavingProfile(true);
    setProfileMessage({ type: '', text: '' });
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        name: editName.trim(),
        department: editDept,
        yearOfStudy: editYearOfStudy,
        bio: editBio.trim()
      });
      setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    if (!currentPassword.trim()) {
      setPasswordMessage({
        type: 'error',
        text: 'Please enter your current password.',
      });
      return;
    }

    if (!newPasswordValidation.isValid) {
      setPasswordMessage({
        type: 'error',
        text: newPasswordValidation.errors[0] || 'Password does not meet the security requirements.',
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      // Re-authenticate with current password to verify identity and refresh auth session
      if (firebaseUser.email) {
        try {
          const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
          await reauthenticateWithCredential(firebaseUser, credential);
        } catch (reauthErr: any) {
          if (
            reauthErr.code === 'auth/wrong-password' ||
            reauthErr.code === 'auth/invalid-credential' ||
            reauthErr.message?.includes('INVALID_LOGIN_CREDENTIALS') ||
            reauthErr.message?.includes('wrong-password')
          ) {
            setPasswordMessage({ type: 'error', text: 'Current password is incorrect.' });
            setIsSavingPassword(false);
            return;
          }
        }
      }

      const idToken = await firebaseUser.getIdToken(true);
      const res = await fetch(AUTH_ENDPOINTS.changePassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (data.details ? data.details[0] : 'Failed to update password.'));
      }
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
    } catch (err: any) {
      if (
        err.code === 'auth/requires-recent-login' ||
        err.message?.includes('requires-recent-login') ||
        err.message?.includes('CREDENTIAL_TOO_OLD_LOGIN_AGAIN')
      ) {
        setPasswordMessage({ type: 'error', text: 'Please sign out and sign in again to update your password.' });
      } else {
        setPasswordMessage({ type: 'error', text: err.message || 'Failed to update password.' });
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setImageMessage({ type: 'error', text: validation.error || 'Invalid image file.' });
      if (e.target) e.target.value = '';
      return;
    }
    
    setIsUploadingImage(true);
    setImageMessage({ type: '', text: '' });
    try {
      const secureUrl = await uploadImageToCloudinary(file, {
        folder: 'studentneed/avatars',
      });

      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        avatarUrl: secureUrl
      });
      setImageMessage({ type: 'success', text: 'Profile photo updated successfully.' });
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      setImageMessage({ type: 'error', text: 'Failed to upload photo. Please try again.' });
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Subscribe to user reservations (both as buyer and as seller)
  useEffect(() => {
    if (!currentUser?.id) return;
    setIsLoadingReservations(true);

    const buyerQuery = query(
      collection(db, 'reservations'),
      where('buyerId', '==', currentUser.id)
    );

    const sellerQuery = query(
      collection(db, 'reservations'),
      where('sellerId', '==', currentUser.id)
    );

    const unsubBuyer = onSnapshot(
      buyerQuery,
      (snap) => {
        const list: Reservation[] = snap.docs.map((d) => ({
          id: d.id,
          listingId: d.data().listingId,
          buyerId: d.data().buyerId,
          sellerId: d.data().sellerId,
          chatId: d.data().chatId,
          status: d.data().status,
          meetup: d.data().meetup || undefined,
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt,
        }));
        setMyReservations(list);
        setIsLoadingReservations(false);
      },
      (err) => {
        console.warn('Buyer reservations listener notice:', err);
        setIsLoadingReservations(false);
      }
    );

    const unsubSeller = onSnapshot(
      sellerQuery,
      (snap) => {
        const list: Reservation[] = snap.docs.map((d) => ({
          id: d.id,
          listingId: d.data().listingId,
          buyerId: d.data().buyerId,
          sellerId: d.data().sellerId,
          chatId: d.data().chatId,
          status: d.data().status,
          meetup: d.data().meetup || undefined,
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt,
        }));
        setIncomingReservations(list);
      },
      (err) => {
        console.warn('Seller reservations listener notice:', err);
      }
    );

    return () => {
      unsubBuyer();
      unsubSeller();
    };
  }, [currentUser?.id]);

  const activeReservationsCount = 
    myReservations.filter(r => r.status === 'pending' || r.status === 'accepted').length + 
    incomingReservations.filter(r => r.status === 'pending' || r.status === 'accepted').length;

  const pastExchanges = [
    ...myReservations.filter(r => r.status === 'completed'),
    ...incomingReservations.filter(r => r.status === 'completed')
  ].filter((r, idx, arr) => arr.findIndex(item => item.id === r.id) === idx);

  const handleAcceptReservation = async (res: Reservation) => {
    if (!firebaseUser) return;
    setReservationActionLoading(res.id);
    setReservationFeedback(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(RESERVATION_ENDPOINTS.accept, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reservationId: res.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept reservation.');
      }
      setReservationFeedback({ type: 'success', text: 'Reservation accepted! Coordinate pickup details in chat.' });
    } catch (err: any) {
      console.error('Accept reservation error:', err);
      setReservationFeedback({ type: 'error', text: err.message || 'Failed to accept reservation.' });
    } finally {
      setReservationActionLoading(null);
    }
  };

  const handleDeclineReservation = async (res: Reservation) => {
    if (!firebaseUser) return;
    setReservationActionLoading(res.id);
    setReservationFeedback(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(RESERVATION_ENDPOINTS.decline, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reservationId: res.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Fallback to client update if endpoint unavailable
        await updateDoc(doc(db, 'reservations', res.id), {
          status: 'rejected',
          updatedAt: serverTimestamp(),
        });
      }
      setReservationFeedback({ type: 'success', text: 'Reservation request declined.' });
    } catch (err: any) {
      console.error('Decline reservation error:', err);
      try {
        await updateDoc(doc(db, 'reservations', res.id), {
          status: 'rejected',
          updatedAt: serverTimestamp(),
        });
        setReservationFeedback({ type: 'success', text: 'Reservation request declined.' });
      } catch (clientErr: any) {
        setReservationFeedback({ type: 'error', text: clientErr.message || err.message || 'Failed to decline reservation.' });
      }
    } finally {
      setReservationActionLoading(null);
    }
  };

  const handleCancelReservation = async (res: Reservation) => {
    if (!firebaseUser) return;
    setReservationActionLoading(res.id);
    setReservationFeedback(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(RESERVATION_ENDPOINTS.cancel, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reservationId: res.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel reservation.');
      }
      setReservationFeedback({ type: 'success', text: 'Reservation cancelled.' });
    } catch (err: any) {
      console.error('Cancel reservation error:', err);
      setReservationFeedback({ type: 'error', text: err.message || 'Failed to cancel reservation.' });
    } finally {
      setReservationActionLoading(null);
    }
  };

  const handleConfirmReservationMeetup = async (res: Reservation) => {
    if (!firebaseUser || !res.meetup) return;
    setReservationActionLoading(res.id);
    setReservationFeedback(null);
    try {
      await updateDoc(doc(db, 'reservations', res.id), {
        meetup: {
          ...res.meetup,
          status: 'confirmed',
          confirmedBy: firebaseUser.uid,
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      // Notify counterparty via trusted endpoint
      try {
        const idToken = await firebaseUser.getIdToken();
        const loc = typeof res.meetup.location === 'object' ? (res.meetup.location as any)?.name : res.meetup.location;
        fetch(RESERVATION_ENDPOINTS.notifyMeetup, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            reservationId: res.id,
            status: 'confirmed',
            location: loc,
          }),
        }).catch((err) => console.warn('Meetup notification error:', err));
      } catch {}
      setReservationFeedback({ type: 'success', text: 'Meetup location confirmed!' });
    } catch (err: any) {
      console.error('Confirm meetup error:', err);
      setReservationFeedback({ type: 'error', text: err.message || 'Failed to confirm meetup location.' });
    } finally {
      setReservationActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#252b27]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Navigation backlink when in sub-views */}
        {activeTab !== 'listings' && (
          <button
            type="button"
            onClick={() => handleTabChange('listings')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#555d56] hover:text-[#204b39] transition-colors mb-4 group cursor-pointer"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">&larr;</span>
            <span>Back to Profile</span>
          </button>
        )}

        {/* Page Title & Subtitle */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#252b27]">
            {activeTab === 'settings' 
              ? 'Account settings' 
              : activeTab === 'reserved' 
              ? 'Reservations' 
              : activeTab === 'saved' 
              ? 'Good finds, saved for later.' 
              : 'Your campus corner.'}
          </h1>
          <p className="mt-1 text-sm text-[#717870]">
            {activeTab === 'settings'
              ? 'Keep your campus profile and sign-in details up to date.'
              : activeTab === 'reserved'
              ? 'Keep track of your interest in items and coordinate the campus handoff.'
              : activeTab === 'saved'
              ? 'Your wishlist keeps useful campus items close. Saving does not reserve an item.'
              : 'Manage your listings and the essentials you’re sharing.'}
          </p>
        </div>

        {/* Centered Main Content Area */}
        <main className="w-full space-y-6">
            
            {/* VIEW 1: PROFILE / YOUR CAMPUS CORNER */}
            {activeTab === 'listings' && (
              <div className="space-y-6">
                
                {/* Student Profile Card */}
                <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 sm:gap-5">
                      
                      {/* Avatar with Camera upload button */}
                      <div className="relative shrink-0">
                        {currentUser.avatarUrl ? (
                          <img 
                            src={currentUser.avatarUrl} 
                            alt={currentUser.name} 
                            className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border border-[#dedcd4] bg-[#edf1ec]"
                          />
                        ) : (
                          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-[#edf1ec] text-[#204b39] flex items-center justify-center text-3xl font-bold border border-[#dedcd4]">
                            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <UserCircle2 className="h-10 w-10 text-[#717870]" />}
                          </div>
                        )}
                        <label 
                          className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#204b39] text-white shadow-xs hover:bg-[#183a2c] cursor-pointer transition-colors"
                          title="Change profile photo"
                          aria-label="Change profile photo"
                        >
                          {isUploadingImage ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Camera className="h-3.5 w-3.5" />
                          )}
                          <input 
                            type="file" 
                            accept="image/jpeg,image/png,image/webp" 
                            className="sr-only" 
                            onChange={handleImageUpload} 
                            disabled={isUploadingImage} 
                          />
                        </label>
                      </div>

                      {/* Student Info */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-2xl font-bold text-[#252b27]">{currentUser.name}</h2>
                          {currentUser.isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1ec] px-2 py-0.5 text-[11px] font-semibold text-[#204b39] border border-[#dedcd4]">
                              <ShieldCheck className="h-3 w-3 text-[#204b39]" />
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#717870] mt-0.5">
                          {currentUser.yearOfStudy || '2nd Year'} · {currentUser.campus || 'MIT Campus, Anna University'}
                        </p>
                        <p className="text-xs text-[#717870] mt-0.5">
                          {currentUser.email}
                        </p>
                        <p className="text-sm text-[#555d56] mt-3 leading-relaxed max-w-xl">
                          {currentUser.bio || 'Engineering student. Passing on essentials I no longer use and looking for useful things on campus.'}
                        </p>
                      </div>
                    </div>

                    {/* Edit Profile CTA */}
                    <button
                      type="button"
                      onClick={() => handleTabChange('settings')}
                      className="rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] text-sm font-medium px-4 py-2 transition-colors shrink-0 shadow-2xs self-start sm:self-auto"
                    >
                      Edit profile
                    </button>
                  </div>

                  {/* Image upload feedback notice */}
                  {imageMessage.text && (
                    <div className={cn(
                      "mt-4 p-3 rounded-xl text-xs font-semibold border flex items-center gap-2",
                      imageMessage.type === 'error' 
                        ? "text-red-800 bg-red-50 border-red-200" 
                        : "text-emerald-900 bg-emerald-50 border-emerald-200"
                    )}>
                      {imageMessage.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-red-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                      <span>{imageMessage.text}</span>
                    </div>
                  )}
                </div>

                {/* 3 Quick-Navigation Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div
                    onClick={() => handleTabChange('reserved')}
                    className="rounded-2xl border border-[#dedcd4] bg-white p-5 hover:border-[#204b39]/40 transition-colors cursor-pointer shadow-xs group"
                  >
                    <div className="flex items-center justify-between text-sm font-bold text-[#252b27]">
                      <span className="group-hover:text-[#204b39] transition-colors">Reservations &rarr;</span>
                      {activeReservationsCount > 0 && (
                        <span className="rounded-full bg-[#204b39] text-white text-[11px] font-bold px-2 py-0.5">
                          {activeReservationsCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#717870] mt-1.5 leading-relaxed">
                      Coordinate your upcoming handoffs
                    </p>
                  </div>

                  <div
                    onClick={() => handleTabChange('saved')}
                    className="rounded-2xl border border-[#dedcd4] bg-white p-5 hover:border-[#204b39]/40 transition-colors cursor-pointer shadow-xs group"
                  >
                    <div className="flex items-center justify-between text-sm font-bold text-[#252b27]">
                      <span className="group-hover:text-[#204b39] transition-colors">Wishlist &rarr;</span>
                      {mySavedListings.length > 0 && (
                        <span className="text-xs text-[#717870] font-medium">
                          {mySavedListings.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#717870] mt-1.5 leading-relaxed">
                      Keep useful finds in one place
                    </p>
                  </div>

                  <div
                    onClick={() => navigate('/chat')}
                    className="rounded-2xl border border-[#dedcd4] bg-white p-5 hover:border-[#204b39]/40 transition-colors cursor-pointer shadow-xs group"
                  >
                    <div className="flex items-center justify-between text-sm font-bold text-[#252b27]">
                      <span className="group-hover:text-[#204b39] transition-colors">Chat &rarr;</span>
                    </div>
                    <p className="text-xs text-[#717870] mt-1.5 leading-relaxed">
                      Continue a campus conversation
                    </p>
                  </div>
                </div>

                {/* "Your listings" Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-[#252b27]">Your listings</h3>
                    <button
                      type="button"
                      onClick={() => navigate('/create-listing')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white px-4 py-2 text-sm font-medium transition-colors shadow-xs"
                    >
                      <span>+</span> Post Item
                    </button>
                  </div>

                  {/* Status Filter Pills */}
                  <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter listings by status">
                    {(['active', 'reserved', 'completed'] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        type="button"
                        onClick={() => setListingFilter(listingFilter === filterKey ? 'all' : filterKey)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                          listingFilter === filterKey
                            ? "bg-[#edf1ec] text-[#204b39] border border-[#dedcd4] font-semibold"
                            : "bg-white text-[#555d56] border border-[#dedcd4] hover:bg-zinc-50"
                        )}
                      >
                        {filterKey === 'active' ? 'Active' : filterKey === 'reserved' ? 'Reserved' : 'Completed'}
                      </button>
                    ))}
                    {listingFilter === 'all' && (
                      <span className="text-xs text-[#717870] font-medium ml-1">Showing all listings ({myListings.length})</span>
                    )}
                  </div>

                  {/* 2-Column Listing Cards Grid */}
                  {filteredMyListings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {filteredMyListings.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[#dedcd4] bg-white overflow-hidden shadow-xs hover:border-[#204b39]/30 transition-all flex flex-col"
                        >
                          <div className="relative aspect-[16/10] bg-zinc-100 overflow-hidden">
                            {item.images && item.images.length > 0 ? (
                              <img
                                src={item.images[0]}
                                alt={item.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                <Package className="h-8 w-8" />
                              </div>
                            )}
                            <div className="absolute top-3 left-3">
                              <span className="rounded-full bg-[#edf1ec] px-2.5 py-1 text-xs font-medium text-[#204b39] border border-[#dedcd4]/80 shadow-2xs">
                                {item.type === 'Sale' ? 'For Sale' : item.type}
                              </span>
                            </div>
                            <div className="absolute top-3 right-3">
                              <div className="rounded-full bg-white/90 p-1.5 text-[#555d56] shadow-2xs">
                                <Bookmark className="h-4 w-4" />
                              </div>
                            </div>
                          </div>

                          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-semibold text-base text-[#252b27] line-clamp-1">{item.title}</h4>
                              <p className="text-xs text-[#717870] mt-1">
                                {item.condition || 'Lightly used'} · {item.category}
                              </p>
                              <p className="text-lg font-bold text-[#252b27] mt-2">
                                {item.type === 'Donate' ? 'Free' : formatCurrency(item.price || 0)}
                              </p>
                              <p className="text-xs text-[#717870] mt-1">
                                {item.location || 'MIT Campus · Student-chosen meetup'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[#dedcd4]/60">
                              <button
                                type="button"
                                onClick={() => setListingToEdit(item)}
                                className="flex-1 rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 py-2 text-xs font-medium text-[#252b27] transition-colors shadow-2xs text-center"
                              >
                                Edit listing
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/listing/${item.id}`)}
                                className="rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-medium text-[#252b27] transition-colors shadow-2xs text-center"
                              >
                                View
                              </button>
                              {item.status !== 'completed' && item.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => setListingToCancel(item)}
                                  className="rounded-xl border border-[#dedcd4] bg-white hover:bg-red-50 text-red-600 px-3 py-2 text-xs font-medium transition-colors shadow-2xs"
                                  title="Cancel listing"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#dedcd4] bg-white p-12 text-center">
                      <Package className="h-10 w-10 text-[#717870] mx-auto mb-3" />
                      <p className="text-sm font-semibold text-[#252b27]">No listings found</p>
                      <p className="text-xs text-[#717870] mt-1 mb-4">
                        {listingFilter === 'active'
                          ? "You don't have any active items listed on campus right now."
                          : "No items match the selected status filter."}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/create-listing')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white px-4 py-2 text-xs font-medium transition-colors"
                      >
                        Post an item
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: ACCOUNT SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                
                {/* 1. Profile details Card */}
                <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-xs space-y-5">
                  <h2 className="text-lg font-bold text-[#252b27]">Profile details</h2>

                  {profileMessage.text && (
                    <div className={cn(
                      "p-3 rounded-xl text-xs font-semibold border flex items-center gap-2",
                      profileMessage.type === 'error'
                        ? "text-red-700 bg-red-50 border-red-200"
                        : "text-emerald-900 bg-emerald-50 border-emerald-200"
                    )}>
                      {profileMessage.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-red-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                      <span>{profileMessage.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#252b27] mb-1.5">Display name</label>
                        <Input
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Student A"
                          className="h-11 rounded-xl border-[#dedcd4] bg-white text-sm text-[#252b27] focus:border-[#204b39] focus:ring-[#204b39]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#252b27] mb-1.5">Year of study</label>
                        <select
                          value={editYearOfStudy}
                          onChange={(e) => setEditYearOfStudy(e.target.value)}
                          className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs font-normal"
                        >
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                          <option value="Postgraduate / PhD">Postgraduate / PhD</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#252b27] mb-1.5">About you</label>
                      <textarea
                        rows={4}
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        placeholder="Engineering student. Passing on essentials I no longer use."
                        className="w-full rounded-xl border border-[#dedcd4] bg-white p-3.5 text-sm text-[#252b27] placeholder:text-[#717870] focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs resize-none"
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white px-5 py-2.5 text-sm font-medium transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {isSavingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>{isSavingProfile ? 'Saving...' : 'Save changes'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Campus email Card */}
                <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-xs space-y-4">
                  <h2 className="text-lg font-bold text-[#252b27]">Campus email</h2>

                  <div>
                    <label className="block text-xs font-medium text-[#252b27] mb-1.5">Student email</label>
                    <Input
                      value={currentUser.email}
                      disabled
                      className="h-11 rounded-xl border-[#dedcd4] bg-zinc-50 text-sm text-[#555d56] cursor-not-allowed"
                    />
                    <p className="mt-1.5 text-xs text-[#717870]">
                      Your campus email is used for sign-in and access to StudentNeed.
                    </p>
                    <p className="text-xs text-[#717870] mt-0.5">
                      Madras Institute of Technology · Anna University
                    </p>
                  </div>

                  {/* Campus-only access callout */}
                  <div className="rounded-xl bg-[#edf1ec] border border-[#dedcd4] p-4 flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-[#204b39] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-[#252b27]">Campus-only access</h4>
                      <p className="text-xs text-[#555d56] mt-0.5 leading-relaxed">
                        Use your official @student.annauniv.edu email. Your email is not displayed on public listings.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Change password Card */}
                <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-xs space-y-5">
                  <h2 className="text-lg font-bold text-[#252b27]">Change password</h2>

                  {passwordMessage.text && (
                    <div className={cn(
                      "p-3 rounded-xl text-xs font-semibold border flex items-center gap-2",
                      passwordMessage.type === 'error'
                        ? "text-red-700 bg-red-50 border-red-200"
                        : "text-emerald-900 bg-emerald-50 border-emerald-200"
                    )}>
                      {passwordMessage.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-red-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                      <span>{passwordMessage.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[#252b27] mb-1.5">Current password</label>
                      <div className="relative flex items-center">
                        <Input
                          type={showCurrentPassword ? "text" : "password"}
                          required
                          placeholder="Enter current password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="h-11 rounded-xl border-[#dedcd4] bg-white text-sm text-[#252b27] pr-10 focus:border-[#204b39] focus:ring-[#204b39]/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          className="absolute right-0 flex h-full items-center justify-center px-3 text-[#717870] hover:text-[#252b27]"
                          aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#252b27] mb-1.5">New password</label>
                        <div className="relative flex items-center">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            required
                            placeholder="At least 8 characters"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="h-11 rounded-xl border-[#dedcd4] bg-white text-sm text-[#252b27] pr-10 focus:border-[#204b39] focus:ring-[#204b39]/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            className="absolute right-0 flex h-full items-center justify-center px-3 text-[#717870] hover:text-[#252b27]"
                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#252b27] mb-1.5">Confirm new password</label>
                        <div className="relative flex items-center">
                          <Input
                            type={showConfirmNewPassword ? "text" : "password"}
                            required
                            placeholder="Enter new password again"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="h-11 rounded-xl border-[#dedcd4] bg-white text-sm text-[#252b27] pr-10 focus:border-[#204b39] focus:ring-[#204b39]/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                            className="absolute right-0 flex h-full items-center justify-center px-3 text-[#717870] hover:text-[#252b27]"
                            aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Password requirements */}
                    <PasswordRequirements password={newPassword} validation={newPasswordValidation} className="mt-2" />

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={isSavingPassword || !newPasswordValidation.isValid || newPassword !== confirmNewPassword || !currentPassword.trim()}
                        className="rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] px-4 py-2.5 text-sm font-medium transition-colors shadow-2xs disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {isSavingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>{isSavingPassword ? 'Updating password...' : 'Update password'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 4. Signing out Card */}
                <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-xs space-y-4">
                  <h2 className="text-lg font-bold text-[#252b27]">Signing out</h2>
                  <p className="text-sm text-[#555d56] leading-relaxed">
                    Sign out on this device. Your listings and conversations will remain in your account.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] px-4 py-2 text-sm font-medium transition-colors shadow-2xs"
                    >
                      Sign out
                    </button>
                  </div>
                </div>

                {/* Account Deletion (Danger Zone preserved safely) */}
                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-red-900">Danger Zone: Delete Account</h3>
                    <p className="text-xs text-red-700 mt-0.5">
                      Permanently remove your student account, active listings, and associated data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="rounded-xl border border-red-300 bg-white hover:bg-red-50 text-red-700 px-4 py-2 text-xs font-semibold transition-colors shrink-0 shadow-2xs"
                  >
                    Delete account
                  </button>
                </div>

              </div>
            )}

            {/* VIEW 3: RESERVATIONS */}
            {activeTab === 'reserved' && (
              <div className="space-y-6">
                
                {/* Reservation Action Feedback Alert */}
                {reservationFeedback && (
                  <div className={cn(
                    "p-3.5 rounded-2xl text-xs font-semibold border flex items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-200",
                    reservationFeedback.type === 'error'
                      ? "text-red-800 bg-red-50 border-red-200"
                      : "text-emerald-900 bg-emerald-50 border-emerald-200"
                  )}>
                    <div className="flex items-center gap-2">
                      {reservationFeedback.type === 'error' ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                      <span>{reservationFeedback.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReservationFeedback(null)}
                      className="text-xs opacity-70 hover:opacity-100"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Sub-navigation pill switcher & hold notice banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dedcd4] pb-4">
                  <div className="inline-flex rounded-xl bg-white p-1 border border-[#dedcd4] shadow-2xs" role="tablist" aria-label="Reservation Views">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={reservedSubView === 'outgoing'}
                      onClick={() => setReservedSubView('outgoing')}
                      className={cn(
                        "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                        reservedSubView === 'outgoing'
                          ? "bg-[#edf1ec] text-[#204b39] shadow-2xs"
                          : "text-[#555d56] hover:text-[#252b27] hover:bg-zinc-50"
                      )}
                    >
                      Items I Reserved ({myReservations.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={reservedSubView === 'incoming'}
                      onClick={() => setReservedSubView('incoming')}
                      className={cn(
                        "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                        reservedSubView === 'incoming'
                          ? "bg-[#edf1ec] text-[#204b39] shadow-2xs"
                          : "text-[#555d56] hover:text-[#252b27] hover:bg-zinc-50"
                      )}
                    >
                      Incoming Requests ({incomingReservations.length})
                    </button>
                    {pastExchanges.length > 0 && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={reservedSubView === 'past'}
                        onClick={() => setReservedSubView('past')}
                        className={cn(
                          "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                          reservedSubView === 'past'
                            ? "bg-[#edf1ec] text-[#204b39] shadow-2xs"
                            : "text-[#555d56] hover:text-[#252b27] hover:bg-zinc-50"
                        )}
                      >
                        Past exchanges ({pastExchanges.length})
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-2 text-xs text-[#555d56] bg-amber-50/90 border border-amber-200/70 rounded-xl px-3.5 py-2">
                    <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                    <span>Reserved items are held while students coordinate meetup</span>
                  </div>
                </div>

                {/* Content List */}
                {(() => {
                  const currentList = 
                    reservedSubView === 'outgoing'
                      ? myReservations
                      : reservedSubView === 'incoming'
                      ? incomingReservations
                      : pastExchanges;

                  if (isLoadingReservations) {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {[1, 2].map((i) => (
                          <div key={i} className="rounded-2xl border border-[#dedcd4] bg-white p-5 space-y-4 shadow-xs">
                            <div className="flex gap-4">
                              <Skeleton className="h-24 w-24 rounded-xl" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3.5 w-1/2" />
                              </div>
                            </div>
                            <Skeleton className="h-8 w-full rounded-xl" />
                            <div className="flex gap-2 pt-2">
                              <Skeleton className="h-9 flex-1 rounded-xl" />
                              <Skeleton className="h-9 w-20 rounded-xl" />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (currentList.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedcd4] bg-white py-16 text-center px-4">
                        <div className="h-12 w-12 rounded-2xl bg-[#edf1ec] flex items-center justify-center mb-3 text-[#204b39]">
                          <BookmarkCheck className="h-6 w-6 text-[#204b39]" />
                        </div>
                        <h3 className="text-base font-bold text-[#252b27]">
                          {reservedSubView === 'outgoing' 
                            ? 'No items reserved yet' 
                            : reservedSubView === 'incoming' 
                            ? 'No incoming requests yet' 
                            : 'No past exchanges yet'}
                        </h3>
                        <p className="text-xs text-[#717870] mt-1 mb-4 max-w-md leading-relaxed">
                          {reservedSubView === 'outgoing'
                            ? 'When you request to hold or trade an item with another student, it will appear here.'
                            : reservedSubView === 'incoming'
                            ? 'When other campus members request to reserve your listings, their requests will appear here.'
                            : 'Completed item handoffs will appear here once exchanges conclude.'}
                        </p>
                        {reservedSubView === 'outgoing' && (
                          <Button onClick={() => navigate('/marketplace')} variant="outline" className="border-[#dedcd4]">
                            Explore Marketplace
                          </Button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {currentList.map((res) => {
                        const item = listings.find((l) => l.id === res.listingId);
                        const isOutgoing = res.buyerId === currentUser.id;
                        const counterpartId = isOutgoing ? res.sellerId : res.buyerId;
                        const counterpart = users.find((u) => u.id === counterpartId);

                        const meetupLocationName = 
                          res.meetup?.location
                            ? typeof res.meetup.location === 'object'
                              ? (res.meetup.location as any)?.name
                              : res.meetup.location
                            : 'Campus meetup';

                        return (
                          <div
                            key={res.id}
                            className="flex flex-col rounded-2xl border border-[#dedcd4] bg-white p-5 shadow-xs hover:border-[#204b39]/30 transition-all gap-4"
                          >
                            <div className="flex gap-4">
                              {/* Thumbnail */}
                              <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100 border border-[#dedcd4]">
                                {item?.images && item.images.length > 0 ? (
                                  <img
                                    src={item.images[0]}
                                    alt={item?.title || 'Listing image'}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                    <Package className="h-7 w-7" />
                                  </div>
                                )}
                              </div>

                              {/* Title, Status & Details */}
                              <div className="flex flex-1 flex-col justify-between min-w-0">
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-[#252b27] truncate text-base">
                                      {item?.title || 'Campus Item'}
                                    </h4>
                                    
                                    {/* Status Badge */}
                                    {res.status === 'completed' && (
                                      <span className="rounded-full bg-blue-600 text-white text-[11px] font-bold px-2.5 py-0.5 shrink-0 shadow-2xs">
                                        Completed
                                      </span>
                                    )}
                                    {res.status === 'accepted' && (
                                      <span className="rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-semibold px-2.5 py-0.5 shrink-0 flex items-center gap-1">
                                        <Check className="h-3 w-3 text-emerald-700" /> Reserved
                                      </span>
                                    )}
                                    {res.status === 'pending' && (
                                      <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold px-2.5 py-0.5 shrink-0 flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-amber-700" /> Pending
                                      </span>
                                    )}
                                    {res.status === 'rejected' && (
                                      <span className="rounded-full bg-zinc-100 text-zinc-700 border border-zinc-300 text-[11px] font-semibold px-2.5 py-0.5 shrink-0">
                                        Declined
                                      </span>
                                    )}
                                    {res.status === 'cancelled' && (
                                      <span className="rounded-full bg-red-100 text-red-700 border border-red-300 text-[11px] font-semibold px-2.5 py-0.5 shrink-0">
                                        Cancelled
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-1 font-semibold text-[#252b27] text-sm">
                                    {item ? (item.type === 'Donate' ? 'Free' : formatCurrency(item.price || 0)) : '—'}
                                  </p>
                                </div>

                                <div className="mt-2 text-xs text-[#555d56]">
                                  <span>
                                    {isOutgoing ? 'Seller' : 'Buyer'}:{' '}
                                    <strong className="text-[#252b27] font-semibold">
                                      {counterpart?.name || (isOutgoing ? 'Campus Seller' : 'Student Buyer')}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Meetup Strip */}
                            <div className="flex items-center gap-2 rounded-xl bg-[#f7f6f2] px-3.5 py-2 text-xs border border-[#dedcd4]">
                              <MapPin className="h-3.5 w-3.5 text-[#204b39] shrink-0" />
                              <span className="font-medium text-[#252b27] truncate">
                                Meetup: {meetupLocationName}
                              </span>
                              {res.meetup?.status === 'confirmed' ? (
                                <span className="ml-auto capitalize text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                  Confirmed
                                </span>
                              ) : res.meetup?.status === 'proposed' ? (
                                <span className="ml-auto capitalize text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                  Proposed
                                </span>
                              ) : (
                                <span className="ml-auto text-[10px] text-[#717870]">
                                  Coordinate in chat
                                </span>
                              )}
                            </div>

                            {/* Card Actions */}
                            <div className="flex flex-col gap-2 pt-1 border-t border-[#dedcd4]/60 mt-auto">
                              
                              {/* Incoming pending requests: Accept & Decline buttons */}
                              {!isOutgoing && res.status === 'pending' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={reservationActionLoading === res.id}
                                    onClick={() => handleAcceptReservation(res)}
                                    className="flex-1 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white text-xs font-semibold py-2 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-2xs"
                                  >
                                    {reservationActionLoading === res.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    Accept Request
                                  </button>
                                  <button
                                    type="button"
                                    disabled={reservationActionLoading === res.id}
                                    onClick={() => handleDeclineReservation(res)}
                                    className="rounded-xl border border-[#dedcd4] bg-white hover:bg-red-50 text-red-600 text-xs font-medium px-3.5 py-2 transition-colors disabled:opacity-50"
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}

                              {/* Outgoing pending requests: Cancel option */}
                              {isOutgoing && res.status === 'pending' && (
                                <div className="flex items-center justify-between text-xs px-1 text-[#717870]">
                                  <span>Awaiting seller response</span>
                                  <button
                                    type="button"
                                    disabled={reservationActionLoading === res.id}
                                    onClick={() => handleCancelReservation(res)}
                                    className="text-red-600 hover:text-red-700 hover:underline font-medium"
                                  >
                                    Cancel request
                                  </button>
                                </div>
                              )}

                              {/* Proposed Meetup: Counterpart confirmation button */}
                              {res.status === 'accepted' && res.meetup?.status === 'proposed' && res.meetup.proposedBy !== currentUser.id && (
                                <button
                                  type="button"
                                  disabled={reservationActionLoading === res.id}
                                  onClick={() => handleConfirmReservationMeetup(res)}
                                  className="w-full rounded-xl bg-[#edf1ec] hover:bg-[#dfe6de] text-[#204b39] border border-[#dedcd4] text-xs font-semibold py-2 transition-colors inline-flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Confirm Proposed Meetup ({meetupLocationName})
                                </button>
                              )}

                              {/* Primary actions: Open Chat & View Item */}
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1 gap-1.5 text-xs h-9 bg-[#204b39] hover:bg-[#183a2c] text-white font-semibold rounded-xl shadow-2xs"
                                  onClick={() => navigate(`/chat/${res.chatId}`)}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Open Chat
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs h-9 px-3.5 border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] rounded-xl shadow-2xs"
                                  onClick={() => navigate(`/listing/${res.listingId}`)}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Item
                                </Button>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* VIEW 4: WISHLIST / SAVED ITEMS */}
            {activeTab === 'saved' && (
              <div className="space-y-6">
                
                {/* Filter Pills */}
                {mySavedListings.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap border-b border-[#dedcd4] pb-4" role="group" aria-label="Filter saved items by type">
                    <button
                      type="button"
                      onClick={() => setSavedListingTypeFilter('All')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                        savedListingTypeFilter === 'All'
                          ? "bg-[#edf1ec] text-[#204b39] border border-[#204b39]/40 font-semibold shadow-2xs"
                          : "bg-white text-[#555d56] border border-[#dedcd4] hover:border-zinc-400 hover:text-[#252b27]"
                      )}
                      aria-pressed={savedListingTypeFilter === 'All'}
                    >
                      All saved ({mySavedListings.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setSavedListingTypeFilter('Sale')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                        savedListingTypeFilter === 'Sale'
                          ? "bg-[#edf1ec] text-[#204b39] border border-[#204b39]/40 font-semibold shadow-2xs"
                          : "bg-white text-[#555d56] border border-[#dedcd4] hover:border-zinc-400 hover:text-[#252b27]"
                      )}
                      aria-pressed={savedListingTypeFilter === 'Sale'}
                    >
                      For Sale ({mySavedListings.filter(l => l.type === 'Sale').length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setSavedListingTypeFilter('Donate')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                        savedListingTypeFilter === 'Donate'
                          ? "bg-[#edf1ec] text-[#204b39] border border-[#204b39]/40 font-semibold shadow-2xs"
                          : "bg-white text-[#555d56] border border-[#dedcd4] hover:border-zinc-400 hover:text-[#252b27]"
                      )}
                      aria-pressed={savedListingTypeFilter === 'Donate'}
                    >
                      Donate ({mySavedListings.filter(l => l.type === 'Donate').length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setSavedListingTypeFilter('Exchange')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                        savedListingTypeFilter === 'Exchange'
                          ? "bg-[#edf1ec] text-[#204b39] border border-[#204b39]/40 font-semibold shadow-2xs"
                          : "bg-white text-[#555d56] border border-[#dedcd4] hover:border-zinc-400 hover:text-[#252b27]"
                      )}
                      aria-pressed={savedListingTypeFilter === 'Exchange'}
                    >
                      Exchange ({mySavedListings.filter(l => l.type === 'Exchange').length})
                    </button>
                  </div>
                )}

                {/* Loading state */}
                {listingsLoading && mySavedListings.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-2xl border border-[#dedcd4] bg-white overflow-hidden p-4 space-y-4 shadow-xs">
                        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-6 w-1/4" />
                          <Skeleton className="h-3.5 w-1/2" />
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-[#dedcd4]/60">
                          <Skeleton className="h-9 flex-1 rounded-xl" />
                          <Skeleton className="h-9 w-20 rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : mySavedListings.length === 0 ? (
                  /* Empty state when no items saved */
                  <div className="rounded-2xl border border-dashed border-[#dedcd4] bg-white p-12 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-[#edf1ec] flex items-center justify-center mb-3 text-[#204b39] mx-auto">
                      <Bookmark className="h-6 w-6 text-[#204b39]" />
                    </div>
                    <h3 className="text-base font-bold text-[#252b27]">No saved items yet</h3>
                    <p className="text-xs text-[#717870] mt-1 mb-5 max-w-sm mx-auto leading-relaxed">
                      Items you bookmark while exploring the campus marketplace will appear here for easy access later.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/marketplace')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white px-4 py-2.5 text-xs font-medium transition-colors shadow-xs cursor-pointer"
                    >
                      Browse marketplace
                    </button>
                  </div>
                ) : filteredSavedListings.length === 0 ? (
                  /* Empty state when filter matches 0 items */
                  <div className="rounded-2xl border border-dashed border-[#dedcd4] bg-white p-12 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-[#edf1ec] flex items-center justify-center mb-3 text-[#204b39] mx-auto">
                      <Bookmark className="h-6 w-6 text-[#204b39]" />
                    </div>
                    <h3 className="text-base font-bold text-[#252b27]">No {savedListingTypeFilter === 'Sale' ? 'For Sale' : savedListingTypeFilter} items saved</h3>
                    <p className="text-xs text-[#717870] mt-1 mb-5 max-w-sm mx-auto leading-relaxed">
                      None of your saved campus items match the selected filter.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSavedListingTypeFilter('All')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#dedcd4] bg-white hover:bg-zinc-50 text-[#252b27] px-4 py-2 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                      >
                        Show all saved ({mySavedListings.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/marketplace')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white px-4 py-2.5 text-xs font-medium transition-colors shadow-xs cursor-pointer"
                      >
                        Browse marketplace
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 2-Column Responsive Saved Items Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredSavedListings.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[#dedcd4] bg-white overflow-hidden shadow-xs hover:border-[#204b39]/30 transition-all flex flex-col"
                      >
                        {/* 16:10 Aspect Ratio Image Container */}
                        <div className="relative aspect-[16/10] bg-zinc-100 overflow-hidden">
                          {item.images && item.images.length > 0 ? (
                            <img
                              src={item.images[0]}
                              alt={item.title}
                              className="h-full w-full object-cover transition-transform duration-300 hover:scale-102"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-zinc-400">
                              <Package className="h-8 w-8" />
                            </div>
                          )}
                          
                          {/* Type Badge */}
                          <div className="absolute top-3 left-3">
                            <span className="rounded-full bg-[#edf1ec] px-2.5 py-1 text-xs font-semibold text-[#204b39] border border-[#dedcd4]/80 shadow-2xs">
                              {item.type === 'Sale' ? 'For Sale' : item.type}
                            </span>
                          </div>

                          {/* Heart / Save Control */}
                          <div className="absolute top-3 right-3">
                            <button
                              type="button"
                              onClick={() => toggleSaveListing(item.id)}
                              className="rounded-full bg-white/95 p-2 text-rose-600 hover:text-rose-700 hover:bg-white shadow-2xs transition-colors cursor-pointer"
                              aria-label={`Remove ${item.title} from wishlist`}
                              title="Remove from wishlist"
                            >
                              <Heart className="h-4 w-4 fill-rose-600 text-rose-600 stroke-[1.75]" />
                            </button>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-semibold text-base text-[#252b27] line-clamp-1" title={item.title}>
                              {item.title}
                            </h3>
                            <p className="text-xs text-[#717870] mt-1">
                              {item.condition || 'Lightly used'} · {item.category}
                            </p>
                            <p className="text-lg font-bold text-[#252b27] mt-2">
                              {item.type === 'Donate' ? 'Free' : item.price != null ? formatCurrency(item.price) : 'Exchange'}
                            </p>
                            <p className="text-xs text-[#717870] mt-1">
                              {item.location || 'MIT Campus · Student-chosen meetup'}
                            </p>
                          </div>

                          {/* Action Buttons Row */}
                          <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[#dedcd4]/60">
                            <button
                              type="button"
                              onClick={() => navigate(`/listing/${item.id}`)}
                              className="flex-1 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white py-2.5 text-xs font-medium transition-colors shadow-2xs text-center inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              View item
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSaveListing(item.id)}
                              className="rounded-xl border border-[#dedcd4] bg-white hover:bg-red-50 text-[#555d56] hover:text-red-600 px-3.5 py-2.5 text-xs font-medium transition-colors shadow-2xs text-center cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

        </main>

        {/* Page Footer */}
        <footer className="mt-16 pt-8 border-t border-[#dedcd4]/80 text-center text-xs text-[#717870]">
          StudentNeed · MIT Campus, Anna University · Campus meetups only
        </footer>

        {/* Cancel Listing Confirmation Modal */}
        {listingToCancel && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-listing-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#dedcd4] space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 rounded-2xl shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 id="cancel-listing-title" className="text-lg font-bold text-[#252b27]">Cancel Listing?</h3>
                  <p className="text-xs text-[#717870]">Item will be withdrawn from marketplace</p>
                </div>
              </div>
              
              <p className="text-sm text-[#555d56] leading-relaxed">
                Are you sure you want to cancel &ldquo;<strong className="text-[#252b27]">{listingToCancel.title}</strong>&rdquo;? It will be removed from the public marketplace feed and kept in your history as cancelled.
              </p>
              
              {listingCancelError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                  {listingCancelError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setListingToCancel(null);
                    setListingCancelError(null);
                  }} 
                  disabled={isCancellingListing}
                >
                  Keep Listing
                </Button>
                <Button 
                  variant="destructive" 
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold" 
                  disabled={isCancellingListing}
                  onClick={handleConfirmCancelListing}
                >
                  {isCancellingListing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cancelling...
                    </span>
                  ) : (
                    'Confirm Cancel'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Listing Modal */}
        {listingToEdit && (
          <EditListingModal
            listing={listingToEdit}
            isOpen={!!listingToEdit}
            onClose={() => setListingToEdit(null)}
            onSuccess={() => setListingToEdit(null)}
          />
        )}

        {/* Delete Account Confirmation Modal */}
        {showDeleteAccountModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="delete-account-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#dedcd4] space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 rounded-2xl shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 id="delete-account-title" className="text-lg font-bold text-[#252b27]">Delete Account?</h3>
                  <p className="text-xs text-[#717870]">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-[#555d56] leading-relaxed">
                Deleting your account will permanently purge your student profile, all active and expired listings, remove uploaded photos, and cancel any pending reservations.
              </p>

              {deleteAccountError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                  {deleteAccountError}
                </div>
              )}

              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#252b27] mb-1.5">
                    Type your institutional email <span className="font-mono text-red-600 select-all font-semibold">{currentUser?.email}</span> to confirm:
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder={currentUser?.email || ''}
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    className="border-[#dedcd4]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeletingAccount}
                    onClick={() => {
                      setShowDeleteAccountModal(false);
                      setDeleteAccountError(null);
                      setDeleteConfirmEmail('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isDeletingAccount || deleteConfirmEmail.trim().toLowerCase() !== currentUser?.email?.toLowerCase()}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    {isDeletingAccount ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Permanently Delete'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
