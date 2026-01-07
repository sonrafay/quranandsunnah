"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SignInPageContent() {
  const { user, loading, signInGoogle } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";

  // email form state
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // if already signed in, bounce to next
  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [loading, user, next, router]);

  async function onGoogle() {
    setErr(null);
    setBusy(true);
    try {
      await signInGoogle();
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onEmailSignIn() {
    setErr(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Email sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateAccount() {
    setErr(null);
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), pass);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice("Password reset email sent (check your inbox).");
    } catch (e: any) {
      setErr(e?.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  // simple, clean card centered on the page
  return (
    <main className="min-h-[70vh] grid place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-background/60 p-6">
        <h1 className="text-2xl font-semibold text-center">Sign in</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Sign in to sync bookmarks, notes, and progress.
        </p>

        {/* Google sign-in */}
        <div className="mt-6">
          <Button
            className="w-full font-normal"
            disabled={busy}
            onClick={onGoogle}
          >
            Continue with Google
          </Button>
        </div>

        {/* divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email / password (optional) */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              className="mt-1"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <Input
              className="mt-1"
              type="password"
              placeholder="Your password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 font-normal"
              disabled={busy || !email || !pass}
              onClick={onEmailSignIn}
            >
              Sign in
            </Button>
            <Button
              className="flex-1 font-normal"
              variant="outline"
              disabled={busy || !email || !pass}
              onClick={onCreateAccount}
            >
              Create account
            </Button>
          </div>

          <div className="text-right">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={onForgot}
              disabled={busy || !email}
              title="Send password reset email"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {(err || notice) && (
          <div className="mt-4 text-xs">
            {err && <div className="text-red-500">{err}</div>}
            {notice && <div className="text-emerald-500">{notice}</div>}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="min-h-[70vh] grid place-items-center px-4"><div>Loading…</div></main>}>
      <SignInPageContent />
    </Suspense>
  );
}
