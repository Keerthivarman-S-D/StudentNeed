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
  Edit3
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';
import { ListingCard } from '../components/ListingCard';
import { EditListingModal } from '../components/EditListingModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Reservation, Listing } from '../types';

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
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Not signed in</h2>
        <p className="text-zinc-500 mb-6">Sign in to view your profile and manage your items.</p>
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
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setIsSavingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await updatePassword(firebaseUser, newPassword);
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
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
      console.error('Failed to upload avatar to Cloudinary:', err);
      setImageMessage({ type: 'error', text: err.message || 'Failed to upload image to Cloudinary.' });
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 mb-8 flex flex-col md:flex-row gap-6 items-center md:items-start justify-between">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          <div className="relative group">
            <img 
              src={currentUser.avatarUrl} 
              alt={currentUser.name} 
              className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md bg-zinc-100"
            />
            {activeTab === 'settings' && (
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Upload className="h-6 w-6" />
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
              </label>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{currentUser.name}</h1>
            <p className="text-zinc-500 mt-1">{currentUser.department} • {currentUser.campus}</p>
            
            <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 px-3 py-1.5 rounded-lg">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                {currentUser.rating} Rating
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 px-3 py-1.5 rounded-lg">
                <Package className="h-4 w-4 text-zinc-500" />
                {currentUser.exchangesCompleted} Exchanges
              </div>
            </div>
          </div>
        </div>
        
        <Button variant="outline" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 mb-6 overflow-x-auto">
        <nav className="-mb-px flex space-x-8 min-w-max">
          <button
            onClick={() => setActiveTab('listings')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'listings'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
            }`}
          >
            My Listings ({myListings.length})
          </button>
          <button
            onClick={() => setActiveTab('reserved')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'reserved'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
            }`}
          >
            <BookmarkCheck className="h-4 w-4" />
            Reserved Items ({myReservations.filter(r => r.status === 'pending' || r.status === 'accepted').length + incomingReservations.filter(r => r.status === 'pending' || r.status === 'accepted').length})
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'saved'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
            }`}
          >
            Saved Items ({mySavedListings.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
            }`}
          >
            <Settings className="h-4 w-4" />
            Account Settings
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'reserved' && (
          <div className="space-y-6">
            {/* Sub-view switcher */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="inline-flex rounded-xl bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => setReservedSubView('outgoing')}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                    reservedSubView === 'outgoing'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Items I Reserved ({myReservations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReservedSubView('incoming')}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                    reservedSubView === 'incoming'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Incoming Requests ({incomingReservations.length})
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Reserved items are held while students coordinate meetup</span>
              </div>
            </div>

            {/* List */}
            {(() => {
              const currentList = reservedSubView === 'outgoing' ? myReservations : incomingReservations;

              if (isLoadingReservations) {
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-zinc-600" />
                    <p className="text-sm font-medium">Loading reservations...</p>
                  </div>
                );
              }

              if (currentList.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-20 text-center px-4">
                    <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3 text-zinc-400">
                      <BookmarkCheck className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900">
                      {reservedSubView === 'outgoing' ? 'No items reserved yet' : 'No incoming requests yet'}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1 mb-5 max-w-sm">
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
                        className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300 transition-all gap-4"
                      >
                        <div className="flex gap-4">
                          {/* Image */}
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
                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-semibold text-zinc-900 line-clamp-1 text-sm sm:text-base">
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
                                  <Badge variant="outline" className="gap-1 text-zinc-500 flex-shrink-0">
                                    Declined
                                  </Badge>
                                )}
                                {res.status === 'completed' && (
                                  <Badge variant="default" className="gap-1 flex-shrink-0 bg-blue-600">
                                    Completed
                                  </Badge>
                                )}
                              </div>

                              <p className="mt-1 font-bold text-zinc-900 text-sm">
                                {item ? (item.price === 0 ? 'Free' : `$${item.price}`) : '—'}
                              </p>
                            </div>

                            {/* Counterpart info */}
                            <div className="mt-2 text-xs text-zinc-500">
                              <span>
                                {reservedSubView === 'outgoing' ? 'Seller' : 'Buyer'}:{' '}
                                <strong className="text-zinc-700 font-medium">
                                  {counterpart?.name || (reservedSubView === 'outgoing' ? 'Campus Seller' : 'Student Buyer')}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Meetup status if available */}
                        {res.meetup && (
                          <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs border border-zinc-100">
                            <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="font-medium text-zinc-800 line-clamp-1">
                              Meetup: {typeof res.meetup.location === 'object' ? (res.meetup.location as any)?.name : res.meetup.location}
                            </span>
                            <span className="ml-auto capitalize text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                              {res.meetup.status}
                            </span>
                          </div>
                        )}

                        {/* Card Actions */}
                        <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 mt-auto">
                          <Button
                            size="sm"
                            className="flex-1 gap-1.5 text-xs h-9"
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
        {activeTab === 'listings' && (
          <div className="space-y-6">
            {myListings.length > 0 ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status:</span>
                    <button
                      type="button"
                      onClick={() => setListingFilter('all')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        listingFilter === 'all'
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      All ({myListings.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('active')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        listingFilter === 'active'
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      Active ({myListings.filter(l => (l.status === 'available' || l.status === 'active' || l.status === 'reserved') && !(Boolean(l.expiresAt) && new Date(l.expiresAt!).getTime() <= Date.now())).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('completed')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        listingFilter === 'completed'
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      Completed ({myListings.filter(l => l.status === 'completed').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('expired')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        listingFilter === 'expired'
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      Expired ({myListings.filter(l => l.status !== 'cancelled' && l.status !== 'completed' && (l.status === 'expired' || (Boolean(l.expiresAt) && new Date(l.expiresAt!).getTime() <= Date.now()))).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingFilter('cancelled')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        listingFilter === 'cancelled'
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      Cancelled ({myListings.filter(l => l.status === 'cancelled').length})
                    </button>
                  </div>
                  <Button size="sm" onClick={() => navigate('/create-listing')}>
                    Post an Item
                  </Button>
                </div>

                {filteredMyListings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
                    <p className="text-sm text-zinc-500">No {listingFilter} listings found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredMyListings.map(listing => {
                      const isExpired = listing.status === 'expired' || (Boolean(listing.expiresAt) && new Date(listing.expiresAt!).getTime() <= Date.now());
                      const isCompleted = listing.status === 'completed';
                      const isCancelled = listing.status === 'cancelled';
                      const isReserved = listing.status === 'reserved';

                      return (
                        <div key={listing.id} className="flex flex-col">
                          <ListingCard listing={listing} />
                          <div className="mt-2 flex items-center justify-between px-1">
                            <span className={`text-xs font-semibold ${
                              isCancelled
                                ? 'text-red-600'
                                : isCompleted
                                ? 'text-blue-600'
                                : isExpired
                                ? 'text-amber-600'
                                : isReserved
                                ? 'text-purple-600'
                                : 'text-emerald-700'
                            }`}>
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
                              <span className="text-[11px] text-blue-700 font-medium">Exchange completed</span>
                            ) : isCancelled ? (
                              <span className="text-[11px] text-zinc-400">Preserved in history</span>
                            ) : (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setListingToEdit(listing)}
                                  className="text-xs text-zinc-700 hover:text-zinc-900 hover:underline font-medium flex items-center gap-1"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setListingToCancel(listing)}
                                  className="text-xs text-red-600 hover:text-red-700 hover:underline font-medium"
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
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-24 text-center">
                <Package className="h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="text-lg font-semibold text-zinc-900">No listings yet</h3>
                <p className="text-sm text-zinc-500 mt-1 mb-6 max-w-sm">
                  You haven't posted any items yet. Start by offering something you don't need.
                </p>
                <Button onClick={() => navigate('/create-listing')}>Post an Item</Button>
              </div>
            )}

            {/* Cancel Listing Confirmation Modal */}
            {listingToCancel && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
                  <div className="flex items-center gap-3 text-red-600">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Cancel Listing?</h3>
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Are you sure you want to cancel &ldquo;{listingToCancel.title}&rdquo;? It will be removed from the public marketplace feed and kept in your history as cancelled.
                  </p>
                  {listingCancelError && (
                    <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
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
                      className="bg-red-600 hover:bg-red-700 text-white font-medium" 
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

        {activeTab === 'saved' && (
          <div>
            {mySavedListings.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mySavedListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-24 text-center">
                <Bookmark className="h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="text-lg font-semibold text-zinc-900">No saved items</h3>
                <p className="text-sm text-zinc-500 mt-1 mb-6 max-w-sm">
                  Items you save while exploring the marketplace will appear here.
                </p>
                <Button onClick={() => navigate('/marketplace')} variant="outline">Explore Marketplace</Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Personal Information */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-900 mb-6">Personal Information</h3>
                
                {profileMessage.text && (
                  <div className={`p-3 mb-4 text-sm rounded-lg border ${profileMessage.type === 'error' ? 'text-red-600 bg-red-50 border-red-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
                    {profileMessage.text}
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                    <Input value={currentUser.email} disabled className="bg-zinc-50 text-zinc-500" />
                    <p className="mt-1 text-xs text-zinc-500">College email cannot be changed.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
                    <Input 
                      required 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Department</label>
                    <select 
                      className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
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

                  <Button type="submit" disabled={isSavingProfile} className="w-full">
                    {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </Button>
                </form>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Profile Image Settings */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-900 mb-6">Profile Image</h3>
                
                {imageMessage.text && (
                  <div className={`p-3 mb-4 text-sm rounded-lg border ${imageMessage.type === 'error' ? 'text-red-600 bg-red-50 border-red-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
                    {imageMessage.text}
                  </div>
                )}

                <div className="flex items-center gap-6">
                  <img 
                    src={currentUser.avatarUrl} 
                    alt="Current Avatar" 
                    className="h-20 w-20 rounded-full object-cover border border-zinc-200 bg-zinc-50"
                  />
                  <div className="flex-1">
                    <label className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors">
                      {isUploadingImage ? (
                        'Uploading...'
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload new image
                        </>
                      )}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                    </label>
                    <p className="mt-2 text-xs text-zinc-500">JPG, JPEG, PNG, or WEBP. Max 5MB.</p>
                  </div>
                </div>
              </div>

              {/* Password Settings */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-900 mb-6">Security</h3>
                
                {passwordMessage.text && (
                  <div className={`p-3 mb-4 text-sm rounded-lg border ${passwordMessage.type === 'error' ? 'text-red-600 bg-red-50 border-red-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
                    {passwordMessage.text}
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">New Password</label>
                    <Input 
                      type="password" 
                      required 
                      minLength={6}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Confirm New Password</label>
                    <Input 
                      type="password" 
                      required 
                      minLength={6}
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" variant="outline" disabled={isSavingPassword} className="w-full">
                    {isSavingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </div>

              {/* Danger Zone: Account Deletion */}
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-red-600" />
                      Danger Zone
                    </h3>
                    <p className="mt-1 text-sm text-red-700">
                      Permanently delete your student account, all published marketplace listings, and remove uploaded photos.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white shrink-0"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Delete Account?</h3>
                <p className="text-xs text-zinc-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 mb-4 leading-relaxed">
              Deleting your account will permanently purge your student profile, all active and expired listings, remove uploaded photos from Cloudinary, and cancel any pending reservations.
            </p>

            {deleteAccountError && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                {deleteAccountError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Type your institutional email <span className="font-mono text-red-600 select-all">{currentUser?.email}</span> to confirm:
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
                  className="bg-red-600 hover:bg-red-700 text-white"
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
