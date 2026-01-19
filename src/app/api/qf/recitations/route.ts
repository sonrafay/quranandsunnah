import { NextResponse } from "next/server";
import { getCuratedReciters } from "@/lib/reciters";

export const revalidate = 86400;

// Return curated reciter list (matches Quran.com exactly)
export async function GET() {
  const reciters = getCuratedReciters();
  // Format to match legacy API response structure
  const recitations = reciters.map((r) => ({
    id: r.id,
    reciter_name: r.name,
  }));
  return NextResponse.json({ recitations });
}
