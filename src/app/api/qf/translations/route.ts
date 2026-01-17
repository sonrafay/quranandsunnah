import { NextResponse } from "next/server";
import { qfGet } from "@/lib/server/qf";

export const revalidate = 86400;

export async function GET() {
  type Src = {
    translations: Array<{
      id: number;
      name: string; // translator/work name
      translator_name?: string;
      language_name: string;
      slug?: string;
      resource_type?: string;
    }>;
  };
  const data = await qfGet<Src>("/resources/translations", { revalidate: 86400 });

  // Filter for translation resources only (exclude transliterations)
  const list = data.translations
    .filter((t) => {
      // Exclude if resource_type is explicitly "transliteration"
      if (t.resource_type === "transliteration") return false;

      // Exclude if name or slug contains "transliteration"
      const nameMatch = t.name?.toLowerCase().includes("transliteration");
      const slugMatch = t.slug?.toLowerCase().includes("transliteration");

      return !nameMatch && !slugMatch;
    })
    .map((t) => ({
      id: t.id,
      title: t.name,
      lang: t.language_name,
      translator: t.translator_name,
      slug: t.slug,
    }));
  return NextResponse.json({ translations: list });
}
