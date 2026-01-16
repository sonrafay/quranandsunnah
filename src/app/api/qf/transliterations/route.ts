import { NextResponse } from "next/server";

export const revalidate = 86400;

export async function GET() {
  // For now, we only support English inline transliteration
  // This is the standard word-by-word romanization of Arabic text
  // Future: Implement proper word-by-word transliteration system with multiple languages

  const transliterations = [
    {
      id: 174, // English language ID for word-by-word transliteration
      title: "English Transliteration",
      lang: "english",
      translator: null,
      slug: "en",
    }
  ];

  return NextResponse.json({ transliterations });
}
