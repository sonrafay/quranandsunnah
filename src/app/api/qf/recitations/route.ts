import { NextResponse } from "next/server";
import { getCuratedReciters } from "@/lib/reciters";
import { loadDemoRegistry } from "@/lib/demoRegistry.server";

// Caching disabled — runtime helper demos must show up immediately after
// /api/hackathon-align writes to registry.json.
export const dynamic = "force-dynamic";

export async function GET() {
  const reciters = getCuratedReciters();
  const registry = await loadDemoRegistry();
  const demoRecs = registry.demos.map((d) => ({ id: d.id, reciter_name: d.displayName }));
  const recitations = [...reciters.map((r) => ({ id: r.id, reciter_name: r.name })), ...demoRecs];
  return NextResponse.json({ recitations });
}
