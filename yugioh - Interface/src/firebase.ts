import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQSMaqJuw3Qiht4YpFzjE3sWrGVqSIxSM",
  authDomain: "no-vibe-code.firebaseapp.com",
  projectId: "no-vibe-code",
  storageBucket: "no-vibe-code.firebasestorage.app",
  messagingSenderId: "770826194962",
  appId: "1:770826194962:web:4d4f826c1151995f0588cb",
  measurementId: "G-7XT6XLMMP0"
};

// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Export the "Tools" we need
export const auth = getAuth(app);              // The Authentication Tool
export const googleProvider = new GoogleAuthProvider(); // The Google Login Tool
export const db = getFirestore(app);           // The Database Tool