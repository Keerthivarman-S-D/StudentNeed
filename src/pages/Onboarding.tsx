import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserCircle2, Upload, Link2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { AUTH_ENDPOINTS } from '../config/api';
import { cn } from '../lib/utils';
import { uploadImageToCloudinary, validateImageFile } from '../lib/cloudinary';

export function Onboarding() {
  const navigate = useNavigate();
  const { firebaseUser, currentUser } = useAuth();
  
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [avatarSource, setAvatarSource] = useState<'upload' | 'url'>('upload');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isCheckingUrl, setIsCheckingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlValid, setIsUrlValid] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      navigate('/login');
    } else if (currentUser) {
      navigate('/');
    }
  }, [firebaseUser, currentUser, navigate]);

  // Handle URL validation and image loading preview
  useEffect(() => {
    if (avatarSource !== 'url') return;

    const trimmed = avatarUrlInput.trim();
    if (!trimmed) {
      setAvatarPreview('');
      setUrlError(null);
      setIsUrlValid(false);
      setIsCheckingUrl(false);
      return;
    }

    // Validate URL syntax
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setUrlError('Please enter a URL starting with http:// or https://');
        setAvatarPreview('');
        setIsUrlValid(false);
        setIsCheckingUrl(false);
        return;
      }
    } catch {
      setUrlError('Please enter a valid URL');
      setAvatarPreview('');
      setIsUrlValid(false);
      setIsCheckingUrl(false);
      return;
    }

    setIsCheckingUrl(true);
    setUrlError(null);

    let isMounted = true;
    const img = new Image();
    const timer = setTimeout(() => {
      if (isMounted) {
        setIsCheckingUrl(false);
        setUrlError('Image took too long to load. Please try another link.');
        setAvatarPreview('');
        setIsUrlValid(false);
      }
    }, 7000);

    img.onload = () => {
      if (isMounted) {
        clearTimeout(timer);
        setIsCheckingUrl(false);
        setUrlError(null);
        setIsUrlValid(true);
        setAvatarPreview(trimmed);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        clearTimeout(timer);
        setIsCheckingUrl(false);
        setUrlError('Unable to load image from this URL. Please verify the link.');
        setAvatarPreview('');
        setIsUrlValid(false);
      }
    };

    img.src = trimmed;

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [avatarUrlInput, avatarSource]);

  const handleSourceChange = (newSource: 'upload' | 'url') => {
    setAvatarSource(newSource);
    setError(null);
    if (newSource === 'upload') {
      // Clear URL state and restore file preview if a file is already picked
      setAvatarUrlInput('');
      setUrlError(null);
      setIsUrlValid(false);
      setIsCheckingUrl(false);
      if (avatarFile) {
        setAvatarPreview(URL.createObjectURL(avatarFile));
      } else {
        setAvatarPreview('');
      }
    } else {
      // Clear file state and restore validated URL preview if available
      setAvatarFile(null);
      if (avatarUrlInput.trim() && isUrlValid) {
        setAvatarPreview(avatarUrlInput.trim());
      } else {
        setAvatarPreview('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the provided image URL, uploaded image, or generate a default avatar using initials
      let finalAvatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=000000`;
      
      if (avatarSource === 'url') {
        const trimmedUrl = avatarUrlInput.trim();
        if (trimmedUrl) {
          if (isCheckingUrl) {
            setError('Please wait for image URL verification to complete.');
            setIsLoading(false);
            return;
          }
          if (urlError || !isUrlValid) {
            setError('Please provide a valid, loadable image URL or clear the field to continue.');
            setIsLoading(false);
            return;
          }
          finalAvatarUrl = trimmedUrl;
        }
      } else if (avatarSource === 'upload' && avatarFile) {
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 mb-4 border border-zinc-200">
            <UserCircle2 className="h-8 w-8 text-zinc-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Complete your profile
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Tell us a bit about yourself so other students know who they are trading with.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
            
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
              <Input 
                required 
                placeholder="Keerthi V." 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Department</label>
              <select 
                className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-zinc-700">
                  Profile Image <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-100 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSourceChange('upload')}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors",
                      avatarSource === 'upload' 
                        ? "bg-white text-zinc-900 shadow-sm" 
                        : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSourceChange('url')}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors",
                      avatarSource === 'url' 
                        ? "bg-white text-zinc-900 shadow-sm" 
                        : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <Link2 className="h-3 w-3" />
                    <span>Image URL</span>
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-start gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt="Preview" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserCircle2 className="h-8 w-8 text-zinc-400" />
                  )}
                  {avatarSource === 'url' && isCheckingUrl && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-700" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  {avatarSource === 'upload' ? (
                    <div>
                      <Input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
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
                        }}
                        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-900 hover:file:bg-zinc-200"
                      />
                      <p className="mt-1 text-xs text-zinc-500">
                        JPG, JPEG, PNG, or WEBP. Max 5MB.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Input 
                          type="url"
                          placeholder="https://example.com/avatar.jpg"
                          value={avatarUrlInput}
                          onChange={(e) => setAvatarUrlInput(e.target.value)}
                          className={cn(
                            "text-sm pr-9",
                            urlError && "border-red-300 focus:border-red-400 focus:ring-red-500/10",
                            isUrlValid && "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-500/10"
                          )}
                        />
                        <div className="absolute right-2.5 top-2.5 flex items-center pointer-events-none">
                          {isCheckingUrl ? (
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                          ) : isUrlValid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : urlError ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Link2 className="h-4 w-4 text-zinc-400" />
                          )}
                        </div>
                      </div>
                      {urlError ? (
                        <p className="text-xs text-red-600">
                          {urlError}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          Paste a direct link to any public image (JPG, PNG, WebP, SVG).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg" 
              disabled={isLoading || (avatarSource === 'url' && isCheckingUrl)}
            >
              {isLoading ? 'Saving...' : (avatarSource === 'url' && isCheckingUrl) ? 'Verifying Image URL...' : 'Complete Registration'}
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
