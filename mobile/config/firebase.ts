import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyReplaceMe",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "kryptonow.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "kryptonow-dummy",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "kryptonow.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:12345:web:abcd"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with React Native persistence to ensure auth state survives app reloads
const auth = getAuth(app);
if (Platform.OS !== "web" && getApps().length === 1) {
  // We only initialize this once when the app is created
  // Note: react-native persistence requires initializeAuth, but since we called getAuth()
  // it might throw if initialized again. getAuth handles persistence automatically on web.
  // We'll update the persistence manually if needed.
  auth.setPersistence(getReactNativePersistence(AsyncStorage)).catch(console.warn);
}

const db = getFirestore(app);

export { app, auth, db };
