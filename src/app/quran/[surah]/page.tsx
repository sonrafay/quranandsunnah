// src/app/quran/[surah]/page.tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { qfGet } from "@/lib/server/qf";
import ReciterPicker, { Reciter } from "@/components/quran/ReciterPicker";
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

type PerAyahSegmentsResponse = {
  audio_files?: Array<{
    verse_key?: string;
    segments?: string[];
  }>;
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

  try {
    const chapterUrl = `https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${surah}?segments=true`;
    const chapterRes = await fetch(chapterUrl, { next: { revalidate: 60 * 60 } });
    if (!chapterRes.ok) {
      const text = await chapterRes.text().catch(() => "");
      throw new Error(`Quran.com API ${chapterRes.status}: ${text}`);
    }

    const data = (await chapterRes.json()) as {
      audio_file?: {
        audio_url?: string;
        timestamps?: Array<{
          verse_key?: string;
          timestamp_from?: number;
          timestamp_to?: number;
          segments?: Array<number[] | string>;
        }>;
      };
    };

    const audioUrl = data.audio_file?.audio_url;
    if (!audioUrl) return null;

    const url = absolutizeAudio(audioUrl) ?? "";
    const timestamps = data.audio_file?.timestamps ?? [];

    const segments: Segment[] = [];
    const wordSegments: WordSegment[] = [];

    for (const ts of timestamps) {
      if (!ts?.verse_key) continue;
      const parts = ts.verse_key.split(":");
      if (parts.length !== 2) continue;
      const ayah = Number(parts[1]);
      if (!Number.isFinite(ayah)) continue;

      if (typeof ts.timestamp_from === "number" && typeof ts.timestamp_to === "number") {
        const start = ts.timestamp_from / 1000;
        const end = ts.timestamp_to / 1000;
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          segments.push({ n: ayah, start, end });
        }
      }

      for (const seg of ts.segments ?? []) {
        const nums = Array.isArray(seg)
          ? seg.map((n) => Number(n)).filter((n) => Number.isFinite(n))
          : typeof seg === "string"
            ? seg.trim().split(/\s+/).map((n) => Number(n)).filter((n) => Number.isFinite(n))
            : [];

        if (nums.length < 3) continue;
        let wordIndex = nums[0];
        let startMs = nums[1];
        let endMs = nums[2];
        if (nums.length >= 4) {
          wordIndex = nums[1];
          startMs = nums[2];
          endMs = nums[3];
        }
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

        wordSegments.push({
          verseNum: ayah,
          wordIndex: Math.max(1, Math.trunc(wordIndex)),
          start: startMs / 1000,
          end: endMs / 1000,
        });
      }
    }

    segments.sort((a, b) => a.start - b.start);
    wordSegments.sort((a, b) => a.start - b.start);

    if (!segments.length) return null;
    return { url, segments, wordSegments };
  } catch (err) {
    console.error("[getSurahAudio] failed", reciterId, surah, err);
    return null;
  }
}

async function getPerAyahWordSegments(
  reciterId: number,
  surah: string
): Promise<Record<number, WordSegment[]>> {
  const reciter = getReciterById(reciterId);
  if (reciter?.sourceType === "legacy_qdc") {
    return {};
  }

  const url = `https://api.quran.com/api/v4/recitations/${reciterId}/by_chapter/${surah}?fields=segments`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("[getPerAyahWordSegments] failed", reciterId, surah, res.status, text);
    return {};
  }

  const data = (await res.json()) as PerAyahSegmentsResponse;
  const byAyah: Record<number, WordSegment[]> = {};

  for (const audio of data.audio_files ?? []) {
    if (!audio.verse_key) continue;
    const parts = audio.verse_key.split(":");
    if (parts.length !== 2) continue;
    const ayahNum = Number(parts[1]);
    if (!Number.isFinite(ayahNum)) continue;

    const segments: WordSegment[] = [];
    for (const seg of audio.segments ?? []) {
      if (typeof seg !== "string") continue;
      const nums = seg
        .trim()
        .split(/\s+/)
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));

      if (nums.length < 3) continue;

      let wordIndex = nums[0];
      let startMs = nums[1];
      let endMs = nums[2];

      if (nums.length >= 4) {
        wordIndex = nums[1];
        startMs = nums[2];
        endMs = nums[3];
      }

      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

      segments.push({
        verseNum: ayahNum,
        wordIndex: Math.max(1, Math.trunc(wordIndex)),
        start: startMs / 1000,
        end: endMs / 1000,
      });
    }

    segments.sort((a, b) => a.start - b.start);
    if (segments.length) {
      byAyah[ayahNum] = segments;
    }
  }

  return byAyah;
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
      cache: "no-store",
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
      cache: "no-store",
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

  const perAyahWordSegments = surahAudio ? {} : await getPerAyahWordSegments(selectedR, surah);

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
          reciters={reciters}
          selectedReciterId={selectedR}
        />
      ) : (
        <AudioPlayerBar
          mode="perAyah"
          surah={data.chapter}
          items={audioItems}
          wordSegmentsByAyah={perAyahWordSegments}
          wordCounts={wordCounts}
          reciters={reciters}
          selectedReciterId={selectedR}
        />
      )}
    </>
  );
}
