import toast from 'react-hot-toast';
import { create } from 'zustand';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UserProfile {
  userId: string;
  id?: string; // Compatibility
  numericId?: string;
  username: string; // Required
  password?: string; // Required for local auth
  email?: string;
  name: string;
  role: string;
  originalRole?: string;
  wallet_balance: number;
  balance?: number; // Alias for wallet_balance
  merchant_balance?: number;
  profit?: number;
  points: number;
  createdAt: string;
  blocked?: boolean;
  referredBy?: string;
  referralCode?: string;
  referralPurchased?: boolean;
  referralCharged?: boolean;
  referralCompleted?: boolean;
  firstProfitAt?: any;
  hasUsedFreeAd?: boolean;
  photoUrl?: string;
  language?: string;
  notificationSettings?: {
    orders: boolean;
    recharge: boolean;
    transfer: boolean;
    tickets: boolean;
  };
}

interface AuthState {
  user: any | null; // Local user object
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: any | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  initialize: () => void;
  register: (username: string, password: string) => void;
  login: (username: string, password: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  initialize: () => {
    const currentUserId = localStorage.getItem('currentUserId');
    if (currentUserId) {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const user = users.find((u: any) => u.id === currentUserId);
      if (user) {
        set({ user, profile: { ...user, userId: user.id, wallet_balance: user.balance || 0 }, loading: false });
        
        // Sync with Firestore if possible (optional but good for data)
        const userRef = doc(db, 'users', user.id);
        onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
             const firestoreData = snapshot.data() as any;
             // Sync balance and other fields back to local storage if they changed in firestore (e.g. from admin)
             const updatedUsers = users.map((u: any) => u.id === user.id ? { ...u, ...firestoreData, balance: firestoreData.wallet_balance } : u);
             localStorage.setItem('users', JSON.stringify(updatedUsers));
             set({ profile: { ...firestoreData, userId: user.id }, user: updatedUsers.find((u: any) => u.id === user.id) });
          }
        });
      } else {
        set({ loading: false });
      }
    } else {
      set({ loading: false });
    }
  },
  register: async (username, password) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find((u: any) => u.username === username)) {
      toast.error('اسم المستخدم مستخدم بالفعل');
      return;
    }

    const id = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const newUser = {
      id,
      username,
      password,
      name: username,
      role: 'buyer',
      balance: 0,
      profit: 0,
      points: 0,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUserId', id);

    // Create record in Firestore to keep data synced
    try {
      await setDoc(doc(db, 'users', id), {
        userId: id,
        numericId: id,
        username,
        name: username,
        role: 'buyer',
        wallet_balance: 0,
        points: 0,
        createdAt: newUser.createdAt
      });
    } catch (e) {
      console.error("Firestore sync failed", e);
    }

    set({ user: newUser, profile: { ...newUser, userId: id, wallet_balance: 0 }, loading: false });
    toast.success('تم إنشاء الحساب');
  },
  login: (username, password) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: any) => u.username === username && u.password === password);

    if (!user) {
      toast.error('بيانات غير صحيحة');
      return;
    }

    localStorage.setItem('currentUserId', user.id);
    set({ user, profile: { ...user, userId: user.id, wallet_balance: user.balance || 0 }, loading: false });
    toast.success('تم تسجيل الدخول');
  },
  logout: () => {
    localStorage.removeItem('currentUserId');
    set({ user: null, profile: null });
    // location.reload(); // Usually handled by app state
  }
}));
