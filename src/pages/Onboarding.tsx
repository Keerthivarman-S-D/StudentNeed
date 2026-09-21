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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file);
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
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal mb-4 border border-brand-teal-border shadow-xs">
            <UserCircle2 className="h-8 w-8 text-brand-teal" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-charcoal">
            Complete your profile
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            Tell us a bit about yourself so other students know who they are trading with.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm border border-brand-border">
            
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-brand-charcoal mb-1">Full Name</label>
              <Input 
                required 
                placeholder="Enter your full name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-charcoal mb-1">Department</label>
              <select 
                className="flex h-10 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all"
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
              <label className="block text-sm font-medium text-brand-charcoal mb-1.5">
                Profile picture <span className="text-brand-muted font-normal">(Optional)</span>
              </label>

              <div className="mt-2 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-100 border border-brand-border flex items-center justify-center">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt="Preview" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="h-8 w-8 text-zinc-400" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border bg-white text-xs font-semibold text-brand-charcoal hover:border-brand-teal hover:text-brand-teal hover:bg-brand-teal-light/50 transition-all shadow-xs">
                      <Upload className="h-3.5 w-3.5 text-brand-teal" />
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-brand-muted">
                    JPG, PNG, or WEBP up to 5MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg" 
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Complete Registration'}
            </Button>
            <div className="mt-4 text-center">
              <button 
                type="button" 
                onClick={() => auth.signOut()}
                className="text-sm text-zinc-500 hover:text-zinc-900 underline underline-offset-4"
              >
                Sign out and start over
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
