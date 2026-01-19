// src/app/quran/[surah]/page.tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { qfGet } from "@/lib/server/qf";
import ReciterPicker, { Reciter } from "@/components/quran/ReciterPicker";
import ScrollProgressBar from "@/components/ScrollProgressBar";
import SurahFooterNav from "@/components/quran/SurahFooterNav";
import AudioPlayerBar, { AudioItem, Segment, WordSegment } from "@/components/quran/AudioPlayerBar";
import SurahTitle from "@/components/quran/SurahTitle";
import BookmarksLayer from "@/components/quran/BookmarksLayer";
import QuranRecentTracker from "@/components/quran/QuranRecentTracker";
import SurahSideNav from "@/components/quran/SurahSideNav";
import SurahPicker from "@/components/quran/SurahPicker";
import { getCuratedReciters, resolveReciterId, getReciterById } from "@/lib/reciters";


// ✅ Mount the compact left notes box (client-only)
const NotesPanel = dynamic(() => import("@/components/quran/NotesPanel"), { ssr: false });
const SurahContentWrapper = dynamic(() => import("@/components/quran/SurahContentWrapper"), { ssr: false });

type QFWord = {
  transliteration?: { text?: string; language_name?: string };
  translation?: { text?: string; language_name?: string };
  code_v1?: string;  // QCF V1 glyph code
  code_v2?: string;  // QCF V2 glyph code
  v1_page?: number;  // Page number for V1 font
  v2_page?: number;  // Page number for V2 font
  qpc_uthmani_hafs?: string; // QPC glyph code
  text_uthmani?: string; // Fallback text
  char_type_name?: string; // "word" or "end" (for end of ayah marker)
};

type QFVerse = {
  verse_number: number;
  verse_key: string;
  text_uthmani?: string;
  text_indopak?: string;
  text_uthmani_tajweed?: string;
  translations?: Array<{ text: string; resource_name?: string; resource_id?: number }>;
  words?: QFWord[];
  audio?: { url?: string };
};


type QFChapter = {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name?: { language_name?: string; name?: string };
};

function absolutizeAudio(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://audio.qurancdn.com/${url.replace(/^\/?/, "")}`;
}

async function getChapterMeta(id: string) {
  const data = await qfGet<{ chapter: QFChapter }>(`/chapters/${id}`, {
    query: { language: "en" },
    revalidate: 60 * 60 * 24,
  });
  const c = data.chapter;
  return {
    id: c.id,
    arabicName: c.name_arabic,
    englishName: c.name_simple,
    englishNick: c.translated_name?.name ?? "",
  };
}


// Use curated reciter list (matches Quran.com exactly)
function getReciters(): Reciter[] {
  return getCuratedReciters();
}

// Single full-surah audio + timings (segments)
async function getSurahAudio(
  reciterId: number,
  surah: string
): Promise<{ url: string; segments: Segment[]; wordSegments: WordSegment[]; duration?: number } | null> {
  const reciter = getReciterById(reciterId);

  // Handle beta reciters - fall back to per-verse mode using legacy URLs
  // Beta reciters don't have chapter-level audio with timing segments in the QF API,
  // so we use per-verse audio files from verses.quran.com CDN instead.
  // This provides working audio playback with auto-advance between verses.
  if (reciter?.sourceType === "legacy_qdc") {
    return null; // Fall back to per-verse mode (audioItems will be populated in fetchVerses)
  }

  // Standard reciters use Quran.Foundation API
  type AudioFile = {
    url?: string;
    duration?: number;
    segments?: unknown[][];
  };

  try {
    const res = await qfGet<{ audio_files: AudioFile[] }>(
      `/recitations/${reciterId}/audio_files`,
      { query: { chapter_number: surah, fields: "url,duration,segments" }, revalidate: 60 * 60 }
    );
    const af = res.audio_files?.[0];
    if (!af?.url) return null;

    const url = absolutizeAudio(af.url) ?? "";
    const duration = typeof af.duration === "number" ? af.duration : undefined;

    // Raw segments format: [[[startMs, durationMs, verseIdx], ...]]
    // Each triplet is a word, verseIdx identifies which verse (0-based)
    const raw: unknown[] =
      Array.isArray(af.segments) && Array.isArray(af.segments[0])
        ? (af.segments[0] as unknown[])
        : [];

    // Build verse-level segments (for verse highlighting and navigation)
    // Group by verse index and find min start / max end
    const verseStarts = new Map<number, number>();
    const verseEnds = new Map<number, number>();

    for (const triple of raw) {
      if (!Array.isArray(triple) || triple.length < 3) continue;
      const [startMs, durMs, verseIdx] = triple;
      if (typeof verseIdx !== "number" || verseIdx < 0) continue;
      if (typeof startMs !== "number" || typeof durMs !== "number") continue;

      const start = startMs / 1000;
      const end = (startMs + durMs) / 1000;

      if (!verseStarts.has(verseIdx) || start < verseStarts.get(verseIdx)!) {
        verseStarts.set(verseIdx, start);
      }
      if (!verseEnds.has(verseIdx) || end > verseEnds.get(verseIdx)!) {
        verseEnds.set(verseIdx, end);
      }
    }

    const segments: Segment[] = Array.from(verseStarts.keys())
      .sort((a, b) => a - b)
      .map((verseIdx) => ({
        n: verseIdx + 1, // 1-based verse number
        start: verseStarts.get(verseIdx)!,
        end: verseEnds.get(verseIdx)!,
      }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);

    // Build word-level segments for word-by-word highlighting
    // Track word index within each verse
    const wordCountPerVerse = new Map<number, number>();
    const wordSegments: WordSegment[] = [];

    for (const triple of raw) {
      if (!Array.isArray(triple) || triple.length < 3) continue;
      const [startMs, durMs, verseIdx] = triple;
      if (typeof verseIdx !== "number" || verseIdx < 0) continue;
      if (typeof startMs !== "number" || typeof durMs !== "number") continue;

      const start = startMs / 1000;
      const end = (startMs + durMs) / 1000;

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

      // Increment word index for this verse (1-based)
      const wordIndex = (wordCountPerVerse.get(verseIdx) ?? 0) + 1;
      wordCountPerVerse.set(verseIdx, wordIndex);

      wordSegments.push({
        verseNum: verseIdx + 1, // 1-based verse number
        wordIndex,              // 1-based word index within verse
        start,
        end,
      });
    }

    // Sort word segments by start time for efficient binary search
    wordSegments.sort((a, b) => a.start - b.start);

    if (!segments.length) return null;
    return { url, segments, wordSegments, duration };
  } catch {
    return null;
  }
}

function parseIdList(param?: string): number[] | undefined {
  if (!param) return undefined;
  const ids = param
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  return ids.length ? ids : undefined;
}

// Map language ID to ISO code for word-by-word translation
// The Quran.com API expects ISO code (e.g., "ur") not numeric ID (e.g., 38)
async function getLanguageIsoCode(langId: number): Promise<string | null> {
  try {
    const data = await qfGet<{ languages: Array<{ id: number; iso_code: string }> }>(
      "/resources/languages",
      { revalidate: 60 * 60 * 24 }
    );
    const lang = data.languages?.find((l) => l.id === langId);
    return lang?.iso_code || null;
  } catch {
    return null;
  }
}

/**
 * Generate per-verse audio URL for legacy QDC reciters
 * Format: https://verses.quran.com/{slug}/{surah_padded}{verse_padded}.mp3
 */
function getLegacyVerseAudioUrl(slug: string, surah: number, verse: number): string {
  const surahPadded = String(surah).padStart(3, "0");
  const versePadded = String(verse).padStart(3, "0");
  return `https://verses.quran.com/${slug}/${surahPadded}${versePadded}.mp3`;
}

async function fetchVerses(
  surah: string,
  opts: {
    translationIds?: number[];
    transliterationIds?: number[];
    reciterId?: number;
    wordTranslationLangId?: number;  // Language ID for word-by-word translation
    wordTranslationIsoCode?: string; // ISO code for word-by-word translation (e.g., "ur")
  }
): Promise<{
  chapter: number;
  verses: { n: number; key: string; arabic: string; textIndopak?: string; textTajweed?: string; words?: QFWord[]; translations: { text: string; source?: string; resourceId?: number }[]; transliterations: { text: string; source?: string; resourceId?: number }[]; audioUrl?: string }[];
}> {
  // Check if this is a beta reciter that needs legacy URLs
  const reciter = opts.reciterId ? getReciterById(opts.reciterId) : undefined;
  const useLegacyAudio = reciter?.sourceType === "legacy_qdc" && reciter.slug;

  const baseQuery: Record<string, string> = {
    page: "1",
    per_page: "300",
    fields: "text_uthmani,text_indopak,text_uthmani_tajweed,verse_key,verse_number",
    words: "true", // Always fetch word data for glyph-based fonts and word-by-word feature
    // Include translation and transliteration for word-by-word hover feature
    word_fields: "code_v1,code_v2,v1_page,v2_page,qpc_uthmani_hafs,text_uthmani,translation,transliteration,char_type_name",
  };
  const query: Record<string, string> = { ...baseQuery };

  // Add translations parameter
  if (opts.translationIds?.length) {
    query.translations = opts.translationIds.join(",");
  }

  // Add language parameter for word-by-word translation
  // The 'language' parameter controls the language of word.translation.text
  // IMPORTANT: API expects ISO code (e.g., "ur"), not numeric ID (e.g., 38)
  if (opts.wordTranslationIsoCode) {
    query.language = opts.wordTranslationIsoCode;
  }

  // Only add audio param for non-legacy reciters (API doesn't support beta reciters)
  if (opts.reciterId && !useLegacyAudio) query.audio = String(opts.reciterId);

  try {
    const data = await qfGet<{ verses: QFVerse[] }>(`/verses/by_chapter/${surah}`, {
      query,
      revalidate: 60 * 60,
    });

    const verses = (data.verses ?? []).map((v) => {
      const translations: { text: string; source?: string; resourceId?: number }[] = [];
      const transliterations: { text: string; source?: string; resourceId?: number }[] = [];

      // Extract translations
      (v.translations ?? []).forEach((t) => {
        translations.push({
          text: t.text,
          source: t.resource_name,
          resourceId: t.resource_id
        });
      });

      // Extract word-by-word transliterations from words field
      // ONLY if transliterationIds was explicitly provided (not empty)
      if (opts.transliterationIds?.length && v.words && Array.isArray(v.words)) {
        const translitText = v.words
          .map(w => w.transliteration?.text || "")
          .filter(Boolean)
          .join(" ");

        if (translitText) {
          const langName = v.words.find(w => w.transliteration?.language_name)?.transliteration?.language_name;
          transliterations.push({
            text: translitText,
            source: langName ? `${langName} Transliteration` : "English Transliteration",
            resourceId: opts.transliterationIds[0]
          });
        }
      }

      // Generate audio URL: use legacy URL for beta reciters, API URL for standard reciters
      let audioUrl: string | undefined;
      if (useLegacyAudio && reciter?.slug) {
        audioUrl = getLegacyVerseAudioUrl(reciter.slug, Number(surah), v.verse_number);
      } else {
        audioUrl = absolutizeAudio(v.audio?.url);
      }

      return {
        n: v.verse_number,
        key: v.verse_key,
        arabic: v.text_uthmani || "",
        textIndopak: v.text_indopak,
        textTajweed: v.text_uthmani_tajweed,
        words: v.words,
        translations,
        transliterations,
        audioUrl,
      };
    });
    return { chapter: Number(surah), verses };
  } catch {
    const fallback = await qfGet<{ verses: QFVerse[] }>(`/verses/by_chapter/${surah}`, {
      query: baseQuery,
      revalidate: 60 * 60,
    });
    const verses = (fallback.verses ?? []).map((v) => ({
      n: v.verse_number,
      key: v.verse_key,
      arabic: v.text_uthmani || "",
      textIndopak: v.text_indopak,
      textTajweed: v.text_uthmani_tajweed,
      words: v.words,
      translations: [],
      transliterations: [],
      audioUrl: undefined,
    }));
    return { chapter: Number(surah), verses };
  }
}

export async function generateMetadata({ params }: { params: { surah: string } }): Promise<Metadata> {
  return { title: `Surah ${params.surah}` };
}

export default async function SurahPage({
  params,
  searchParams,
}: {
  params: { surah: string };
  searchParams: { t?: string; tl?: string; r?: string; wt?: string };
}) {
  const surah = params.surah;

  // Curated reciter list (synchronous, no API call needed)
  const reciters = getReciters();
  const meta = await getChapterMeta(surah);

  // Translation IDs come from URL params (synced from user settings via SurahContentWrapper)
  const selectedT = parseIdList(searchParams?.t);
  const selectedTL = parseIdList(searchParams?.tl); // Transliterations (optional, no default)
  // Use resolveReciterId for backward-compatible ID resolution
  const selectedR = resolveReciterId(parseIdList(searchParams?.r)?.[0]);
  // Word-by-word translation language ID from URL (wt param)
  const wordTranslationLangId = searchParams?.wt ? parseInt(searchParams.wt, 10) : undefined;

  // Look up ISO code for word-by-word translation language
  // API expects ISO code (e.g., "ur") not numeric ID (e.g., 38)
  const wordTranslationIsoCode = wordTranslationLangId && !isNaN(wordTranslationLangId)
    ? await getLanguageIsoCode(wordTranslationLangId)
    : null;

  const [data, surahAudio] = await Promise.all([
    fetchVerses(surah, {
      translationIds: selectedT,
      transliterationIds: selectedTL,
      reciterId: selectedR,
      wordTranslationIsoCode: wordTranslationIsoCode || undefined,
    }),
    getSurahAudio(selectedR, surah),
  ]);

  const audioItems: AudioItem[] = data.verses
    .map((v) => ({ n: v.n, key: v.key, url: v.audioUrl || "" }))
    .filter((x) => !!x.url);

  // Compute word counts per verse for word-by-word audio highlighting
  // Only count actual words (exclude end markers)
  const wordCounts = new Map<number, number>();
  for (const verse of data.verses) {
    if (verse.words) {
      const count = verse.words.filter(w => w.char_type_name !== "end").length;
      wordCounts.set(verse.n, count);
    }
  }

  return (
    <>
      <ScrollProgressBar height={2} />
      <SurahSideNav current={data.chapter} />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">
        {/* HEADER */}
        <SurahTitle id={data.chapter} arabicName={meta.arabicName} englishNick={meta.englishNick} />

        {/* Controls row: Surah selector (left) | Reciter selector (right) */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <SurahPicker currentSurah={data.chapter} />
          <ReciterPicker reciters={reciters} selectedId={selectedR} />
        </div>

        {/* Subscribe + paint bookmark highlights */}
        <BookmarksLayer surah={data.chapter} />

        {/* Save recent readings (invisible) */}
        <QuranRecentTracker surah={data.chapter} />
        {/* ✅ Mount the compact left-side NotesPanel once */}
        <NotesPanel />

        {/* Verses */}
        <SurahContentWrapper chapter={data.chapter} verses={data.verses} />

        <SurahFooterNav current={data.chapter} />
      </div>

      {/* Global audio bar — prefer SINGLE track + segments */}
      {surahAudio ? (
        <AudioPlayerBar
          mode="single"
          surah={data.chapter}
          trackUrl={surahAudio.url}
          segments={surahAudio.segments}
          wordSegments={surahAudio.wordSegments}
          totalDuration={surahAudio.duration}
          wordCounts={wordCounts}
        />
      ) : (
        <AudioPlayerBar mode="perAyah" surah={data.chapter} items={audioItems} wordCounts={wordCounts} />
      )}
    </>
  );
}
