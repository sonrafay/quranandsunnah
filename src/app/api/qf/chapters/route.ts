import { NextResponse } from "next/server";
import { qfGet } from "@/lib/server/qf";

export const revalidate = 86400;

export async function GET() {
  // QF v4 chapters response sample in docs
  type Src = {
    chapters: Array<{
      id: number;
      name_arabic: string;
      name_simple: string;
      name_complex: string;
      revelation_place?: string;
      revelation_order?: number;
      verses_count: number;
      pages?: [number, number];
      translated_name?: { language_name: string; name: string };
    }>;
  };

  const data = await qfGet<Src>("/chapters", { revalidate: 86400 });
  // normalize
  const chapters = data.chapters.map((c) => ({
    id: c.id,
    nameArabic: c.name_arabic,
    nameEnglish: c.name_complex || c.name_simple,
    englishAlt: c.translated_name?.name,
    versesCount: c.verses_count,
    revelationPlace: c.revelation_place,
    revelationOrder: c.revelation_order,
  }));
  return NextResponse.json({ chapters });
}
