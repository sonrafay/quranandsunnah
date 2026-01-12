import Link from "next/link";
import { qfGet } from "@/lib/server/qf";
import QuranIndexClient from "./QuranIndexClient";

type QFChapter = {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name?: { name?: string };
  verses_count: number;
  revelation_place?: string;
};

export const metadata = { title: "Quran" };

async function getChapters() {
  const data = await qfGet<{ chapters: QFChapter[] }>("/chapters", {
    query: { language: "en" },
    revalidate: 60 * 60 * 24,
  });

  return (data.chapters ?? []).map((c) => ({
    id: c.id,
    arabicName: c.name_arabic,
    englishName: c.name_simple,
    englishNick: c.translated_name?.name ?? "",
    verses: c.verses_count,
    place: c.revelation_place ?? "",
  }));
}

export default async function QuranIndexPage() {
  const chapters = await getChapters();

  return (
    <div className="min-h-screen pt-32 pb-8 sm:pt-28 sm:pb-12">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Quran</h1>
          <p className="text-muted-foreground mt-1">
            Choose a Surah or search by name/number.
          </p>
        </div>

        <QuranIndexClient chapters={chapters} />
      </div>
    </div>
  );
}
