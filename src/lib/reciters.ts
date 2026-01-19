// src/lib/reciters.ts
// Curated reciter list matching Quran.com exactly
// Source of truth for reciter data in the application

export type ReciterVariant = "beta" | "mujawwad" | "muallim" | "kids-repeat" | null;

/**
 * Audio source type for reciters:
 * - "quran_foundation": Uses Quran.Foundation recitations API (full support)
 * - "legacy_qdc": Uses legacy QDC direct URLs (beta reciters with limited API support)
 */
export type ReciterSourceType = "quran_foundation" | "legacy_qdc";

export type ReciterConfig = {
  id: number;              // Stable internal ID for API calls
  name: string;            // Display name (without variant suffix)
  displayName: string;     // Full display name including variant
  variant: ReciterVariant;
  sourceType: ReciterSourceType; // How to fetch audio for this reciter
  slug?: string;           // Slug for legacy QDC URLs (per-verse: verses.quran.com/{slug}/...)
  qdcSlug?: string;        // Slug for QuranicAudio CDN (chapter: download.quranicaudio.com/qdc/{qdcSlug}/mp3/{chapter}.mp3)
};

/**
 * Curated list of reciters matching Quran.com exactly.
 * Order matches Quran.com's display order.
 *
 * ID Mapping:
 * - IDs match the Quran.com/QuranFeed API recitation IDs
 * - Beta reciters use IDs from the audio/reciters endpoint
 * - Variant reciters (mujawwad, muallim, kids repeat) have their own IDs
 *
 * Source Types:
 * - quran_foundation: Uses /recitations/{id}/audio_files API (full support)
 * - legacy_qdc: Uses direct CDN URLs with slug (beta reciters)
 */
export const RECITERS: ReciterConfig[] = [
  // Beta reciters (newer additions, use legacy QDC URLs)
  // slug = per-verse: verses.quran.com/{slug}/{surah3}{verse3}.mp3
  // qdcSlug = chapter: download.quranicaudio.com/qdc/{qdcSlug}/mp3/{chapter}.mp3
  { id: 13, name: "Ahmed ibn Ali al-Ajmy", displayName: "Ahmed ibn Ali al-Ajmy - beta", variant: "beta", sourceType: "legacy_qdc", slug: "ahmed_ibn_ali_al_ajamy", qdcSlug: "ahmed_ibn_ali_al-ajamy" },
  { id: 14, name: "Abdullah Ali Jabir", displayName: "Abdullah Ali Jabir - beta", variant: "beta", sourceType: "legacy_qdc", slug: "abdullah_awad_al_juhani", qdcSlug: "abdullah_awad_al-juhani" },
  { id: 15, name: "Bandar Baleela", displayName: "Bandar Baleela - beta", variant: "beta", sourceType: "legacy_qdc", slug: "bandar_baleela", qdcSlug: "bandar_baleela" },
  { id: 16, name: "Maher al-Muaiqly", displayName: "Maher al-Muaiqly - beta", variant: "beta", sourceType: "legacy_qdc", slug: "maher_al_muaiqly", qdcSlug: "maher_al-muaiqly" },

  // Standard reciters (use Quran.Foundation API)
  { id: 2, name: "AbdulBaset AbdulSamad", displayName: "AbdulBaset AbdulSamad", variant: null, sourceType: "quran_foundation" },
  { id: 1, name: "AbdulBaset AbdulSamad", displayName: "AbdulBaset AbdulSamad - Mujawwad", variant: "mujawwad", sourceType: "quran_foundation" },
  { id: 6, name: "Mahmoud Khalil Al-Husary", displayName: "Mahmoud Khalil Al-Husary", variant: null, sourceType: "quran_foundation" },
  { id: 7, name: "Mishari Rashid al-`Afasy", displayName: "Mishari Rashid al-`Afasy", variant: null, sourceType: "quran_foundation" },
  { id: 3, name: "Abdur-Rahman as-Sudais", displayName: "Abdur-Rahman as-Sudais", variant: null, sourceType: "quran_foundation" },
  { id: 9, name: "Mohamed Siddiq al-Minshawi", displayName: "Mohamed Siddiq al-Minshawi", variant: null, sourceType: "quran_foundation" },
  { id: 4, name: "Abu Bakr al-Shatri", displayName: "Abu Bakr al-Shatri", variant: null, sourceType: "quran_foundation" },
  { id: 10, name: "Sa`ud ash-Shuraym", displayName: "Sa`ud ash-Shuraym", variant: null, sourceType: "quran_foundation" },
  { id: 161, name: "Khalifah Al Tunaiji", displayName: "Khalifah Al Tunaiji", variant: null, sourceType: "quran_foundation" },
  { id: 17, name: "Saad al-Ghamdi", displayName: "Saad al-Ghamdi", variant: null, sourceType: "quran_foundation" },
  { id: 5, name: "Hani ar-Rifai", displayName: "Hani ar-Rifai", variant: null, sourceType: "quran_foundation" },

  // Beta reciter
  { id: 18, name: "Abdullah Hamad Abu Sharida", displayName: "Abdullah Hamad Abu Sharida - beta", variant: "beta", sourceType: "legacy_qdc", slug: "abdullah_hamad_abu_sharida", qdcSlug: "abdullah_hamad_abu_sharida" },

  // Variant reciters (special styles, use Quran.Foundation API)
  { id: 12, name: "Mahmoud Khalil Al-Husary", displayName: "Mahmoud Khalil Al-Husary - Muallim", variant: "muallim", sourceType: "quran_foundation" },
  { id: 173, name: "Mishari Rashid al-`Afasy", displayName: "Mishari Rashid al-`Afasy", variant: null, sourceType: "quran_foundation" },
  { id: 168, name: "Mohamed Siddiq al-Minshawi", displayName: "Mohamed Siddiq al-Minshawi - Kids repeat", variant: "kids-repeat", sourceType: "quran_foundation" },

  // Beta reciter
  { id: 97, name: "Yasser Ad Dussary", displayName: "Yasser Ad Dussary - beta", variant: "beta", sourceType: "legacy_qdc", slug: "yasser_ad_dossari", qdcSlug: "yasser_ad-dussary" },
];

/**
 * Map of legacy IDs to current IDs for backward compatibility.
 * If a user has a saved reciter ID that was changed, this maps to the new ID.
 */
export const LEGACY_ID_MAP: Record<number, number> = {
  // No ID changes needed currently
  // Add mappings here if IDs change in the future: oldId: newId
};

/**
 * Default reciter ID (Mishari Rashid al-`Afasy)
 */
export const DEFAULT_RECITER_ID = 7;

/**
 * Get a reciter by ID, with fallback to default
 */
export function getReciterById(id: number): ReciterConfig | undefined {
  // Check for legacy ID mapping first
  const mappedId = LEGACY_ID_MAP[id] ?? id;
  return RECITERS.find((r) => r.id === mappedId);
}

/**
 * Resolve a reciter ID, handling legacy mappings and returning a valid ID
 */
export function resolveReciterId(id: number | undefined): number {
  if (id === undefined) return DEFAULT_RECITER_ID;

  // Check legacy mapping
  const mappedId = LEGACY_ID_MAP[id] ?? id;

  // Verify the ID exists in our list
  const exists = RECITERS.some((r) => r.id === mappedId);
  return exists ? mappedId : DEFAULT_RECITER_ID;
}

/**
 * Get the curated reciter list for the ReciterPicker component
 */
export function getCuratedReciters(): { id: number; name: string }[] {
  return RECITERS.map((r) => ({
    id: r.id,
    name: r.displayName,
  }));
}
