import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { get, getDatabase, limitToLast, orderByKey, query, ref, update } from "firebase/database";
import { setDb, type Db } from "./store";

// Public web config (safe to ship; access is enforced by Auth + Realtime Database rules).
const config = {
  apiKey: "AIzaSyArk8kKKfWOV8ycEofDFdQmV44mRjac-2A",
  authDomain: "dashboard-reels-87e0b.firebaseapp.com",
  databaseURL: "https://dashboard-reels-87e0b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dashboard-reels-87e0b",
  storageBucket: "dashboard-reels-87e0b.firebasestorage.app",
  messagingSenderId: "840026664495",
  appId: "1:840026664495:web:46db89ac463c42bf6960da",
};

const app = getApps()[0] ?? initializeApp(config);
export const auth = getAuth(app);
const database = getDatabase(app);

const clientDb: Db = {
  ref(path) {
    const r = ref(database, path);
    return {
      get: () => get(r),
      update: (v) => update(r, v),
      orderByKey: () => ({ limitToLast: (n) => ({ get: () => get(query(r, orderByKey(), limitToLast(n))) }) }),
    };
  },
};
setDb(clientDb);

// Dev-only hook for automated UI checks (stripped from production builds).
if (import.meta.env.DEV) {
  import("firebase/auth").then(({ signInWithCustomToken }) => {
    (window as any).__testSignIn = (token: string) => signInWithCustomToken(auth, token);
  });
}
