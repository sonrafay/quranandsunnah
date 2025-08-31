// Simple typed localStorage helpers + keys

export const STORE_KEYS = {
  quran: {
    last: "qs-last-quran",
    bookmarks: "qs-bm-quran",
    notes: "qs-notes-quran",
  },
  hadith: {
    last: "qs-last-hadith",
    bookmarks: "qs-bm-hadith",
    notes: "qs-notes-hadith",
  },
} as const;

// Types
export type QuranLastRead = { surah: number; ayah?: number; updatedAt: number };
export type QuranBookmark = { surah: number; ayah: number; note?: string; addedAt: number };

export type HadithLastRead = { collectionId: string; number?: string; updatedAt: number };
export type HadithBookmark = { collectionId: string; id: string; note?: string; addedAt: number };

// Generic helpers
export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function setJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}
