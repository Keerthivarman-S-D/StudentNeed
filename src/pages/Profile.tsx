import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Star, Package, Bookmark, Settings, UserCircle2, Upload, Check, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth, db, storage } from '../lib/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ListingCard } from '../components/ListingCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function Profile() {
  const navigate = useNavigate();
  const { listings, savedListings } = useAppContext();
  const { currentUser, firebaseUser, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'listings' | 'saved' | 'settings'>('listings');

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
  const mySavedListings = listings.filter(l => savedListings.includes(l.id));

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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setImageMessage({ type: 'error', text: 'Unsupported image format. Please upload JPG, PNG, WEBP, or GIF.' });
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageMessage({ type: 'error', text: 'Image exceeds 5MB limit. Please choose a smaller photo.' });
      if (e.target) e.target.value = '';
      return;
    }
    
    setIsUploadingImage(true);
    setImageMessage({ type: '', text: '' });
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const safeName = `${Date.now()}_avatar.${ext.replace(/[^a-zA-Z0-9]/g, '')}`;
      const avatarStorageRef = ref(storage, `avatars/${firebaseUser.uid}/${safeName}`);

      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: firebaseUser.uid
        }
      };

      const uploadResult = await uploadBytes(avatarStorageRef, file, metadata);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        avatarUrl: downloadUrl
      });
      setImageMessage({ type: 'success', text: 'Profile image updated successfully.' });
    } catch (err: any) {
      console.error('Failed to upload avatar to Storage:', err);
      setImageMessage({ type: 'error', text: err.message || 'Failed to upload image to Firebase Storage.' });
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

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
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
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
        {activeTab === 'listings' && (
          <div>
            {myListings.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {myListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
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
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                    </label>
                    <p className="mt-2 text-xs text-zinc-500">JPG, PNG or GIF. Max 5MB.</p>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
