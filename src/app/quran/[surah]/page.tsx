// src/app/quran/[surah]/page.tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { qfGet } from "@/lib/server/qf";
import ReciterPicker, { Reciter } from "@/components/quran/ReciterPicker";
import ScrollProgressBar from "@/components/ScrollProgressBar";
import SurahFooterNav from "@/components/quran/SurahFooterNav";
import AudioPlayerBar, { AudioItem, Segment } from "@/components/quran/AudioPlayerBar";
import SurahTitle from "@/components/quran/SurahTitle";
import BookmarksLayer from "@/components/quran/BookmarksLayer";
import QuranRecentTracker from "@/components/quran/QuranRecentTracker";
import SurahSideNav from "@/components/quran/SurahSideNav";
import SurahPicker from "@/components/quran/SurahPicker";


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

type QFRecitation = { id: number; reciter_name: string };

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


async function getReciters(): Promise<Reciter[]> {
  const data = await qfGet<{ recitations: { id: number; reciter_name: string }[] }>(
    "/resources/recitations",
    { revalidate: 60 * 60 * 24 }
  );
  const seen = new Map<number, string>();
  for (const r of data.recitations ?? []) {
    if (!seen.has(r.id)) seen.set(r.id, r.reciter_name);
  }
  return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

// Single full-surah audio + timings (segments)
async function getSurahAudio(
  reciterId: number,
  surah: string
): Promise<{ url: string; segments: Segment[]; duration?: number } | null> {
  try {
    const res = await qfGet<{ audio_files: any[] }>(
      `/recitations/${reciterId}/audio_files`,
      { query: { chapter_number: surah, fields: "url,duration,segments" }, revalidate: 60 * 60 }
    );
    const af = res.audio_files?.[0];
    if (!af?.url) return null;

    const url = absolutizeAudio(af.url) ?? "";
    const duration = typeof af.duration === "number" ? af.duration : undefined;

    const raw: any[] =
      Array.isArray(af.segments) && Array.isArray(af.segments[0])
        ? (af.segments[0] as any[])
        : [];

    const segments: Segment[] = raw
      .map((triple: any): Segment | null => {
        const [startMs, durMs, idx] = triple || [];
        if (typeof idx !== "number" || idx < 0) return null;
        const n = idx + 1;
        const start = (Number(startMs) || 0) / 1000;
        const end = start + (Number(durMs) || 0) / 1000;
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
        return { n, start, end };
      })
      .filter((s): s is Segment => s !== null)
      .sort((a, b) => a.n - b.n);

    if (!segments.length) return null;
    return { url, segments, duration };
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

function pickDefaultReciter(list: Reciter[]): number {
  const mishari = list.find((r) => /mishari|alafasy|afasy/i.test(r.name));
  return mishari?.id ?? list[0]?.id ?? 1;
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

  if (opts.reciterId) query.audio = String(opts.reciterId);

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

      return {
        n: v.verse_number,
        key: v.verse_key,
        arabic: v.text_uthmani || "",
        textIndopak: v.text_indopak,
        textTajweed: v.text_uthmani_tajweed,
        words: v.words,
        translations,
        transliterations,
        audioUrl: absolutizeAudio(v.audio?.url),
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

  const [meta, reciters] = await Promise.all([
    getChapterMeta(surah),
    getReciters(),
  ]);

  // Translation IDs come from URL params (synced from user settings via SurahContentWrapper)
  const selectedT = parseIdList(searchParams?.t);
  const selectedTL = parseIdList(searchParams?.tl); // Transliterations (optional, no default)
  const selectedR = parseIdList(searchParams?.r)?.[0] ?? pickDefaultReciter(reciters);
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
          totalDuration={surahAudio.duration}
        />
      ) : (
        <AudioPlayerBar mode="perAyah" surah={data.chapter} items={audioItems} />
      )}
    </>
  );
}
