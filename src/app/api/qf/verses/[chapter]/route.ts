import { NextResponse } from "next/server";
import { qfGet } from "@/lib/server/qf";

type Params = { params: { chapter: string } };

export const revalidate = 1800;

export async function GET(req: Request, { params }: Params) {
  const { chapter } = params;
  const { searchParams } = new URL(req.url);
  const translationId = searchParams.get("translationId") || ""; // e.g., 131
  const words = searchParams.get("words") || ""; // e.g., "indopak" | "uthmani" | "uthmani_tajweed"
  const page = searchParams.get("page") || "1";
  const perPage = searchParams.get("perPage") || "300";

  // Build query for QF; translation id and script flags vary by endpoint – v4 supports these params.
  // See Verses/By Chapter + script endpoints in docs.
  const query: Record<string, string> = { page, per_page: perPage };
  if (translationId) query["translations"] = translationId;
  if (words) query["words"] = words; // optional, depends on QF endpoint

  type Src = {
    verses: Array<{
      id: number;
      verse_number: number;
      verse_key: string; // e.g. "2:255"
      text_uthmani?: string;
      text_indopak?: string;
      text_uthmani_tajweed?: string;
      translations?: Array<{ id: number; text: string; resource_name?: string }>;
    }>;
  };

  const data = await qfGet<Src>(`/verses/by_chapter/${chapter}`, { query, revalidate: 1800 });
  const verses = data.verses.map((v) => ({
    n: v.verse_number,
    key: v.verse_key,
    arabic: v.text_uthmani || v.text_indopak || v.text_uthmani_tajweed || "",
    translation: v.translations?.[0]?.text,
    translationSource: v.translations?.[0]?.resource_name,
  }));

  return NextResponse.json({ chapter: Number(chapter), verses });
}
