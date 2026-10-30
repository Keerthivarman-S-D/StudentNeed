import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { auth } from '../lib/firebaseAuth';
import { User } from '../types';
import { NOTIFICATION_ENDPOINTS } from '../config/api';

type AuthContextType = {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUserProfile: (user: Partial<User>) => void;
};

const HAS_SESSION_KEY = 'sn_has_session';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // Auth initialization state: begins as true until onAuthStateChanged fires for the first time.
  // Public routes bypass this loading state in AppContent, while protected routes wait safely.
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        try {
          localStorage.setItem(HAS_SESSION_KEY, 'true');
        } catch {}

        if (unsubscribeDoc) {
          unsubscribeDoc();
        }

        try {
          // Lazily load Firestore listener only when a signed-in user is present
          const [{ db }, { doc, onSnapshot }] = await Promise.all([
            import('../lib/firebase'),
            import('firebase/firestore')
          ]);

          unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
              setCurrentUser({ id: user.uid, ...(docSnap.data() as User), email: user.email || '' });
            } else {
              setCurrentUser(null);
            }
            setLoading(false);
          }, (error) => {
            console.error("Error fetching user profile:", error);
            setCurrentUser(null);
            setLoading(false);
          });
        } catch (err) {
          console.error("Error initializing user profile listener:", err);
          setCurrentUser(null);
          setLoading(false);
        }
      } else {
        try {
          localStorage.removeItem(HAS_SESSION_KEY);
        } catch {}
        setCurrentUser(null);
        setLoading(false);
        if (unsubscribeDoc) unsubscribeDoc();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const logout = async () => {
    try {
      localStorage.removeItem(HAS_SESSION_KEY);
      // Ensure the overall cleanup timeout covers BOTH getIdToken() and the unregisterFcm request,
      // so logout is never blocked indefinitely by token retrieval or network failure.
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const controller = new AbortController();
          const unregisterPromise = (async () => {
            const idToken = await currentUser.getIdToken();
            if (!idToken) return;
            await fetch(NOTIFICATION_ENDPOINTS.unregisterFcm, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              signal: controller.signal,
            });
          })();

          let timeoutId: any;
          const timeoutPromise = new Promise((resolve) => {
            timeoutId = setTimeout(() => {
              controller.abort();
              resolve(null);
            }, 1500);
          });

          await Promise.race([unregisterPromise, timeoutPromise])
            .catch((err) => {
              console.warn('Logout device unregister non-fatal note:', err?.message || err);
            })
            .finally(() => {
              clearTimeout(timeoutId);
            });
        }
      } catch (tokenErr) {
        console.warn('Logout token cleanup non-fatal note:', tokenErr);
      }

      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const updateUserProfile = (updatedData: Partial<User>) => {
    setCurrentUser(prev => prev ? { ...prev, ...updatedData } as User : null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

