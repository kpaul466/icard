import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyDVR5sbIV_waSR6Qu3kQLn-0_xjxeD6uYU",
  authDomain: "icard-8ec36.firebaseapp.com",
  projectId: "icard-8ec36",
  storageBucket: "icard-8ec36.firebasestorage.app",
  messagingSenderId: "457008823258",
  appId: "1:457008823258:web:690f7ffcb8dcb0b66fdee3",
  measurementId: "G-04M8TBYLM1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithRedirect(auth, googleProvider);
export const logout = () => {
  localStorage.removeItem('id-portal-user-settings');
  return signOut(auth);
};

// Local Development Support
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('Running on localhost. Firebase is ready for local development.');
  
  // Optional: Connect to Firebase Emulators if you have them running locally
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectAuthEmulator(auth, 'http://localhost:9099');
}
