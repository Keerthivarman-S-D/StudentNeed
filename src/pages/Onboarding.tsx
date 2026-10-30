import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserCircle2, Upload, X } from 'lucide-react';
import { AUTH_ENDPOINTS } from '../config/api';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';

export function Onboarding() {
  const navigate = useNavigate();
  const { firebaseUser, currentUser } = useAuth();
  
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      navigate('/login');
    } else if (currentUser) {
      navigate('/');
    }
  }, [firebaseUser, currentUser, navigate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file.');
        setAvatarFile(null);
        setAvatarPreview('');
        e.target.value = '';
        return;
      }
      setError(null);
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setAvatarFile(null);
      setAvatarPreview('');
    }
  };

  const handleRemovePhoto = () => {
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use uploaded image or generate default avatar using initials
      let finalAvatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=000000`;
      
      if (avatarFile) {
        try {
          const secureUrl = await uploadImageToCloudinary(avatarFile, {
            folder: 'studentneed/avatars',
          });
          finalAvatarUrl = secureUrl;
        } catch (imgError: any) {
          console.error("Failed to upload avatar to Cloudinary:", imgError);
          setError(imgError.message || "Failed to upload photo. Please select a valid JPG, PNG, or WEBP image under 5MB.");
          setIsLoading(false);
          return;
        }
      }
      
      const idToken = await firebaseUser.getIdToken();
      
      const response = await fetch(AUTH_ENDPOINTS.finalizeAccount, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name,
          department,
          avatarUrl: finalAvatarUrl,
          idToken
        })
      });

      if (!response.ok) {
        let errMessage = "Failed to finalize account setup.";
        try {
          const text = await response.text();
          const data = JSON.parse(text);
          errMessage = data.error || errMessage;
        } catch (e) {
          errMessage = `Server error ${response.status}`;
        }
        throw new Error(errMessage);
      }
      // AuthContext's onSnapshot will pick this up from Firestore, set currentUser, and trigger the useEffect redirect
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while saving your profile.");
      setIsLoading(false);
    }
  };

  if (!firebaseUser || currentUser) return null;

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] border border-[#dedcd4] shadow-2xs mb-3">
            <UserCircle2 className="h-7 w-7 text-[#204b39]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
            Complete your profile
          </h2>
          <p className="text-sm text-[#555d56] max-w-sm mx-auto">
            Tell us a bit about yourself so peers across campus know who they are exchanging with.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-[#dedcd4] bg-white p-6 sm:p-7 shadow-xs space-y-5">
              {error && (
                <div className="p-3 text-xs sm:text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#252b27] uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-[#dedcd4] focus:border-[#204b39] focus:ring-[#204b39]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252b27] uppercase tracking-wider mb-1.5">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  className="flex h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-3.5 py-2 text-sm text-[#252b27] font-medium focus:border-[#204b39] focus:outline-none focus:ring-2 focus:ring-[#204b39]/20 transition-all shadow-2xs"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option>Computer Science</option>
                  <option>Electronics</option>
                  <option>Mechanical</option>
                  <option>Information Technology</option>
                  <option>Aeronautical</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252b27] uppercase tracking-wider mb-1.5">
                  Profile picture <span className="text-[#555d56] font-normal lowercase">(optional)</span>
                </label>

                <div className="mt-2 flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#f4f3ee] border border-[#dedcd4] flex items-center justify-center">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle2 className="h-8 w-8 text-[#555d56]" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dedcd4] bg-white text-xs font-semibold text-[#252b27] hover:border-[#204b39] hover:text-[#204b39] hover:bg-[#edf1ec] transition-all shadow-2xs">
                        <Upload className="h-3.5 w-3.5 text-[#204b39]" />
                        <span>{avatarPreview ? 'Change photo' : 'Upload photo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </label>

                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[#555d56]">
                      JPG, PNG, or WEBP up to 5MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center rounded-xl bg-[#204b39] hover:bg-[#183a2c] py-3 text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Saving profile...' : 'Complete Registration'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => auth.signOut()}
                  className="text-xs text-[#555d56] hover:text-[#252b27] hover:underline"
                >
                  Sign out and start over
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
