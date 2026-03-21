import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Analytics is optional for now, Firestore is the priority!

const firebaseConfig = {
  apiKey: "AIzaSyBSdS5GNIAxVKgcogdNTD1oWNqw8p2YOT0",
  authDomain: "you-know-the-score.firebaseapp.com",
  projectId: "you-know-the-score",
  storageBucket: "you-know-the-score.firebasestorage.app",
  messagingSenderId: "470010116396",
  appId: "1:470010116396:web:9d37dab5335e839d781489",
  measurementId: "G-V73RY3SYTK"
};

// 1. Initialize the App
const app = initializeApp(firebaseConfig);

// 2. Export the Database (This is what Tee Off needs!)
export const db = getFirestore(app);