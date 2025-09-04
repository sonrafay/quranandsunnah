// src/lib/firebase.ts
"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence, // multi-tab safe
} from "firebase/firestore";

// ---- Config ----
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// ---- App (singleton) ----
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ---- Auth (singleton) ----
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Guard against re-running during Fast Refresh / multiple imports
declare global {
  // eslint-disable-next-line no-var
  var __QS_AUTH_PERSISTENCE_ENABLED__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __QS_FS_PERSISTENCE_ENABLED__: boolean | undefined;
}

if (typeof window !== "undefined") {
  if (!globalThis.__QS_AUTH_PERSISTENCE_ENABLED__) {
    globalThis.__QS_AUTH_PERSISTENCE_ENABLED__ = true;
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // Ignore (e.g., unsupported environment)
    });
  }
}

// ---- Firestore (singleton) ----
export const db = getFirestore(app);

if (typeof window !== "undefined") {
  if (!globalThis.__QS_FS_PERSISTENCE_ENABLED__) {
    globalThis.__QS_FS_PERSISTENCE_ENABLED__ = true;
    // Use multi-tab persistence to avoid the “exclusive access” error
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      // Safe to ignore in private windows / unsupported browsers / test envs
      // console.warn("Firestore persistence not enabled:", err.code);
    });
  }
}
