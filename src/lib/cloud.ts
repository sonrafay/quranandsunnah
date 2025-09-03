// src/lib/cloud.ts
"use client";

import { db } from "@/lib/firebase";
import {
  doc, setDoc, serverTimestamp, collection, deleteDoc,
  onSnapshot, query, where, getDocs, orderBy, Timestamp,
} from "firebase/firestore";

export async function saveProfile(
  uid: string,
  data: { displayName?: string; photoURL?: string; avatar?: string }
) {
  await setDoc(
    doc(db, "users", uid),
    { ...data, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true }
  );
}

export async function saveSettings(uid: string, prefs: any) {
  await setDoc(
    doc(db, "users", uid, "settings", "prefs"),
    { prefs, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function markQuranProgress(uid: string, surah: number, ayah?: number) {
  await setDoc(
    doc(db, "users", uid, "progress", "quran"),
    { surah, ayah: ayah ?? null, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function markHadithProgress(uid: string, collectionId: string, hadithId?: string) {
  await setDoc(
    doc(db, "users", uid, "progress", "hadith"),
    { collectionId, hadithId: hadithId ?? null, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function addHadithBookmark(uid: string, collectionId: string, hadithId: string, note?: string) {
  await setDoc(
    doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`),
    { collectionId, hadithId, note: note ?? "", createdAt: serverTimestamp() },
    { merge: true }
  );
}
export async function removeHadithBookmark(uid: string, collectionId: string, hadithId: string) {
  await deleteDoc(doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`));
}

/** Notes used by both Qur’an & Hadith */
export async function saveNote(
  uid: string,
  data: { scope: "quran" | "hadith"; keyRef: string; content: string }
) {
  const id = `${data.scope}-${data.keyRef}`;
  await setDoc(
    doc(db, "users", uid, "notes", id),
    { ...data, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true }
  );
}

/* -------------------------
 * Qur’an Bookmarks (colored)
 * -------------------------
 * Five pastel swatches: p1..p5. Use null to remove highlight.
 */
export type BookmarkColor = "p1" | "p2" | "p3" | "p4" | "p5";

export async function setQuranBookmarkColor(
  uid: string,
  surah: number,
  ayah: number,
  color: BookmarkColor | null
) {
  const ref = doc(db, "users", uid, "quranBookmarks", `${surah}-${ayah}`);
  if (!color) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(
    ref,
    { surah, ayah, color, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true }
  );
}

/** Get all bookmarks for a surah as a map ayah->color (one-shot). */
export async function getQuranBookmarksMapOnce(uid: string, surah: number) {
  const q = query(
    collection(db, "users", uid, "quranBookmarks"),
    where("surah", "==", surah)
  );
  const snap = await getDocs(q);
  const map = new Map<number, BookmarkColor>();
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data?.ayah && data?.color) map.set(Number(data.ayah), data.color as BookmarkColor);
  });
  return map;
}

/** Subscribe to a surah’s bookmarks. */
export function onQuranBookmarksMap(
  uid: string,
  surah: number,
  cb: (map: Map<number, BookmarkColor>) => void
) {
  const q = query(
    collection(db, "users", uid, "quranBookmarks"),
    where("surah", "==", surah)
  );
  return onSnapshot(q, (snap) => {
    const map = new Map<number, BookmarkColor>();
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data?.ayah && data?.color) map.set(Number(data.ayah), data.color as BookmarkColor);
    });
    cb(map);
  });
}

/** Query all Qur’an bookmarks (for /bookmarks page). */
export async function getAllQuranBookmarks(uid: string) {
  const q = query(
    collection(db, "users", uid, "quranBookmarks"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Array<{
    id: string;
    surah: number;
    ayah: number;
    color: BookmarkColor;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
  }>;
}
