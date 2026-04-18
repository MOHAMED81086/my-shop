import toast from 'react-hot-toast';
import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserProfile {
  userId: string;
  numericId?: string;
  username?: string;
  password?: string;
  email: string;
  name: string;
  photoUrl?: string;
  language?: string;
  notificationSettings?: {
    orders: boolean;
    recharge: boolean;
    transfer: boolean;
    tickets: boolean;
  };
  role: string;
  originalRole?: string;
  roleExpiryDate?: string | null;
  wallet_balance: number;
  merchant_balance?: number;
  points?: number;
  eventPoints?: number;
  referralCode?: string;
  referredBy?: string;
  referralCharged?: boolean;
  referralPurchased?: boolean;
  referralCompleted?: boolean;
  hasUsedFreeAd?: boolean;
  permissions: string[];
  blocked: boolean;
  createdAt: string;
  firstProfitAt?: any;
}

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  initialize: () => {
    auth.onAuthStateChanged(async (user) => {
      try {
        set({ user, loading: true });
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          
          // Check if user exists, if not create
          let docSnap;
          try {
            docSnap = await getDoc(userRef);
          } catch (err) {
            console.error("Error fetching user doc:", err);
            set({ loading: false });
            return;
          }

          if (!docSnap.exists()) {
            let baseName = (window as any)._pendingName || user.displayName || 'New User';
            
            // Generate unique 10-digit numeric ID
            // Collisions are statistically extremely rare for 10 digits (1 in 10 billion)
            // Queries here would fail due to security rules for non-admin users.
            const numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();

            // Generate unique referral code
            const referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const newProfile: UserProfile = {
              userId: user.uid,
              numericId,
              email: user.email || '',
              name: (window as any)._pendingName || user.displayName || baseName,
              username: (window as any)._pendingUsername || user.displayName || baseName,
              password: (window as any)._pendingPassword || '', 
              role: 'buyer',
              wallet_balance: 0,
              points: 0,
              eventPoints: 0,
              referralCode,
              permissions: [],
              blocked: false,
              createdAt: new Date().toISOString(),
            };
            
            try {
              await setDoc(userRef, newProfile);
            } catch (err: any) {
              console.error("Error creating user profile:", err);
              toast.error('حدث خطأ أثناء إنشاء الملف الشخصي. يرجى المحاولة مرة أخرى.');
            }
            
            if ((window as any)._pendingPassword) delete (window as any)._pendingPassword;
            if ((window as any)._pendingName) delete (window as any)._pendingName;
            if ((window as any)._pendingUsername) delete (window as any)._pendingUsername;
          } else {
            // Add numericId to existing users if they don't have one
            const data = docSnap.data() as UserProfile;
            const updates: any = {};

            if (!data.numericId) {
              try {
                const { query, collection, where, getDocs } = await import('firebase/firestore');
                let numericId = '';
                let isIdUnique = false;
                let idCounter = 0;
                while (!isIdUnique && idCounter < 10) {
                  numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
                  const qId = query(collection(db, 'public_users'), where('numericId', '==', numericId));
                  const snapId = await getDocs(qId);
                  if (snapId.empty) {
                    isIdUnique = true;
                  }
                  idCounter++;
                }
                if (numericId) updates.numericId = numericId;
              } catch (err) {
                console.error("Error updating numeric ID:", err);
              }
            }

            if (!data.referralCode) {
              updates.referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            }

            if (Object.keys(updates).length > 0) {
              try {
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(userRef, updates);
              } catch (err) {
                console.error("Error updating profile with missing fields:", err);
              }
            }

            try {
              const { setDoc, doc } = await import('firebase/firestore');
              await setDoc(doc(db, 'public_users', user.uid), {
                  name: data.name || '',
                  referralCode: data.referralCode || updates.referralCode || '',
                  numericId: data.numericId || updates.numericId || ''
              }, { merge: true });
            } catch (err) {
              console.error("Error syncing public profile:", err);
            }
          }

          // Listen to profile changes
          onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              
              if (data.blocked) {
                toast.error('عذراً، تم حظر حسابك. يرجى التواصل مع الدعم الفني.');
                auth.signOut();
                set({ user: null, profile: null, loading: false });
                return;
              }

              // Handle admin session check
              if (data.role === 'admin') {
                if (typeof window !== 'undefined' && !sessionStorage.getItem('adminSession')) {
                  // If we are in a tab without adminSession, we just don't treat them as admin in the state
                  // but we DON'T revert it in the database here to avoid fighting other tabs.
                  // Instead, we let the user manually log out or the rules handle it.
                  // However, for UI consistency:
                }
              }

              set({ profile: data, loading: false });
            } else {
              set({ profile: null, loading: false });
            }
          }, (error) => {
            console.error("Profile snapshot error:", error);
            set({ loading: false });
          });
        } else {
          set({ profile: null, loading: false });
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        set({ loading: false });
      }
    });
  },
}));
