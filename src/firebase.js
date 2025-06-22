import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // <-- Add this line

const firebaseConfig = {
  apiKey: "AIzaSyDQ3dOUDqkHCxb9KZvxk6WP_lpJf6a2-gk",
  authDomain: "space-a7032.firebaseapp.com",
  projectId: "space-a7032",
  storageBucket: "space-a7032.firebasestorage.app",
  messagingSenderId: "447784776220",
  appId: "1:447784776220:web:05b8a886013f50178ea5d9",
  measurementId: "G-ST14PK8WHK"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app); // <-- Add this line

export { app, analytics, db }; // <-- Export db