// src/lib/cloud.ts
import { db } from "@/lib/firebase";
import {
  doc, setDoc, serverTimestamp, collection, deleteDoc,
} from "firebase/firestore";

export async function saveProfile(uid: string, data: { displayName?: string; photoURL?: string }) {
  // top-level user doc
  await setDoc(doc(db, "users", uid), { ...data, createdAt: serverTimestamp() }, { merge: true });
}

export async function saveSettings(uid: string, prefs: any) {
  await setDoc(doc(db, "users", uid, "settings", "prefs"), { prefs, updatedAt: serverTimestamp() }, { merge: true });
}

export async function markQuranProgress(uid: string, surah: number, ayah?: number) {
  await setDoc(doc(db, "users", uid, "progress", "quran"), {
    surah, ayah: ayah ?? null, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function addQuranBookmark(uid: string, surah: number, ayah: number, note?: string) {
  await setDoc(doc(db, "users", uid, "quranBookmarks", `${surah}-${ayah}`), {
    surah, ayah, note: note ?? "", createdAt: serverTimestamp(),
  }, { merge: true });
}
export async function removeQuranBookmark(uid: string, surah: number, ayah: number) {
  await deleteDoc(doc(db, "users", uid, "quranBookmarks", `${surah}-${ayah}`));
}

export async function markHadithProgress(uid: string, collectionId: string, hadithId?: string) {
  await setDoc(doc(db, "users", uid, "progress", "hadith"), {
    collectionId, hadithId: hadithId ?? null, updatedAt: serverTimestamp(),
  }, { merge: true });
}
export async function addHadithBookmark(uid: string, collectionId: string, hadithId: string, note?: string) {
  await setDoc(doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`), {
    collectionId, hadithId, note: note ?? "", createdAt: serverTimestamp(),
  }, { merge: true });
}
export async function removeHadithBookmark(uid: string, collectionId: string, hadithId: string) {
  await deleteDoc(doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`));
}
