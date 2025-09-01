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
    }>;
  };
  const data = await qfGet<Src>("/resources/translations", { revalidate: 86400 });
  const list = data.translations.map((t) => ({
    id: t.id,
    title: t.name,
    lang: t.language_name,
    translator: t.translator_name,
    slug: t.slug,
  }));
  return NextResponse.json({ translations: list });
}
