// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// --- ANALYTICS NOT SUPPORTED IN NODE.JS ---
// import { getAnalytics } from "firebase/analytics";
// ------------------------------------------

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgOTe_QNXHuEUERstquiKdvxn6GkT3eWw",
  authDomain: "kryptonow-c6139.firebaseapp.com",
  projectId: "kryptonow-c6139",
  storageBucket: "kryptonow-c6139.firebasestorage.app",
  messagingSenderId: "698456324003",
  appId: "1:698456324003:web:b5e20e130a9cc857850c16",
  measurementId: "G-SYSBBD8HME"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- COMMENT OUT ANALYTICS FOR NODE.JS RUN ---
// const analytics = getAnalytics(app);
// ----------------------------------------------

console.log("Firebase App successfully initialized!");