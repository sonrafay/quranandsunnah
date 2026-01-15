import { NextResponse } from "next/server";
import { qfGet } from "@/lib/server/qf";

export const revalidate = 86400;

export async function GET() {
  // Get transliterations from the translations endpoint with resource_type filtering
  type Src = {
    translations: Array<{
      id: number;
      name: string;
      translator_name?: string;
      language_name: string;
      slug?: string;
      resource_type?: string;
    }>;
  };

  try {
    const data = await qfGet<Src>("/resources/translations", { revalidate: 86400 });

    // Filter for transliteration resources
    const transliterations = (data.translations ?? [])
      .filter((t) => {
        if (t.resource_type === "transliteration") return true;
        const nameMatch = t.name?.toLowerCase().includes("transliteration");
        const slugMatch = t.slug?.toLowerCase().includes("transliteration");
        return nameMatch || slugMatch;
      })
      .map((t) => ({
        id: t.id,
        title: t.name,
        lang: t.language_name,
        translator: t.translator_name,
        slug: t.slug,
      }));

    console.log("[transliterations API] Found transliterations:", transliterations.map(t => ({ id: t.id, title: t.title, lang: t.lang })));
    return NextResponse.json({ transliterations });
  } catch (error) {
    console.error("Failed to fetch transliterations:", error);
    return NextResponse.json({ transliterations: [] });
  }
}
