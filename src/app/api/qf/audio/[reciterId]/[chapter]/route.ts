import { NextRequest, NextResponse } from "next/server";
import { qfGet, qfHeaders } from "@/lib/server/qf";

/**
 * Returns one object:
 * {
 *   audioUrl: string,
 *   timings: Array<{ verse: number; start: number; end: number }>
 * }
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: { reciterId: string; chapter: string } }
) {
  const reciterId = Number(ctx.params.reciterId);
  const chapter = Number(ctx.params.chapter);
  if (!reciterId || !chapter) {
    return NextResponse.json({ error: "Bad params" }, { status: 400 });
  }

  // 1) Single-file audio for the surah
  // GET /chapter_recitations/{reciterId}/{chapter}
  const audioFile = await qfGet<{ audio_file: { audio_url: string } }>(
    `/chapter_recitations/${reciterId}/${chapter}`
  ).catch((e) => {
    console.error("[QF] chapter_recitations error", e);
    return null;
  });

  // 2) Segments for timings (from "recitation audio files")
  // GET /recitations/{reciterId}/audio_files?chapter_number=X&fields=segments,url,duration,format
  const audioList = await qfGet<{ audio_files?: any[] }>(
    `/recitations/${reciterId}/audio_files?chapter_number=${chapter}&fields=segments,url,duration,format`
  ).catch((e) => {
    console.error("[QF] recitation audio_files error", e);
    return null;
  });

  const audioUrl = audioFile?.audio_file?.audio_url || null;

  // Parse segments -> verse timings
  // segments example (docs): [[[startMs, durationMs, idx], ...]]
  // idx = -1 means silence/intro; >= 0 maps to ayah index (0-based)
  const timings: Array<{ verse: number; start: number; end: number }> = [];
  const segBlock: number[][] | undefined =
    audioList?.audio_files?.[0]?.segments?.[0];

  if (segBlock && Array.isArray(segBlock)) {
    // Collect first/last time per verse idx
    const starts = new Map<number, number>();
    const ends = new Map<number, number>();

    for (const triplet of segBlock) {
      const [start, duration, idx] = triplet as [number, number, number];
      if (typeof start !== "number" || typeof duration !== "number") continue;
      if (typeof idx !== "number" || idx < 0) continue; // skip non-verse segments

      const s = start;
      const e = start + duration;

      if (!starts.has(idx)) starts.set(idx, s);
      // keep extending 'end' as we encounter same verse idx (just in case)
      ends.set(idx, Math.max(ends.get(idx) ?? 0, e));
    }

    // Build compact timings list in verse order (1-based verse numbers)
    const verseIdxs = Array.from(starts.keys()).sort((a, b) => a - b);
    for (const vi of verseIdxs) {
      const start = starts.get(vi)!;
      const end = ends.get(vi)!;
      timings.push({ verse: vi + 1, start, end });
    }
  }

  return NextResponse.json({ audioUrl, timings }, { headers: qfHeaders() });
}
