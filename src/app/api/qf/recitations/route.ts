import { NextResponse } from "next/server";
import { qfGet } from "@/lib/server/qf";

export const revalidate = 86400;

export async function GET() {
  type SrcItem = { id: number; reciter_name: string; style?: string };
  const data = await qfGet<SrcItem[]>("/recitations", { revalidate: 86400 });
  return NextResponse.json({ recitations: data });
}
