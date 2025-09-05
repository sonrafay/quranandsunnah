// src/lib/cloud.ts
"use client";

import { db } from "@/lib/firebase";
import {
  doc, setDoc, serverTimestamp, collection, deleteDoc,
  onSnapshot, query, where, getDocs, orderBy, Timestamp,
  getDoc, updateDoc, arrayUnion, arrayRemove, limit as fsLimit
} from "firebase/firestore";

/* =========================
   Profiles / Settings / Progress
   ========================= */
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

/* =========================
   Hadith Bookmarks
   ========================= */
export async function addHadithBookmark(uid: string, collectionId: string, hadithId: string, note?: string) {
  await setDoc(
    doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`),
    { collectionId, hadithId, note: note ?? "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  );
}
export async function removeHadithBookmark(uid: string, collectionId: string, hadithId: string) {
  await deleteDoc(doc(db, "users", uid, "hadithBookmarks", `${collectionId}-${hadithId}`));
}

/* =========================
   Generic Notes (existing)
   ========================= */
/** Notes used by both Qur’an & Hadith (generic API you already had). */
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

/* =========================
   Qur’an Bookmarks (colored)
   =========================
   Five pastel swatches: p1..p5. Use null to remove highlight.
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

/* =========================
   Qur’an Notes (new specialized API used by NotesPanel/notesIndex)
   ========================= */

export type QuranNote = {
  scope: "quran";
  keyRef: string;   // `${surah}:${ayah}`
  surah: number;
  ayah: number;
  content: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const quranNoteId = (surah: number, ayah: number) => `${surah}-${ayah}`;

const noteRef = (uid: string, surah: number, ayah: number) =>
  doc(db, "users", uid, "notes", quranNoteId(surah, ayah));

const notesIndexRef = (uid: string, surah: number) =>
  doc(db, "users", uid, "notesIndex", String(surah));

/** One-shot fetch for a single Qur’an note. */
export async function getQuranNote(uid: string, surah: number, ayah: number): Promise<QuranNote | null> {
  const snap = await getDoc(noteRef(uid, surah, ayah));
  return snap.exists() ? (snap.data() as QuranNote) : null;
}

/** Create/Update a Qur’an note and maintain the notesIndex list for the surah. */
export async function saveQuranNote(uid: string, surah: number, ayah: number, content: string) {
  const data: QuranNote = {
    scope: "quran",
    keyRef: `${surah}:${ayah}`,
    surah,
    ayah,
    content,
    updatedAt: serverTimestamp() as any,
    createdAt: serverTimestamp() as any,
  };
  await setDoc(noteRef(uid, surah, ayah), data, { merge: true });
  await updateDocOrSet(notesIndexRef(uid, surah), { list: arrayUnion(ayah) });
}

/** Delete a Qur’an note and remove it from the notesIndex list. */
export async function deleteQuranNote(uid: string, surah: number, ayah: number) {
  await deleteDoc(noteRef(uid, surah, ayah));
  await updateDocOrSet(notesIndexRef(uid, surah), { list: arrayRemove(ayah) });
}

/** Live subscription to the notesIndex list (Set<number> in hook for .has()). */
export function listenNotesIndex(
  uid: string,
  surah: number,
  cb: (list: number[]) => void
) {
  return onSnapshot(notesIndexRef(uid, surah), (snap) => {
    const list = (snap.exists() ? (snap.data() as any).list : []) as number[];
    cb(Array.isArray(list) ? list : []);
  });
}

/** Live stream of all Qur’an notes (used by /notes if you prefer a helper). */
export function listenAllQuranNotes(
  uid: string,
  cb: (notes: QuranNote[]) => void
) {
  const colRef = collection(db, "users", uid, "notes");
  const qRef = query(colRef, orderBy("updatedAt", "desc"));
  return onSnapshot(qRef, (snap) => {
    const out: QuranNote[] = [];
    snap.forEach((d) => {
      const v = d.data() as QuranNote;
      if (v.scope === "quran") out.push(v);
    });
    cb(out);
  });
}

/* =========================
   Internal util
   ========================= */
async function updateDocOrSet(ref: ReturnType<typeof doc>, partial: any) {
  try {
    await updateDoc(ref, partial);
  } catch {
    // if doc doesn't exist yet
    await setDoc(ref, { list: [], ...partial }, { merge: true });
  }
}

/* -------------------------
 * Recent Qur’an readings
 * -------------------------
 * One doc per surah under: users/{uid}/recentReadings/{surah}
 * We update the timestamp + last ayah, then read top 5 by updatedAt.
 */
export async function saveRecentReading(
  uid: string,
  surah: number,
  ayah?: number | null
) {
  await setDoc(
    doc(db, "users", uid, "recentReadings", String(surah)),
    { surah, ayah: ayah ?? null, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getRecentReadings(uid: string, take: number = 5) {
  try {
    const q = query(
      collection(db, "users", uid, "recentReadings"),
      orderBy("updatedAt", "desc"),
      fsLimit(take)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Array<{
      id: string;
      surah: number;
      ayah?: number | null;
      createdAt?: Timestamp;
      updatedAt?: Timestamp;
    }>;
  } catch (e: any) {
    // Helpful console note during development
    console.error("[getRecentReadings] Failed:", e?.code || e);
    throw e;
  }
}


export async function removeRecentReading(uid: string, surah: number) {
  await deleteDoc(doc(db, "users", uid, "recentReadings", String(surah)));
}

