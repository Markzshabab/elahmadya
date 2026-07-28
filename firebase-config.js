// =========================================================
// FIREBASE CONFIGURATION
// -----------------------------------------------------------
// 1. Go to https://console.firebase.google.com
// 2. Create a project → Add a Web App → copy the config below
// 3. Enable "Realtime Database" (NOT Firestore) in the console
// 4. Enable "Authentication" → Email/Password (Admin only, one account)
// 5. Paste the security rules from /firebase/database.rules.json
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, push, onValue, set, get, update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ⚠️ REPLACE WITH YOUR OWN FIREBASE PROJECT CREDENTIALS
// These are safe to expose publicly — Firebase security is enforced
// by database.rules.json, NOT by hiding this config.
const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://REPLACE_WITH_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "REPLACE_WITH_YOUR_PROJECT",
  storageBucket:     "REPLACE_WITH_YOUR_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId:             "REPLACE_WITH_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export { ref, push, onValue, set, get, update };

// -----------------------------------------------------------
// Realtime Database structure (see /firebase/database.rules.json
// for the matching security rules):
//
// /votes/{voteId}         -> { q1, q2, q3, ipHash, ipLast4, ts }
// /media/{mediaId}        -> { type: "video"|"voice", status: "pending"|"approved"|"rejected",
//                               r2Key, ipHash, ts }
// /statistics/summary     -> { total, today, week, q1:{}, q2:{}, q3:{},
//                               videos, approved, rejected }
// /banned_ips/{ipHash}    -> { reason, ts }
// /settings/adminPasswordHash -> rotated every minute by the Worker
// /logs/{logId}           -> { action, actor, ts }
// -----------------------------------------------------------
