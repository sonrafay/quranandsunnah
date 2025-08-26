// =============================
// FILE: app/api/subscribe/route.ts
import { NextResponse } from "next/server";

// Simple stub. Wire this to your provider later.
export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  console.log("New subscriber:", email);
  // TODO: send to Mailchimp, Resend, or Supabase
  return NextResponse.json({ ok: true });
}