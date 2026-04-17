import toast from 'react-hot-toast';
import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserProfile {
  userId: string;
  numericId?: string;
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
            let baseName = user.displayName || 'New User';
            let finalName = baseName;
            
            // Check for uniqueness
            const { query, collection, where, getDocs } = await import('firebase/firestore');
            let isUnique = false;
            let counter = 1;
            
            try {
              while (!isUnique && counter < 10) { // Limit attempts to prevent infinite loop
                const q = query(collection(db, 'users'), where('name', '==', finalName));
                const snap = await getDocs(q);
                if (snap.empty) {
                  isUnique = true;
                } else {
                  finalName = `${baseName}${counter}`;
                  counter++;
                }
              }
            } catch (err) {
              console.error("Error checking name uniqueness:", err);
            }

            // Generate unique 10-digit numeric ID
            let numericId = '';
            let isIdUnique = false;
            let idCounter = 0;
            try {
              while (!isIdUnique && idCounter < 10) {
                numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
                const qId = query(collection(db, 'users'), where('numericId', '==', numericId));
                const snapId = await getDocs(qId);
                if (snapId.empty) {
                  isIdUnique = true;
                }
                idCounter++;
              }
            } catch (err) {
              console.error("Error generating numeric ID:", err);
              numericId = Date.now().toString().substring(3);
            }

            // Generate unique referral code
            const referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const newProfile: UserProfile = {
              userId: user.uid,
              numericId,
              email: user.email || '',
              name: finalName,
              role: 'buyer',
              wallet_balance: 0,
              points: 0,
              eventPoints: 0,
              referralCode,
              permissions: [],
              blocked: false,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newProfile);
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
                  const qId = query(collection(db, 'users'), where('numericId', '==', numericId));
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

              // Revert admin role if session is missing
              try {
                if (data.role === 'admin' && !sessionStorage.getItem('adminSession')) {
                   const revertedRole = data.originalRole || 'buyer';
                   import('firebase/firestore').then(({ updateDoc }) => {
                     updateDoc(userRef, { role: revertedRole, masterCode: null }).catch(e => console.error("Revert role failed:", e));
                   });
                   data.role = revertedRole;
                }
              } catch (e) {
                // sessionStorage might be blocked on some mobile browsers
                console.warn("sessionStorage access failed:", e);
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
