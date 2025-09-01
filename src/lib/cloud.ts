// src/lib/cloud.ts
import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  addDoc,
} from "firebase/firestore";

/** ---------- Profiles & Settings ---------- */

export async function saveProfile(
  uid: string,
  data: { displayName?: string; photoURL?: string }
) {
  // top-level user doc
  await setDoc(
    doc(db, "users", uid),
    { ...data, createdAt: serverTimestamp() },
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

/** ---------- Reading Progress ---------- */

export async function markQuranProgress(
  uid: string,
  surah: number,
  ayah?: number
) {
  await setDoc(
    doc(db, "users", uid, "progress", "quran"),
    { surah, ayah: ayah ?? null, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function markHadithProgress(
  uid: string,
  collectionId: string,
  hadithId?: string
) {
  await setDoc(
    doc(db, "users", uid, "progress", "hadith"),
    { collectionId, hadithId: hadithId ?? null, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** ---------- Quran Bookmarks ---------- */

export async function addQuranBookmark(
  uid: string,
  surah: number,
  ayah: number,
  note?: string
) {
  await setDoc(
    doc(db, "users", uid, "quranBookmarks", `${surah}-${ayah}`),
    { surah, ayah, note: note ?? "", createdAt: serverTimestamp() },
    { merge: true }
  );
}

export async function removeQuranBookmark(
  uid: string,
  surah: number,
  ayah: number
) {
  await deleteDoc(doc(db, "users", uid, "quranBookmarks", `${surah}-${ayah}`));
}

/** Toggle helper used by the verse action button */
export async function toggleQuranBookmark(
  uid: string,
  surah: number,
  ayah: number
) {
  const ref = doc(db, "users", uid, "quranBookmarks", `${surah}-${ayah}`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    return { removed: true };
  } else {
    await setDoc(
      ref,
      { surah, ayah, createdAt: serverTimestamp() },
      { merge: true }
    );
    return { added: true };
  }
}

/** ---------- Hadith Bookmarks ---------- */

export async function addHadithBookmark(
  uid: string,
  collectionId: string,
  hadithId: string,
  note?: string
) {
  await setDoc(
    doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`),
    { collectionId, hadithId, note: note ?? "", createdAt: serverTimestamp() },
    { merge: true }
  );
}

export async function removeHadithBookmark(
  uid: string,
  collectionId: string,
  hadithId: string
) {
  await deleteDoc(
    doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`)
  );
}

/** ---------- Notes ---------- */

export type NoteScope = "quran" | "hadith";

export async function saveNote(
  uid: string,
  payload: { scope: NoteScope; keyRef: string; content: string }
) {
  const ref = collection(db, "users", uid, "notes");
  await addDoc(ref, { ...payload, updatedAt: serverTimestamp() });
}
