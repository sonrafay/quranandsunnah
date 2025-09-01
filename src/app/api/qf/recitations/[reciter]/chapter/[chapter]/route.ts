import { NextResponse } from "next/server";
import { qfGet } from "@/lib/server/qf";

type Params = { params: { reciter: string; chapter: string } };

export const revalidate = 86400;

export async function GET(_req: Request, { params }: Params) {
  const { reciter, chapter } = params;

  type Src = {
    audio_files: Array<{ chapter_id: number; url: string; format?: string; duration?: number }>;
  };

  // Get all chapter files for a reciter and pick the one we need
  const data = await qfGet<Src>(`/chapter_reciters/${reciter}/audio_files`, { revalidate: 86400 });
  const item = data.audio_files.find((a) => a.chapter_id === Number(chapter));

  return NextResponse.json({ chapter: Number(chapter), reciter: Number(reciter), url: item?.url || null });
}
