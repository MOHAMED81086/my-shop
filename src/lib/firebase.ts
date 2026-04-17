import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import fallbackConfig from '../../firebase-applet-config.json';

// Use environment variables if available (Vercel/Production), otherwise fallback to local config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with long polling to avoid connection issues in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || fallbackConfig.firestoreDatabaseId));

export const storage = getStorage(app);

export const uploadImage = async (file: File | Blob, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore connection failed: The client is offline.");
    }
  }
}
testConnection();

export const loginWithUsername = async (username: string, password: string) => {
  try {
    const email = `${username.toLowerCase()}@store.local`;
    
    // We try to sign in directly using standard Email/Password.
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error("Login Error:", error);

    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
      throw error;
    }

    if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    throw error;
  }
};

export const signUpWithUsername = async (username: string, password: string, name: string) => {
  try {
    const email = `${username.toLowerCase()}@store.local`;
    
    // Pass data to profile creation listener
    (window as any)._pendingPassword = password;
    (window as any)._pendingName = name;
    (window as any)._pendingUsername = username;
    
    // Create the account using standard Email/Password
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    
    return result.user;
  } catch (error: any) {
    console.error("Signup Error:", error);

    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
      throw error;
    }

    if (error.code === 'auth/email-already-in-use') {
      throw new Error('اسم المستخدم موجود بالفعل');
    }
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
