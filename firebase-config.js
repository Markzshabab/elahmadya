// =========================================================
// FIREBASE CONFIGURATION
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  set,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAB6GT-198Ns1W8a722ACFeouK6RvUDuwc",
  authDomain: "markzshabab-4c01b.firebaseapp.com",
  databaseURL: "https://markzshabab-4c01b-default-rtdb.firebaseio.com",
  projectId: "markzshabab-4c01b",
  storageBucket: "markzshabab-4c01b.firebasestorage.app",
  messagingSenderId: "537337823216",
  appId: "1:537337823216:web:476ed6c701d604bf426735"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Export Database Functions
export {
  ref,
  push,
  onValue,
  set,
  get,
  update
};