import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserCircle2, Upload } from 'lucide-react';

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

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 256;
          const MAX_HEIGHT = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the provided image URL or generate a default avatar using initials
      let finalAvatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=000000`;
      
      if (avatarFile) {
        try {
          finalAvatarUrl = await processImage(avatarFile);
        } catch (imgError) {
          console.error("Failed to process image:", imgError);
          // Fallback to initials if image processing fails
        }
      }
      
      const response = await fetch('/api/auth/finalize-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name,
          department,
          avatarUrl: finalAvatarUrl
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to finalize account setup.");
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
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Profile Image <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle2 className="h-8 w-8 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1">
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-900 hover:file:bg-zinc-200"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Upload an image. We will automatically optimize it.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Complete Registration'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
