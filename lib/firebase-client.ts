"use client";
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Public web config (safe to ship to the browser; access is enforced by Auth + DB rules).
const config = {
  apiKey: "AIzaSyArk8kKKfWOV8ycEofDFdQmV44mRjac-2A",
  authDomain: "dashboard-reels-87e0b.firebaseapp.com",
  databaseURL: "https://dashboard-reels-87e0b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dashboard-reels-87e0b",
  storageBucket: "dashboard-reels-87e0b.firebasestorage.app",
  messagingSenderId: "840026664495",
  appId: "1:840026664495:web:46db89ac463c42bf6960da",
};

export const clientAuth = () => getAuth(getApps()[0] ?? initializeApp(config));
