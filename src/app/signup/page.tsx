"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SignUpPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/quran";

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      setBusy(true);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      router.push(next);
    } catch (e: any) {
      setMsg(e?.message || "Failed to sign up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[80vh] grid place-items-center px-4 pt-24">
      <div className="w-full max-w-md rounded-2xl glass-surface glass-readable p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-muted-foreground mt-1">Start saving bookmarks, notes, and progress.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-sm font-medium">Name (optional)</label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              className="mt-1"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <Input
              className="mt-1"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" disabled={busy || !email || !pw} className="w-full font-normal">
            Create account
          </Button>

          {msg && (
            <div className="text-xs text-foreground/80 bg-muted/50 rounded-md p-2 mt-2">
              {msg}
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground mt-2">
            Already have an account?{" "}
            <a className="underline underline-offset-4 hover:text-foreground" href={`/signin?next=${encodeURIComponent(next)}`}>
              Sign in
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] grid place-items-center px-4 pt-24"><div>Loading…</div></div>}>
      <SignUpPageContent />
    </Suspense>
  );
}
