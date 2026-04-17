import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import fallbackConfig from '../../firebase-applet-config.json';

// Use environment variables if available (Vercel/Production), otherwise fallback to local config
// CRITICAL: Ensure these keys correctly match your Firebase Project in Vercel settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId
};

console.log("Initializing Firebase with project:", firebaseConfig.projectId);

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

export const auth = getAuth(app);

// Initialize Firestore with long polling to avoid connection issues in some environments
export const db = initializeFirestore(app!, {
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
      console.error("Firestore connection failed: The client is offline. Please check your Firebase configuration or internet connection.");
    } else {
      console.error("Firestore connection test error:", error);
    }
  }
}
testConnection();

export const googleProvider = new GoogleAuthProvider();

// Customizing parameters for easier sign-in
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  console.log("Attempting Google Sign-In via Redirect...");
  try {
    // We use Redirect as requested to avoid popup blockers and mobile issues
    await signInWithRedirect(auth, googleProvider);
  } catch (error: any) {
    console.group("CRITICAL AUTH ERROR (Sign-In Phase)");
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    if (error.code === 'auth/unauthorized-domain') {
       console.error("DOMAIN NOT AUTHORIZED: Add '" + window.location.hostname + "' to Firebase Authorized Domains.");
    }
    console.groupEnd();
    throw error;
  }
};

// Function to handle redirect result (checks for errors after the page reloads)
export const handleAuthRedirect = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log("Successfully retrieved redirect result for:", result.user.email);
    }
  } catch (error: any) {
    console.group("CRITICAL AUTH ERROR (Redirect Result Phase)");
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    console.groupEnd();
  }
};

handleAuthRedirect();

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
