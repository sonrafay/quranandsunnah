import type { Metadata } from "next";
import { qfGet } from "@/lib/server/qf";
import VerseActions from "@/components/quran/VerseActions";
import TranslationMultiPicker, { TranslationItem } from "@/components/quran/TranslationMultiPicker";
import ReciterPicker, { Reciter } from "@/components/quran/ReciterPicker";
import ScrollProgressBar from "@/components/ScrollProgressBar";
import SurahFooterNav from "@/components/quran/SurahFooterNav";
import AudioPlayerBar, { AudioItem, Segment } from "@/components/quran/AudioPlayerBar";
import SurahTitle from "@/components/quran/SurahTitle";

type QFVerse = {
  verse_number: number;
  verse_key: string;
  text_uthmani?: string;
  translations?: Array<{ text: string; resource_name?: string }>;
  audio?: { url?: string };
};

type QFTranslation = {
  id: number;
  name: string;
  language_name: string;
  translator_name?: string;
  slug?: string;
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
  // The QF stack serves audio from these CDNs; accept either
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

async function getTranslations(): Promise<TranslationItem[]> {
  const data = await qfGet<{ translations: QFTranslation[] }>(
    "/resources/translations",
    { revalidate: 60 * 60 * 24 }
  );
  return (data.translations ?? []).map((t) => ({
    id: t.id,
    title: t.name || t.slug || String(t.id),
    lang: t.language_name || "Unknown",
    translator: t.translator_name ?? null,
  }));
}

async function getReciters(): Promise<Reciter[]> {
  const data = await qfGet<{ recitations: QFRecitation[] }>(
    "/resources/recitations",
    { revalidate: 60 * 60 * 24 }
  );
  return (data.recitations ?? []).map((r) => ({ id: r.id, name: r.reciter_name }));
}

// Single full-surah audio + timings (segments)
async function getSurahAudio(
  reciterId: number,
  surah: string
): Promise<{ url: string; segments: Segment[]; duration?: number } | null> {
  try {
    // Docs: /recitations/{recitation_id}/audio_files?chapter_number=...&fields=url,duration,segments
    const res = await qfGet<{ audio_files: any[] }>(
      `/recitations/${reciterId}/audio_files`,
      { query: { chapter_number: surah, fields: "url,duration,segments" }, revalidate: 60 * 60 }
    );

    const af = res.audio_files?.[0];
    if (!af?.url) return null;

    const url = absolutizeAudio(af.url) ?? "";
    const duration = typeof af.duration === "number" ? af.duration : undefined;

    // segments is nested: [[ [startMs, durMs, zeroBasedAyahIdx], ... ]]
    const raw: any[] =
      Array.isArray(af.segments) && Array.isArray(af.segments[0]) ? (af.segments[0] as any[]) : [];

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

function pickDefaultTranslation(list: TranslationItem[]): number[] {
  const haleem = list.find(
    (t) =>
      t.lang.toLowerCase() === "english" &&
      (/haleem/i.test(t.title) || /haleem/i.test(t.translator || ""))
  );
  if (haleem) return [haleem.id];
  const eng = list.find((t) => t.lang.toLowerCase() === "english");
  if (eng) return [eng.id];
  return list[0] ? [list[0].id] : [];
}

function pickDefaultReciter(list: Reciter[]): number {
  const mishari = list.find((r) => /mishari|alafasy|afasy/i.test(r.name));
  return mishari?.id ?? list[0]?.id ?? 1;
}

async function fetchVerses(
  surah: string,
  opts: { translationIds?: number[]; reciterId?: number }
): Promise<{
  chapter: number;
  verses: { n: number; key: string; arabic: string; translations: { text: string; source?: string }[]; audioUrl?: string }[];
}> {
  const baseQuery: Record<string, string> = {
    page: "1",
    per_page: "300",
    fields: "text_uthmani,verse_key,verse_number",
  };

  const query: Record<string, string> = { ...baseQuery };
  if (opts.translationIds?.length) query.translations = opts.translationIds.join(",");
  // we still pass audio as a fallback source for per-ayah urls
  if (opts.reciterId) query.audio = String(opts.reciterId);

  try {
    const data = await qfGet<{ verses: QFVerse[] }>(`/verses/by_chapter/${surah}`, {
      query,
      revalidate: 60 * 60,
    });

    const verses = (data.verses ?? []).map((v) => ({
      n: v.verse_number,
      key: v.verse_key,
      arabic: v.text_uthmani || "",
      translations: v.translations?.map((t) => ({ text: t.text, source: t.resource_name })) ?? [],
      audioUrl: absolutizeAudio(v.audio?.url),
    }));

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
      translations: [],
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
  searchParams: { t?: string; r?: string };
}) {
  const surah = params.surah;

  const [meta, catalog, reciters] = await Promise.all([
    getChapterMeta(surah),
    getTranslations(),
    getReciters(),
  ]);

  const selectedT = parseIdList(searchParams?.t) ?? pickDefaultTranslation(catalog);
  const selectedR = parseIdList(searchParams?.r)?.[0] ?? pickDefaultReciter(reciters);

  // verses + single-track audio with timings
  const [data, surahAudio] = await Promise.all([
    fetchVerses(surah, { translationIds: selectedT, reciterId: selectedR }),
    getSurahAudio(selectedR, surah),
  ]);

  const audioItems: AudioItem[] = data.verses
    .map((v) => ({ n: v.n, key: v.key, url: v.audioUrl || "" }))
    .filter((x) => !!x.url);

  return (
    <>
      <ScrollProgressBar height={2} />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-28">
        {/* HEADER */}
        <SurahTitle id={data.chapter} arabicName={meta.arabicName} englishNick={meta.englishNick} />


        {/* Controls */}
        <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
          <ReciterPicker reciters={reciters} selectedId={selectedR} />
          <TranslationMultiPicker translations={catalog} selectedIds={selectedT} />
        </div>

        {/* Verses */}
        <div className="space-y-8">
          {data.verses.map((v) => (
        <article
          key={v.key}
          id={`ayah-${v.n}`}
          className="
            relative scroll-mt-28 md:scroll-mt-36
            rounded-2xl border bg-background/60
            p-5 md:p-6 pl-14 md:pl-16
            min-h-44 md:min-h-52
            flex flex-col justify-center
          "
        >
          {/* Action icons column — vertically centered */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2">
            <VerseActions
              compact
              surah={data.chapter}
              ayah={v.n}
              textToCopy={[v.arabic, ...v.translations.map((t) => t.text)]
                .filter(Boolean)
                .join('\n')}
            />
          </div>

          {/* Arabic */}
          <div
            className="font-quran text-3xl md:text-4xl leading-[2.6rem] md:leading-[3.1rem]"
            dir="rtl"
          >
            {v.arabic}
          </div>

          {/* Translations (stacked) */}
          {v.translations.map((t, i) => (
            <div
              key={i}
              className="mt-4 text-base md:text-lg leading-relaxed text-muted-foreground"
              dir="ltr"
            >
              {t.text}
              {t.source && <span className="ml-2 opacity-70">— {t.source}</span>}
            </div>
          ))}
        </article>


          ))}
        </div>

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
