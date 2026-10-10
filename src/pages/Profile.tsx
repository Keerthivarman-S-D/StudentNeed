import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  LogOut, 
  Star, 
  Package, 
  Bookmark, 
  Settings, 
  UserCircle2, 
  Upload, 
  Check, 
  Loader2,
  BookmarkCheck,
  Clock,
  MapPin,
  MessageSquare,
  ExternalLink,
  Inbox,
  AlertCircle,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Edit3,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Camera,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';
import { formatCurrency, cn } from '../lib/utils';
import { ListingCard } from '../components/ListingCard';
import { EditListingModal } from '../components/EditListingModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Reservation, Listing } from '../types';
import { AUTH_ENDPOINTS } from '../config/api';
import { validatePassword } from '../lib/passwordSecurity';
import { PasswordRequirements } from '../components/PasswordRequirements';

export function Profile({ defaultTab }: { defaultTab?: 'listings' | 'reserved' | 'saved' | 'settings' } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { listings, savedListings, users, cancelListing } = useAppContext();
  const { currentUser, firebaseUser, logout } = useAuth();
  
  const initialTab = defaultTab || (searchParams.get('tab') as any) || 'listings';
  const [activeTab, setActiveTab] = useState<'listings' | 'reserved' | 'saved' | 'settings'>(initialTab);
  const [reservedSubView, setReservedSubView] = useState<'outgoing' | 'incoming'>('outgoing');

  // Listings Management State
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'completed' | 'expired' | 'cancelled'>('all');
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
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const newPasswordValidation = validatePassword(newPassword);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageMessage, setImageMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name);
      setEditDept(currentUser.department);
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="h-16 w-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-4 shadow-2xs">
          <UserCircle2 className="h-9 w-9 text-zinc-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Not signed in</h2>
        <p className="text-zinc-500 mb-6 max-w-sm text-sm">
          Sign in to your verified student account to manage listings, track active reservations, and view saved items.
        </p>
        <Button onClick={() => navigate('/login')}>Sign in</Button>
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

  const filteredMyListings = myListings.filter(l => {
    const isExpired = l.status === 'expired' || (Boolean(l.expiresAt) && new Date(l.expiresAt!).getTime() <= Date.now());
    if (listingFilter === 'active') {
      return (l.status === 'available' || l.status === 'active' || l.status === 'reserved') && !isExpired;
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
      const res = await fetch('/api/account/delete', {
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
        name: editName,
        department: editDept
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
      const idToken = await firebaseUser.getIdToken();
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
      setNewPassword('');
      setConfirmNewPassword('');
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
      setImageMessage({ type: 'success', text: 'Profile image updated successfully.' });
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      setImageMessage({ type: 'error', text: 'Failed to upload photo. Please try again.' });
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = ''; // Reset input
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header Card */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start justify-between">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            {/* Avatar with Upload Affordance */}
            <div className="relative group shrink-0">
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-4 border-white shadow-md bg-zinc-100 ring-1 ring-zinc-200"
                />
              ) : (
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-brand-charcoal text-white flex items-center justify-center text-3xl font-bold border-4 border-white shadow-md ring-1 ring-zinc-200">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              
              <label 
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2"
                title="Change profile photo"
                aria-label="Change profile photo"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
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

            {/* Student Info & Stats */}
            <div className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-bold text-brand-charcoal tracking-tight">{currentUser.name}</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Verified Student
                  </span>
                </div>
                <p className="text-sm text-zinc-600 mt-1 font-medium">
                  {currentUser.department} • <span className="text-zinc-500">{currentUser.campus}</span>
                </p>
              </div>
              
              {/* Stats badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>{currentUser.rating} Rating</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                  <Package className="h-4 w-4 text-emerald-700" />
                  <span>{currentUser.exchangesCompleted} Exchanges</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                  <Layers className="h-4 w-4 text-zinc-500" />
                  <span>{myListings.length} Listings</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sign Out CTA */}
          <Button 
            variant="outline" 
            className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50 hover:border-red-300 border-red-200 shrink-0 font-medium" 
            onClick={handleLogout}
            aria-label="Sign out of account"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>

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

      {/* Modern Tabs Navigation Bar */}
      <div className="border-b border-brand-border mb-8 overflow-x-auto no-scrollbar" role="tablist" aria-label="Profile Sections">
        <nav className="-mb-px flex space-x-2 sm:space-x-6 min-w-max">
          {/* My Listings */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'listings'}
            onClick={() => setActiveTab('listings')}
            className={cn(
              "whitespace-nowrap border-b-2 py-3.5 px-3 text-sm font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-t-lg",
              activeTab === 'listings'
                ? "border-emerald-700 text-emerald-900 font-bold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            )}
          >
            <Package className="h-4 w-4" />
            <span>My Listings</span>
            <span className={cn(
              "ml-0.5 rounded-full px-2 py-0.5 text-xs font-bold",
              activeTab === 'listings'
                ? "bg-emerald-100 text-emerald-900"
                : "bg-zinc-100 text-zinc-600"
            )}>
              {myListings.length}
            </span>
          </button>

          {/* Reserved Items */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reserved'}
            onClick={() => setActiveTab('reserved')}
            className={cn(
              "whitespace-nowrap border-b-2 py-3.5 px-3 text-sm font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-t-lg",
              activeTab === 'reserved'
                ? "border-emerald-700 text-emerald-900 font-bold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            )}
          >
            <BookmarkCheck className="h-4 w-4" />
            <span>Reserved Items</span>
            {activeReservationsCount > 0 && (
              <span className="ml-0.5 rounded-full bg-emerald-600 text-white px-2 py-0.5 text-xs font-bold shadow-2xs">
                {activeReservationsCount}
              </span>
            )}
          </button>

          {/* Saved Items */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'saved'}
            onClick={() => setActiveTab('saved')}
            className={cn(
              "whitespace-nowrap border-b-2 py-3.5 px-3 text-sm font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-t-lg",
              activeTab === 'saved'
                ? "border-emerald-700 text-emerald-900 font-bold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            )}
          >
            <Bookmark className="h-4 w-4" />
            <span>Saved Items</span>
            <span className={cn(
              "ml-0.5 rounded-full px-2 py-0.5 text-xs font-bold",
              activeTab === 'saved'
                ? "bg-emerald-100 text-emerald-900"
                : "bg-zinc-100 text-zinc-600"
            )}>
              {mySavedListings.length}
            </span>
          </button>

          {/* Account Settings */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            className={cn(
              "whitespace-nowrap border-b-2 py-3.5 px-3 text-sm font-semibold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-t-lg",
              activeTab === 'settings'
                ? "border-emerald-700 text-emerald-900 font-bold"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            )}
          >
            <Settings className="h-4 w-4" />
            <span>Account Settings</span>
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="min-h-[420px]">
        {/* TAB 1: RESERVED ITEMS */}
        {activeTab === 'reserved' && (
          <div className="space-y-6">
            {/* Sub-view switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/70 pb-4">
              <div className="inline-flex rounded-xl bg-zinc-100 p-1 border border-zinc-200/60 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setReservedSubView('outgoing')}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                    reservedSubView === 'outgoing'
                      ? "bg-white text-emerald-900 shadow-xs border border-zinc-200"
                      : "text-zinc-600 hover:text-zinc-900"
                  )}
                >
                  Items I Reserved ({myReservations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReservedSubView('incoming')}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                    reservedSubView === 'incoming'
                      ? "bg-white text-emerald-900 shadow-xs border border-zinc-200"
                      : "text-zinc-600 hover:text-zinc-900"
                  )}
                >
                  Incoming Requests ({incomingReservations.length})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-600 bg-amber-50/80 border border-amber-200/60 rounded-xl px-3 py-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span>Reserved items are held while students coordinate meetup</span>
              </div>
            </div>

            {/* Content List */}
            {(() => {
              const currentList = reservedSubView === 'outgoing' ? myReservations : incomingReservations;

              if (isLoadingReservations) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
                        <div className="flex gap-4">
                          <Skeleton className="h-24 w-24 rounded-xl" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3.5 w-1/2" />
                          </div>
                        </div>
                        <Skeleton className="h-9 w-full rounded-xl" />
                      </div>
                    ))}
                  </div>
                );
              }

              if (currentList.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/60 py-20 text-center px-4">
                    <div className="h-14 w-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4 text-zinc-400">
                      <BookmarkCheck className="h-7 w-7 text-zinc-400" />
                    </div>
                    <h3 className="text-base font-bold text-zinc-900">
                      {reservedSubView === 'outgoing' ? 'No items reserved yet' : 'No incoming requests yet'}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1.5 mb-6 max-w-md leading-relaxed">
                      {reservedSubView === 'outgoing'
                        ? 'When you request to hold or trade an item with another student, it will appear here.'
                        : 'When other campus members request to reserve your listings, their requests will appear here.'}
                    </p>
                    {reservedSubView === 'outgoing' && (
                      <Button onClick={() => navigate('/marketplace')} variant="outline">
                        Explore Marketplace
                      </Button>
                    )}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentList.map((res) => {
                    const item = listings.find((l) => l.id === res.listingId);
                    const counterpartId = reservedSubView === 'outgoing' ? res.sellerId : res.buyerId;
                    const counterpart = users.find((u) => u.id === counterpartId);

                    return (
                      <div
                        key={res.id}
                        className="flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-zinc-300 transition-all gap-4"
                      >
                        <div className="flex gap-4">
                          {/* Item Thumbnail */}
                          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100 border border-zinc-200">
                            {item?.images && item.images.length > 0 ? (
                              <img
                                src={item.images[0]}
                                alt={item?.title || 'Listing image'}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                <Package className="h-6 w-6" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex flex-1 flex-col justify-between min-w-0">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-zinc-900 truncate text-sm sm:text-base">
                                  {item?.title || 'Campus Item'}
                                </h4>
                                
                                {/* Status badge */}
                                {res.status === 'accepted' && (
                                  <Badge variant="success" className="gap-1 flex-shrink-0">
                                    <Check className="h-3 w-3" /> Reserved
                                  </Badge>
                                )}
                                {res.status === 'pending' && (
                                  <Badge variant="warning" className="gap-1 flex-shrink-0">
                                    <Clock className="h-3 w-3" /> Pending
                                  </Badge>
                                )}
                                {res.status === 'rejected' && (
                                  <Badge variant="secondary" className="gap-1 text-zinc-600 flex-shrink-0">
                                    Declined
                                  </Badge>
                                )}
                                {res.status === 'completed' && (
                                  <Badge variant="default" className="gap-1 flex-shrink-0 bg-blue-700 text-white">
                                    Completed
                                  </Badge>
                                )}
                                {res.status === 'cancelled' && (
                                  <Badge variant="destructive" className="gap-1 flex-shrink-0">
                                    Cancelled
                                  </Badge>
                                )}
                              </div>

                              <p className="mt-1 font-extrabold text-zinc-900 text-base">
                                {item ? formatCurrency(item.price) : '—'}
                              </p>
                            </div>

                            {/* Counterpart Student Info */}
                            <div className="mt-2 text-xs text-zinc-600">
                              <span>
                                {reservedSubView === 'outgoing' ? 'Seller' : 'Buyer'}:{' '}
                                <strong className="text-zinc-900 font-semibold">
                                  {counterpart?.name || (reservedSubView === 'outgoing' ? 'Campus Seller' : 'Student Buyer')}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Meetup status if available */}
                        {res.meetup && (
                          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs border border-zinc-200/80">
                            <MapPin className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                            <span className="font-semibold text-zinc-900 truncate">
                              Meetup: {typeof res.meetup.location === 'object' ? (res.meetup.location as any)?.name : res.meetup.location}
                            </span>
                            <span className="ml-auto capitalize text-[10px] font-bold text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                              {res.meetup.status}
                            </span>
                          </div>
                        )}

                        {/* Card Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 mt-auto">
                          <Button
                            size="sm"
                            className="flex-1 gap-1.5 text-xs h-9 bg-brand-teal hover:bg-brand-teal-hover text-white font-semibold"
                            onClick={() => navigate(`/chat/${res.chatId}`)}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Open Chat
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-9 px-3"
                            onClick={() => navigate(`/listing/${res.listingId}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Item
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: MY LISTINGS */}
        {activeTab === 'listings' && (
          <div className="space-y-6">
            {myListings.length > 0 ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-4">
                  {/* Status Filters */}
                  <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter listings by status">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-1">Status:</span>
                    <button
                      type="button"
                      onClick={() => setListingFilter('all')}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                        listingFilter === 'all'
                          ? "bg-brand-charcoal text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
                      )}
                    >
                      All ({myListings.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('active')}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                        listingFilter === 'active'
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
                      )}
                    >
                      Active ({myListings.filter(l => (l.status === 'available' || l.status === 'active' || l.status === 'reserved') && !(Boolean(l.expiresAt) && new Date(l.expiresAt!).getTime() <= Date.now())).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('completed')}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                        listingFilter === 'completed'
                          ? "bg-blue-700 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
                      )}
                    >
                      Completed ({myListings.filter(l => l.status === 'completed').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('expired')}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                        listingFilter === 'expired'
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
                      )}
                    >
                      Expired ({myListings.filter(l => l.status !== 'cancelled' && l.status !== 'completed' && (l.status === 'expired' || (Boolean(l.expiresAt) && new Date(l.expiresAt!).getTime() <= Date.now()))).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('cancelled')}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
                        listingFilter === 'cancelled'
                          ? "bg-red-700 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
                      )}
                    >
                      Cancelled ({myListings.filter(l => l.status === 'cancelled').length})
                    </button>
                  </div>

                  <Button size="sm" onClick={() => navigate('/create-listing')} className="shrink-0 gap-1.5">
                    <span>Post an Item</span>
                  </Button>
                </div>

                {filteredMyListings.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/60 py-16 text-center">
                    <p className="text-sm font-medium text-zinc-500">No {listingFilter} listings found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredMyListings.map(listing => {
                      const isExpired = listing.status === 'expired' || (Boolean(listing.expiresAt) && new Date(listing.expiresAt!).getTime() <= Date.now());
                      const isCompleted = listing.status === 'completed';
                      const isCancelled = listing.status === 'cancelled';
                      const isReserved = listing.status === 'reserved';

                      return (
                        <div key={listing.id} className="flex flex-col group">
                          <ListingCard listing={listing} />
                          
                          {/* Owner Action & Status Footer */}
                          <div className="mt-2.5 flex items-center justify-between px-1.5 py-1 rounded-xl bg-zinc-50/80 border border-zinc-200/60 text-xs">
                            <span className={cn(
                              "font-bold text-[11px]",
                              isCancelled
                                ? "text-red-700"
                                : isCompleted
                                ? "text-blue-700"
                                : isExpired
                                ? "text-amber-800"
                                : isReserved
                                ? "text-purple-700"
                                : "text-emerald-800"
                            )}>
                              {isCancelled
                                ? '• Cancelled'
                                : isCompleted
                                ? '• Completed'
                                : isExpired
                                ? '• Expired'
                                : isReserved
                                ? '• Reserved'
                                : '• Active'}
                            </span>

                            {isCompleted ? (
                              <span className="text-[11px] text-blue-800 font-semibold">Exchange completed</span>
                            ) : isCancelled ? (
                              <span className="text-[11px] text-zinc-500 font-medium">Preserved in history</span>
                            ) : (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setListingToEdit(listing)}
                                  className="text-xs text-zinc-800 hover:text-emerald-800 font-bold flex items-center gap-1 focus-visible:outline-none focus-visible:underline transition-colors"
                                  aria-label={`Edit ${listing.title}`}
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setListingToCancel(listing)}
                                  className="text-xs text-red-700 hover:text-red-800 font-bold focus-visible:outline-none focus-visible:underline transition-colors"
                                  aria-label={`Cancel post for ${listing.title}`}
                                >
                                  Cancel Post
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/60 py-24 text-center px-4">
                <div className="h-14 w-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4 text-zinc-400">
                  <Package className="h-7 w-7 text-zinc-400" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">No listings yet</h3>
                <p className="text-sm text-zinc-500 mt-1 mb-6 max-w-sm leading-relaxed">
                  You haven&apos;t posted any items yet. Start by offering something you don&apos;t need to other students.
                </p>
                <Button onClick={() => navigate('/create-listing')}>Post an Item</Button>
              </div>
            )}

            {/* Cancel Listing Confirmation Modal */}
            {listingToCancel && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-listing-title"
              >
                <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
                  <div className="flex items-center gap-3 text-red-600">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 shrink-0">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <h3 id="cancel-listing-title" className="text-lg font-bold text-zinc-900">Cancel Listing?</h3>
                      <p className="text-xs text-zinc-500">Item will be withdrawn from marketplace</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Are you sure you want to cancel &ldquo;<strong className="text-zinc-900">{listingToCancel.title}</strong>&rdquo;? It will be removed from the public marketplace feed and kept in your history as cancelled.
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
          </div>
        )}

        {/* TAB 3: SAVED ITEMS */}
        {activeTab === 'saved' && (
          <div>
            {mySavedListings.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mySavedListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/60 py-24 text-center px-4">
                <div className="h-14 w-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4 text-zinc-400">
                  <Bookmark className="h-7 w-7 text-zinc-400" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">No saved items</h3>
                <p className="text-sm text-zinc-500 mt-1 mb-6 max-w-sm leading-relaxed">
                  Items you save while exploring the marketplace will appear here for quick access.
                </p>
                <Button onClick={() => navigate('/marketplace')} variant="outline">Explore Marketplace</Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACCOUNT SETTINGS */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-5xl">
            {/* Left Column: Personal Info & Avatar */}
            <div className="space-y-8">
              {/* Personal Information */}
              <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-brand-charcoal">Personal Information</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Manage your student profile details</p>
                </div>
                
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
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">College Email</label>
                    <Input value={currentUser.email} disabled className="bg-zinc-50 text-zinc-500 cursor-not-allowed" />
                    <p className="mt-1.5 text-xs text-zinc-500">Official college email cannot be changed.</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">Full Name</label>
                    <Input 
                      required 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">Department</label>
                    <select 
                      className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-3.5 py-2 text-sm text-brand-charcoal font-medium focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all shadow-2xs"
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                    >
                      <option>Computer Science</option>
                      <option>Electronics</option>
                      <option>Mechanical</option>
                      <option>Information Technology</option>
                      <option>Aeronautical</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <Button type="submit" disabled={isSavingProfile} className="w-full h-11">
                    {isSavingProfile ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Changes...
                      </span>
                    ) : (
                      'Save Profile Changes'
                    )}
                  </Button>
                </form>
              </div>

              {/* Profile Image Settings */}
              <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-brand-charcoal">Profile Image</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Upload a clear photo to help classmates identify you</p>
                </div>
                
                <div className="flex items-center gap-5">
                  {currentUser.avatarUrl ? (
                    <img 
                      src={currentUser.avatarUrl} 
                      alt="Current Avatar" 
                      className="h-20 w-20 rounded-2xl object-cover border border-zinc-200 bg-zinc-50 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-200 shrink-0 font-bold text-2xl">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 cursor-pointer transition-all shadow-2xs focus-within:ring-2 focus-within:ring-brand-teal">
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Uploading photo...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-emerald-700" />
                          <span>Upload new image</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp" 
                        className="sr-only" 
                        onChange={handleImageUpload} 
                        disabled={isUploadingImage} 
                      />
                    </label>
                    <p className="text-xs text-zinc-500">JPG, JPEG, PNG, or WEBP. Maximum 5MB.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Security & Danger Zone */}
            <div className="space-y-8">
              {/* Password Settings */}
              <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-brand-charcoal">Security & Password</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Update your password to keep your student account safe</p>
                </div>
                
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
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">New Password</label>
                    <div className="relative flex items-center">
                      <Input 
                        type={showNewPassword ? "text" : "password"} 
                        required 
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-0 flex h-full items-center justify-center px-3 text-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:text-zinc-600 transition-colors"
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                        title={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {/* Password requirements checklist & strength meter */}
                    <PasswordRequirements password={newPassword} validation={newPasswordValidation} className="mt-2.5" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">Confirm New Password</label>
                    <div className="relative flex items-center">
                      <Input 
                        type={showConfirmNewPassword ? "text" : "password"} 
                        required 
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                        className="absolute right-0 flex h-full items-center justify-center px-3 text-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:text-zinc-600 transition-colors"
                        aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                        title={showConfirmNewPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmNewPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                      <p className="text-xs text-rose-600 mt-1.5 font-medium">Passwords do not match.</p>
                    )}
                    {confirmNewPassword.length > 0 && newPassword === confirmNewPassword && (
                      <p className="text-xs text-emerald-700 mt-1.5 font-semibold">Passwords match.</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isSavingPassword || !newPasswordValidation.isValid || newPassword !== confirmNewPassword}
                    className="w-full h-11 font-semibold"
                  >
                    {isSavingPassword ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating Password...
                      </span>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </form>
              </div>

              {/* Danger Zone: Account Deletion */}
              <div className="rounded-3xl border border-red-200 bg-red-50/50 p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-red-900 flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
                      Danger Zone
                    </h3>
                    <p className="text-xs text-red-700 leading-relaxed max-w-sm">
                      Permanently delete your student account, all published marketplace listings, and remove uploaded photos.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white shrink-0 font-semibold text-xs h-10 px-4"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl shrink-0">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 id="delete-account-title" className="text-lg font-bold text-zinc-900">Delete Account?</h3>
                <p className="text-xs text-zinc-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 leading-relaxed">
              Deleting your account will permanently purge your student profile, all active and expired listings, remove uploaded photos, and cancel any pending reservations.
            </p>

            {deleteAccountError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                {deleteAccountError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Type your institutional email <span className="font-mono text-red-600 select-all font-semibold">{currentUser?.email}</span> to confirm:
                </label>
                <Input
                  type="email"
                  required
                  placeholder={currentUser?.email || ''}
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
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
  );
}
