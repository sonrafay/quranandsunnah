// src/lib/cloud.ts
"use client";

import { db } from "@/lib/firebase";
import type { PrivacySettings, FriendProfile, AvatarBorderTier } from "@/lib/account/models";
import {
  doc, setDoc, serverTimestamp, collection, deleteDoc,
  onSnapshot, query, where, getDocs, orderBy, Timestamp,
  getDoc, updateDoc, deleteField, arrayUnion, arrayRemove, limit as fsLimit
} from "firebase/firestore";

import {
  calculateStreakUpdate,
  getDefaultUnlocks,
  StreakAdminOverride,
  StreakState,
  StreakUnlocks,
} from "@/lib/account/streak";

/* =========================
   Profiles / Settings / Progress
   ========================= */
export type UserProfileDoc = {
  displayName?: string;
  photoURL?: string;
  avatar?: string;
  handle?: string;
  publicId?: string;
  verseRef?: string;
  privacy?: PrivacySettings;
  avatarIconId?: string;
  avatarBorderTier?: string;
  updatedAt?: any;
  createdAt?: any;
};

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfileDoc) : null;
}

export async function saveProfile(
  uid: string,
  data: UserProfileDoc
) {
  await setDoc(
    doc(db, "users", uid),
    { ...data, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true }
  );
}

export type ReadingSettingsDoc = {
  theme?: "light" | "dark" | "sepia";
  quranFont?: string; // Support both old and new font variants
  quranFontSize?: number; // 1.0 = base
  translationFontSize?: number;
  transliterationFontSize?: number;
  translationIds?: number[];
  transliterationIds?: number[];
  // Word-by-word settings (unified language, separate toggles)
  wordByWordLanguageId?: number | null;
  showWordByWordTranslation?: boolean;
  showWordByWordTransliteration?: boolean;
  updatedAt?: any;
};

// Valid keys for reading settings - used to filter out deprecated fields
const VALID_READING_SETTINGS_KEYS = new Set([
  "theme",
  "quranFont",
  "quranFontSize",
  "translationFontSize",
  "transliterationFontSize",
  "translationIds",
  "transliterationIds",
  "wordByWordLanguageId",
  "showWordByWordTranslation",
  "showWordByWordTransliteration",
]);

const readingSettingsRef = (uid: string) => doc(db, "users", uid, "settings", "prefs");

export async function getReadingSettings(uid: string): Promise<ReadingSettingsDoc | null> {
  const snap = await getDoc(readingSettingsRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  console.log("[getReadingSettings] Raw Firestore snap.data():", data);
  return data as ReadingSettingsDoc;
}

export async function saveReadingSettings(uid: string, prefs: Partial<ReadingSettingsDoc>) {
  // Filter out any deprecated/unknown fields before saving
  const cleanPrefs: Record<string, any> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (VALID_READING_SETTINGS_KEYS.has(key)) {
      cleanPrefs[key] = value;
    }
  }

  await setDoc(
    readingSettingsRef(uid),
    { ...cleanPrefs, prefs: deleteField(), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function saveSettings(uid: string, prefs: Partial<ReadingSettingsDoc>) {
  await saveReadingSettings(uid, prefs);
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

/* =========================
   Streaks (V1)
   ========================= */
export type StreakDoc = StreakState & {
  unlocks: StreakUnlocks;
  adminOverride?: StreakAdminOverride;
  lastActionAt?: any;
  updatedAt?: any;
};

const streakRef = (uid: string) => doc(db, "users", uid, "account", "streak");
const legacyStreakRef = (uid: string) => doc(db, "users", uid, "streak", "daily");

export async function getStreak(uid: string): Promise<StreakDoc | null> {
  const snap = await getDoc(streakRef(uid));
  if (snap.exists()) return snap.data() as StreakDoc;
  const legacySnap = await getDoc(legacyStreakRef(uid));
  if (!legacySnap.exists()) return null;
  const legacy = legacySnap.data() as StreakDoc;
  await saveStreak(uid, legacy);
  return legacy;
}

export async function saveStreak(uid: string, streak: StreakDoc) {
  const { adminOverride, ...rest } = streak;
  const payload = {
    ...rest,
    ...(adminOverride ? { adminOverride } : {}),
  };
  await setDoc(
    streakRef(uid),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function recordStreakAction(
  uid: string,
  actionAtMs: number,
  timeZone: string
): Promise<StreakDoc> {
  const existing = await getStreak(uid);
  const previousUnlocks = existing?.unlocks ?? getDefaultUnlocks();
  const adminOverride = existing?.adminOverride;
  const result = calculateStreakUpdate(
    existing ?? null,
    actionAtMs,
    timeZone,
    previousUnlocks,
    adminOverride
  );

  const nextDoc: StreakDoc = {
    ...result.state,
    unlocks: result.unlocks,
    adminOverride,
    lastActionAt: actionAtMs,
  };

  await saveStreak(uid, nextDoc);
  return nextDoc;
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


export type NotificationPrefs = {
  webEnabled?: boolean;                         // toggle for web push
  fcmToken?: string;                            // saved by client after permission
  fcmUpdatedAt?: any;                           // serverTimestamp
  location?: { lat: number; lon: number; tz: string };  // saved from Prayer page
  prayer?: { enabled: boolean; offsets: number[] };     // minutes before prayer
  kahf?: { enabled: boolean };                  // Friday reminder
  dhikr?: { enabled: boolean; time?: string };  // Daily dhikr reminder (time is optional, e.g. "evening", "morning", or custom)
  // (legacy fields may still exist; we just ignore them)
};

export async function saveNotificationPrefs(
  uid: string,
  prefs: Partial<NotificationPrefs>
) {
  const ref = doc(db, "users", uid, "settings", "notifications");
  await setDoc(ref, { ...prefs, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getNotificationPrefs(
  uid: string
): Promise<NotificationPrefs | null> {
  const ref = doc(db, "users", uid, "settings", "notifications");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as NotificationPrefs) : null;
}

export function onNotificationPrefs(
  uid: string,
  cb: (prefs: NotificationPrefs | null) => void
) {
  const ref = doc(db, "users", uid, "settings", "notifications");
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? (snap.data() as NotificationPrefs) : null);
  });
}

export async function saveFcmToken(uid: string, token: string) {
  const ref = doc(db, "users", uid, "settings", "notifications");
  await setDoc(
    ref,
    { fcmToken: token, fcmUpdatedAt: serverTimestamp(), webEnabled: true },
    { merge: true }
  );
}

export async function clearFcmToken(uid: string) {
  const ref = doc(db, "users", uid, "settings", "notifications");
  await setDoc(
    ref,
    { fcmToken: deleteField(), fcmUpdatedAt: serverTimestamp() },
    { merge: true }
  );
}

/* =========================
   Friends System
   ========================= */

// Search for a user by handle or publicId
export async function searchUserByHandleOrId(
  searchQuery: string
): Promise<FriendProfile | null> {
  const trimmed = searchQuery.trim().toLowerCase();
  if (!trimmed) return null;

  // Try searching by handle first
  const handleQ = query(
    collection(db, "users"),
    where("handle", "==", trimmed),
    fsLimit(1)
  );
  const handleSnap = await getDocs(handleQ);

  if (!handleSnap.empty) {
    const userDoc = handleSnap.docs[0];
    const data = userDoc.data() as UserProfileDoc;
    return {
      uid: userDoc.id,
      displayName: data.displayName || "User",
      handle: data.handle,
      publicId: data.publicId,
      avatarIconId: data.avatarIconId,
      avatarBorderTier: data.avatarBorderTier as AvatarBorderTier | undefined,
    };
  }

  // Try searching by publicId
  const idQ = query(
    collection(db, "users"),
    where("publicId", "==", trimmed),
    fsLimit(1)
  );
  const idSnap = await getDocs(idQ);

  if (!idSnap.empty) {
    const userDoc = idSnap.docs[0];
    const data = userDoc.data() as UserProfileDoc;
    return {
      uid: userDoc.id,
      displayName: data.displayName || "User",
      handle: data.handle,
      publicId: data.publicId,
      avatarIconId: data.avatarIconId,
      avatarBorderTier: data.avatarBorderTier as AvatarBorderTier | undefined,
    };
  }

  return null;
}

// Send a friend request
export async function sendFriendRequest(
  fromUid: string,
  toUid: string
): Promise<{ success: boolean; error?: string }> {
  if (fromUid === toUid) {
    return { success: false, error: "Cannot send friend request to yourself" };
  }

  // Check if already friends
  const existingFriend = await getDoc(
    doc(db, "users", fromUid, "friends", toUid)
  );
  if (existingFriend.exists()) {
    return { success: false, error: "Already friends with this user" };
  }

  // Check if request already exists (either direction)
  const existingOutgoing = await getDoc(
    doc(db, "users", fromUid, "friendRequestsOutgoing", toUid)
  );
  if (existingOutgoing.exists()) {
    return { success: false, error: "Friend request already sent" };
  }

  const existingIncoming = await getDoc(
    doc(db, "users", fromUid, "friendRequestsIncoming", toUid)
  );
  if (existingIncoming.exists()) {
    return { success: false, error: "This user has already sent you a request" };
  }

  const now = serverTimestamp();

  // Add to sender's outgoing requests
  await setDoc(doc(db, "users", fromUid, "friendRequestsOutgoing", toUid), {
    toUid,
    status: "pending",
    createdAt: now,
  });

  // Add to recipient's incoming requests
  await setDoc(doc(db, "users", toUid, "friendRequestsIncoming", fromUid), {
    fromUid,
    status: "pending",
    createdAt: now,
  });

  return { success: true };
}

// Accept a friend request
export async function acceptFriendRequest(
  uid: string,
  fromUid: string
): Promise<{ success: boolean; error?: string }> {
  const incomingRef = doc(db, "users", uid, "friendRequestsIncoming", fromUid);
  const incomingSnap = await getDoc(incomingRef);

  if (!incomingSnap.exists()) {
    return { success: false, error: "Friend request not found" };
  }

  const now = serverTimestamp();

  // Add to both users' friends lists
  await setDoc(doc(db, "users", uid, "friends", fromUid), {
    friendUid: fromUid,
    createdAt: now,
  });

  await setDoc(doc(db, "users", fromUid, "friends", uid), {
    friendUid: uid,
    createdAt: now,
  });

  // Remove the request documents
  await deleteDoc(incomingRef);
  await deleteDoc(doc(db, "users", fromUid, "friendRequestsOutgoing", uid));

  return { success: true };
}

// Decline a friend request
export async function declineFriendRequest(
  uid: string,
  fromUid: string
): Promise<{ success: boolean; error?: string }> {
  const incomingRef = doc(db, "users", uid, "friendRequestsIncoming", fromUid);
  const incomingSnap = await getDoc(incomingRef);

  if (!incomingSnap.exists()) {
    return { success: false, error: "Friend request not found" };
  }

  // Remove the request documents
  await deleteDoc(incomingRef);
  await deleteDoc(doc(db, "users", fromUid, "friendRequestsOutgoing", uid));

  return { success: true };
}

// Cancel an outgoing friend request
export async function cancelFriendRequest(
  uid: string,
  toUid: string
): Promise<{ success: boolean; error?: string }> {
  const outgoingRef = doc(db, "users", uid, "friendRequestsOutgoing", toUid);
  const outgoingSnap = await getDoc(outgoingRef);

  if (!outgoingSnap.exists()) {
    return { success: false, error: "Friend request not found" };
  }

  // Remove the request documents
  await deleteDoc(outgoingRef);
  await deleteDoc(doc(db, "users", toUid, "friendRequestsIncoming", uid));

  return { success: true };
}

// Remove a friend
export async function removeFriend(
  uid: string,
  friendUid: string
): Promise<{ success: boolean; error?: string }> {
  const friendRef = doc(db, "users", uid, "friends", friendUid);
  const friendSnap = await getDoc(friendRef);

  if (!friendSnap.exists()) {
    return { success: false, error: "Friend not found" };
  }

  // Remove from both users' friends lists
  await deleteDoc(friendRef);
  await deleteDoc(doc(db, "users", friendUid, "friends", uid));

  return { success: true };
}

// Get incoming friend requests with profiles
export async function getIncomingFriendRequests(
  uid: string
): Promise<Array<{ fromUid: string; createdAt: Timestamp; profile?: FriendProfile }>> {
  const q = query(
    collection(db, "users", uid, "friendRequestsIncoming"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);

  const requests: Array<{ fromUid: string; createdAt: Timestamp; profile?: FriendProfile }> = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const fromUid = data.fromUid || docSnap.id;

    // Fetch profile for each requester
    const profileDoc = await getUserProfile(fromUid);
    const profile: FriendProfile | undefined = profileDoc ? {
      uid: fromUid,
      displayName: profileDoc.displayName || "User",
      handle: profileDoc.handle,
      publicId: profileDoc.publicId,
      avatarIconId: profileDoc.avatarIconId,
      avatarBorderTier: profileDoc.avatarBorderTier as AvatarBorderTier | undefined,
    } : undefined;

    requests.push({
      fromUid,
      createdAt: data.createdAt,
      profile,
    });
  }

  return requests;
}

// Get outgoing friend requests with profiles
export async function getOutgoingFriendRequests(
  uid: string
): Promise<Array<{ toUid: string; createdAt: Timestamp; profile?: FriendProfile }>> {
  const q = query(
    collection(db, "users", uid, "friendRequestsOutgoing"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);

  const requests: Array<{ toUid: string; createdAt: Timestamp; profile?: FriendProfile }> = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const toUid = data.toUid || docSnap.id;

    // Fetch profile for each recipient
    const profileDoc = await getUserProfile(toUid);
    const profile: FriendProfile | undefined = profileDoc ? {
      uid: toUid,
      displayName: profileDoc.displayName || "User",
      handle: profileDoc.handle,
      publicId: profileDoc.publicId,
      avatarIconId: profileDoc.avatarIconId,
      avatarBorderTier: profileDoc.avatarBorderTier as AvatarBorderTier | undefined,
    } : undefined;

    requests.push({
      toUid,
      createdAt: data.createdAt,
      profile,
    });
  }

  return requests;
}

// Get friends list with profiles
export async function getFriendsList(
  uid: string
): Promise<FriendRelationship[]> {
  const q = query(
    collection(db, "users", uid, "friends"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);

  const friends: FriendRelationship[] = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const friendUid = data.friendUid || docSnap.id;

    // Fetch profile for each friend
    const profileDoc = await getUserProfile(friendUid);
    const profile: FriendProfile | undefined = profileDoc ? {
      uid: friendUid,
      displayName: profileDoc.displayName || "User",
      handle: profileDoc.handle,
      publicId: profileDoc.publicId,
      avatarIconId: profileDoc.avatarIconId,
      avatarBorderTier: profileDoc.avatarBorderTier as AvatarBorderTier | undefined,
    } : undefined;

    friends.push({
      friendUid,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      profile,
    });
  }

  return friends;
}

// Get a specific user's public profile (for friend profile view)
export async function getPublicProfile(uid: string): Promise<FriendProfile | null> {
  const profileDoc = await getUserProfile(uid);
  if (!profileDoc) return null;

  // Get streak if privacy allows
  let currentStreak: number | undefined;
  if (profileDoc.privacy?.shareStreak) {
    const streakDoc = await getStreak(uid);
    currentStreak = streakDoc?.currentStreak;
  }

  return {
    uid,
    displayName: profileDoc.displayName || "User",
    handle: profileDoc.handle,
    publicId: profileDoc.publicId,
    avatarIconId: profileDoc.avatarIconId,
    avatarBorderTier: profileDoc.avatarBorderTier as AvatarBorderTier | undefined,
    currentStreak,
    privacy: profileDoc.privacy,
  };
}

// Listen to incoming friend requests (real-time)
export function onIncomingFriendRequests(
  uid: string,
  cb: (requests: Array<{ fromUid: string; createdAt: Timestamp }>) => void
) {
  const q = query(
    collection(db, "users", uid, "friendRequestsIncoming"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map((d) => ({
      fromUid: d.data().fromUid || d.id,
      createdAt: d.data().createdAt,
    }));
    cb(requests);
  });
}

// Listen to friends list (real-time)
export function onFriendsList(
  uid: string,
  cb: (friends: Array<{ friendUid: string; createdAt: Timestamp }>) => void
) {
  const q = query(
    collection(db, "users", uid, "friends"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const friends = snap.docs.map((d) => ({
      friendUid: d.data().friendUid || d.id,
      createdAt: d.data().createdAt,
    }));
    cb(friends);
  });
}
