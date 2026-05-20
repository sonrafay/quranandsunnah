// src/app/hackathon-helper/page.tsx
//
// Self-contained UI for the Quran.foundation hackathon forced-alignment helper.
// This page is intentionally NOT linked from the main app navigation — it's a
// standalone tool that lives alongside the product to show what was built for
// the hackathon. See HACKATHON.md at the repo root for a full write-up.
//
// Flow:
//   1. User enters reciter name, picks surah, supplies audio (file OR YouTube URL).
//   2. Form POSTs to /api/hackathon-align which streams script progress as SSE.
//   3. On success the registry is updated and the user can open the result in
//      the main /quran/{surah} player.

import { promises as fs } from "node:fs";
import path from "node:path";
import { loadDemoRegistry } from "@/lib/demoRegistry.server";
import type { DemoRegistryEntry } from "@/lib/demoRegistry";
import { RECITERS } from "@/lib/reciters";
import HackathonHelperClient from "./HackathonHelperClient";

export const metadata = { title: "Forced-Alignment Helper · Hackathon" };
export const dynamic = "force-dynamic";

// Find which surahs each curated local_demo reciter has aligned JSON for so the
// helper UI can render a "Play Surah N" button per existing alignment.
async function discoverSurahsForSlug(slug: string): Promise<number[]> {
  try {
    const dir = path.join(process.cwd(), "public", "demo", slug);
    const entries = await fs.readdir(dir);
    const out: number[] = [];
    for (const e of entries) {
      const m = /^(\d{3})\.json$/.exec(e);
      if (m && !e.endsWith(".report.json")) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 114) out.push(n);
      }
    }
    return out.sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export default async function HackathonHelperPage() {
  const registry = await loadDemoRegistry();

  // Convert curated local_demo entries (RECITERS in reciters.ts) into the same
  // shape so the unified "Your demos" list shows both pre-baked and helper-made
  // alignments. Curated entries take precedence on slug collisions.
  const curatedDemos: DemoRegistryEntry[] = [];
  for (const r of RECITERS) {
    if (r.sourceType !== "local_demo" || !r.slug) continue;
    const surahs = await discoverSurahsForSlug(r.slug);
    curatedDemos.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      displayName: r.displayName,
      surahs,
    });
  }

  const curatedSlugs = new Set(curatedDemos.map((d) => d.slug));
  const dynamicDemos = registry.demos.filter((d) => !curatedSlugs.has(d.slug));
  const allDemos = [...curatedDemos, ...dynamicDemos];

  return <HackathonHelperClient initialDemos={allDemos} />;
}
