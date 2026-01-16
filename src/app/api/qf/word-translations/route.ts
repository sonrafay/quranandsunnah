import { NextResponse } from "next/server";
import { qfGet } from "@/lib/server/qf";

export const revalidate = 86400;

export async function GET() {
  // Word-by-word translations are available per language
  // The quran.com API provides word translations via the `translation` field on each word
  // Language ID is passed to get the translation in that language

  type LanguagesResponse = {
    languages: Array<{
      id: number;
      name: string;
      iso_code: string;
      native_name: string;
      direction: string;
      translations_count: number;
    }>;
  };

  try {
    const data = await qfGet<LanguagesResponse>("/resources/languages", { revalidate: 86400 });

    // Filter languages that have translations available
    // and sort by translations count (most supported first)
    const languages = data.languages
      .filter((lang) => lang.translations_count > 0)
      .sort((a, b) => b.translations_count - a.translations_count)
      .map((lang) => ({
        id: lang.id,
        title: lang.name,
        nativeName: lang.native_name,
        isoCode: lang.iso_code,
        direction: lang.direction,
      }));

    return NextResponse.json({ languages });
  } catch (error) {
    console.error("[word-translations] Error fetching languages:", error);
    return NextResponse.json({ languages: [] });
  }
}
