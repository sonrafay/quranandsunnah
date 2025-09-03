"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { saveProfile } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut } from "lucide-react";

type ProfileDoc = {
  displayName?: string;
  avatar?: string;
};

const AVATAR_PRESETS: { id: string; label: string; bg: string; emoji: string }[] = [
  { id: "mint-moon",    label: "Mint Moon",      bg: "bg-emerald-600", emoji: "🌙" },
  { id: "teal-book",    label: "Teal Book",      bg: "bg-teal-600",    emoji: "📖" },
  { id: "sky-star",     label: "Sky Star",       bg: "bg-sky-600",     emoji: "⭐" },
  { id: "amber-lamp",   label: "Amber Lamp",     bg: "bg-amber-600",   emoji: "🪔" },
  { id: "violet-orchid",label: "Violet Orchid",  bg: "bg-violet-600",  emoji: "🌸" },
  { id: "rose-heart",   label: "Rose Heart",     bg: "bg-rose-600",    emoji: "❤️" },
  { id: "stone-kaaba",  label: "Stone Kaaba",    bg: "bg-stone-700",   emoji: "🕋" },
  { id: "slate-compass",label: "Slate Compass",  bg: "bg-slate-700",   emoji: "🧭" },
];

function AvatarPreview({
  photoURL,
  fallbackEmoji,
  className = "",
}: {
  photoURL?: string | null;
  fallbackEmoji: string;
  className?: string;
}) {
  if (photoURL) {
    return (
      <Image
        src={photoURL}
        alt="Avatar"
        width={128}
        height={128}
        className={`h-32 w-32 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`h-32 w-32 rounded-full grid place-items-center text-4xl select-none ${className}`}>
      <span>{fallbackEmoji}</span>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const params = useSearchParams();
  const backTo = params.get("next") || "/quran";

  const { user, loading, logOut } = useAuth();
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState<string>("teal-book");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loading) return;
      if (!user) {
        router.replace(`/signin?next=${encodeURIComponent("/account")}`);
        return;
      }
      setName(user.displayName || "");
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as ProfileDoc) : {};
        if (!cancelled) {
          if (data.displayName) setName(data.displayName);
          if (data.avatar) setAvatarId(data.avatar);
        }
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">Loading…</div>;
  }

  async function onSave() {
    const u = auth.currentUser;
    if (!u) return; // extra guard

    setSaving(true);
    setMsg(null);
    try {
      const displayName = name.trim();
      if (displayName && displayName !== u.displayName) {
        await updateProfile(u, { displayName });
      }
      await saveProfile(u.uid, { displayName: displayName || undefined });

      // also store avatar preset key
      await setDoc(
        doc(db, "users", u.uid),
        { avatar: avatarId, updatedAt: serverTimestamp() },
        { merge: true }
      );

      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-28 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and basic preferences.</p>
        </div>
        <Button variant="outline" className="font-normal" onClick={() => logOut()}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8 rounded-2xl border bg-background/60 p-6">
        {/* Avatar column */}
        <div className="flex flex-col items-center gap-4">
          <div className={AVATAR_PRESETS.find((a) => a.id === avatarId)?.bg + " rounded-full"}>
            <AvatarPreview
              photoURL={user.photoURL}
              fallbackEmoji={AVATAR_PRESETS.find((a) => a.id === avatarId)?.emoji || "📖"}
              className="ring-2 ring-foreground/10"
            />
          </div>
          <div className="text-xs text-muted-foreground text-center">
            We use your Google photo if available; otherwise a preset below.
          </div>
        </div>

        {/* Form column */}
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium">Display name</label>
            <Input
              className="mt-1"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="text-xs text-muted-foreground mt-1">
              Shown in your profile. Leave blank to keep your Google name.
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Avatar style</div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {AVATAR_PRESETS.map((p) => {
                const active = p.id === avatarId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAvatarId(p.id)}
                    className={[
                      "aspect-square rounded-xl border grid place-items-center text-2xl transition",
                      p.bg,
                      active ? "ring-2 ring-offset-2 ring-foreground/60" : "opacity-90 hover:opacity-100",
                    ].join(" ")}
                    aria-pressed={active}
                    title={p.label}
                  >
                    <span className="select-none">{p.emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input className="mt-1" value={user.email || ""} readOnly />
            </div>
            <div>
              <label className="text-sm font-medium">User ID</label>
              <Input className="mt-1" value={user.uid} readOnly />
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={onSave} disabled={saving} className="font-normal">
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {msg && <span className="ml-3 text-sm text-muted-foreground">{msg}</span>}
          </div>
        </div>
      </div>

      <div className="text-right">
        <Button variant="ghost" className="font-normal" onClick={() => router.push(backTo)}>
          Back
        </Button>
      </div>
    </div>
  );
}
