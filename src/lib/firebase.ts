// src/lib/firebase.ts
"use client";

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Auth (persist across tabs/reloads)
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => { /* ignore */ });
export const googleProvider = new GoogleAuthProvider();

// Firestore
export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => { /* private window / multi-tab */ });
